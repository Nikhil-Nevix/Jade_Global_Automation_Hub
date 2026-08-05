import os
import uuid
import shutil
import hashlib
import tempfile
import asyncio
from typing import Optional, List

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from werkzeug.utils import secure_filename

from app.core.config import settings
from app.models import Playbook, PlaybookAuditLog
from app.utils.file_manager import (
    extract_zip, generate_file_tree, find_yaml_files, auto_detect_main_playbook,
    get_folder_size, count_files, get_all_files, read_file_content, write_file_content,
    create_zip_from_folder, sanitize_path, FileManagerError,
)

ALLOWED_SINGLE_EXT = {".yml", ".yaml"}
MAX_SINGLE_SIZE = 500 * 1024  # 500 KB


def _unique_suffix() -> str:
    return uuid.uuid4().hex[:8]


async def list_playbooks(
    db: AsyncSession, *, is_active: Optional[bool] = None,
    search: Optional[str] = None, page: int = 1, per_page: int = 20,
):
    stmt = select(Playbook)
    count_stmt = select(func.count(Playbook.id))
    if is_active is not None:
        stmt = stmt.where(Playbook.is_active == is_active)
        count_stmt = count_stmt.where(Playbook.is_active == is_active)
    if search:
        like = f"%{search}%"
        cond = or_(Playbook.name.ilike(like), Playbook.description.ilike(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Playbook.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    playbooks = (await db.execute(stmt)).scalars().all()
    return playbooks, total


async def get_playbook(db: AsyncSession, playbook_id: int) -> Optional[Playbook]:
    return (await db.execute(select(Playbook).where(Playbook.id == playbook_id))).scalar_one_or_none()


def _save_single_file(name: str, filename: str, content: bytes) -> dict:
    """Blocking — runs in a thread. Returns playbook kwargs."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_SINGLE_EXT:
        raise ValueError("Invalid file type. Only .yml and .yaml files are allowed")
    if len(content) == 0:
        raise ValueError("File is empty")
    if len(content) > MAX_SINGLE_SIZE:
        raise ValueError(f"File exceeds 500 KB limit ({len(content)/1024:.1f} KB)")

    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    safe = secure_filename(filename)
    base, ext = os.path.splitext(safe)
    unique = f"{base}_{_unique_suffix()}{ext}"
    path = os.path.join(settings.UPLOAD_FOLDER, unique)
    with open(path, "wb") as f:
        f.write(content)

    return {
        "file_path": path,
        "is_folder": False,
        "main_playbook_file": None,
        "file_structure": None,
        "file_count": 1,
        "total_size_kb": max(1, len(content) // 1024),
    }


def _save_zip_folder(name: str, filename: str, content: bytes) -> dict:
    """Blocking — runs in a thread. Extracts ZIP into a playbook folder."""
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    folder_name = f"{secure_filename(name)}_{_unique_suffix()}"
    dest = os.path.join(settings.UPLOAD_FOLDER, folder_name)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        tmp.write(content)
        tmp_zip = tmp.name

    try:
        ok, msg = extract_zip(tmp_zip, dest)
        if not ok:
            raise ValueError(f"ZIP extraction failed: {msg}")

        yaml_files = find_yaml_files(dest)
        if not yaml_files:
            shutil.rmtree(dest, ignore_errors=True)
            raise ValueError("No YAML playbook files found in the ZIP")

        main_file = auto_detect_main_playbook(yaml_files)
        tree = generate_file_tree(dest)
        return {
            "file_path": dest,
            "is_folder": True,
            "main_playbook_file": main_file,
            "file_structure": tree,
            "file_count": count_files(dest),
            "total_size_kb": max(1, get_folder_size(dest) // 1024),
        }
    finally:
        if os.path.exists(tmp_zip):
            os.unlink(tmp_zip)


async def create_playbook(
    db: AsyncSession, *, name: str, filename: str, content: bytes, description: Optional[str] = None,
) -> Playbook:
    import asyncio

    existing = (await db.execute(select(Playbook).where(Playbook.name == name))).scalar_one_or_none()
    if existing is not None:
        raise ValueError(f"Playbook with name '{name}' already exists")

    is_zip = filename.lower().endswith(".zip")
    saver = _save_zip_folder if is_zip else _save_single_file
    kwargs = await asyncio.to_thread(saver, name, filename, content)

    playbook = Playbook(name=name, description=description, is_active=True, **kwargs)
    db.add(playbook)
    await db.flush()  # obtain playbook.id for the audit row
    await _write_audit(db, playbook_id=playbook.id, playbook_name=name, user_id=None,
                       action="uploaded", changes_description="Playbook uploaded", commit=False)
    await db.commit()
    await db.refresh(playbook)
    return playbook


async def update_playbook(db: AsyncSession, playbook: Playbook, data) -> Playbook:
    if data.name is not None:
        playbook.name = data.name
    if data.description is not None:
        playbook.description = data.description
    if data.is_active is not None:
        playbook.is_active = data.is_active
    await db.commit()
    await db.refresh(playbook)
    return playbook


async def delete_playbook(db: AsyncSession, playbook: Playbook) -> None:
    path = playbook.file_path
    is_folder = playbook.is_folder
    name = playbook.name
    pid = playbook.id
    await _write_audit(db, playbook_id=pid, playbook_name=name, user_id=None,
                       action="deleted", commit=False)
    await db.delete(playbook)
    await db.commit()
    # Best-effort file cleanup after DB delete
    try:
        if is_folder and os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
        elif os.path.isfile(path):
            os.unlink(path)
    except OSError:
        pass


# ─── Playbook audit log ───────────────────────────────────────────────────────

async def _write_audit(
    db: AsyncSession, *, playbook_id: int, playbook_name: Optional[str], user_id: Optional[int],
    action: str, old_content: Optional[str] = None, new_content: Optional[str] = None,
    changes_description: Optional[str] = None, ip_address: Optional[str] = None, commit: bool = True,
) -> None:
    log = PlaybookAuditLog(
        playbook_id=playbook_id, playbook_name=playbook_name, user_id=user_id, action=action,
        old_content=old_content, new_content=new_content, changes_description=changes_description,
        ip_address=ip_address,
    )
    db.add(log)
    if commit:
        await db.commit()


async def list_audit_logs(db: AsyncSession, playbook_id: int, page: int = 1, per_page: int = 50):
    stmt = (select(PlaybookAuditLog).where(PlaybookAuditLog.playbook_id == playbook_id)
            .order_by(PlaybookAuditLog.created_at.desc())
            .offset((page - 1) * per_page).limit(per_page))
    return (await db.execute(stmt)).scalars().all()


# ─── Single-file content editing ──────────────────────────────────────────────

async def read_single_content(playbook: Playbook) -> str:
    if playbook.is_folder:
        raise ValueError("This playbook is a folder; use the folder file endpoints")
    ok, content, err = await asyncio.to_thread(read_file_content, playbook.file_path)
    if not ok:
        raise ValueError(err or "Could not read playbook content")
    return content


async def update_single_content(
    db: AsyncSession, playbook: Playbook, *, content: str, user_id: Optional[int] = None,
    ip_address: Optional[str] = None, changes_description: Optional[str] = None,
) -> Playbook:
    if playbook.is_folder:
        raise ValueError("This playbook is a folder; use the folder file endpoints")
    old = ""
    ok, old_content, _ = await asyncio.to_thread(read_file_content, playbook.file_path)
    if ok:
        old = old_content
    ok, err = await asyncio.to_thread(write_file_content, playbook.file_path, content)
    if not ok:
        raise ValueError(err or "Could not write playbook content")
    playbook.total_size_kb = max(1, len(content.encode("utf-8")) // 1024)
    await _write_audit(db, playbook_id=playbook.id, playbook_name=playbook.name, user_id=user_id,
                       action="updated", old_content=old, new_content=content,
                       changes_description=changes_description, ip_address=ip_address, commit=False)
    await db.commit()
    await db.refresh(playbook)
    return playbook


# ─── Folder file editing ──────────────────────────────────────────────────────

def _folder_abs_path(playbook: Playbook, rel_path: str) -> str:
    safe_rel = sanitize_path(rel_path)
    abs_path = os.path.normpath(os.path.join(playbook.file_path, safe_rel))
    # Guard against path traversal outside the playbook folder.
    if not abs_path.startswith(os.path.abspath(playbook.file_path)):
        raise ValueError("Invalid file path")
    return abs_path


async def list_folder_files(playbook: Playbook) -> List[str]:
    if not playbook.is_folder:
        raise ValueError("This playbook is a single file")
    all_files = await asyncio.to_thread(get_all_files, playbook.file_path)
    base = os.path.abspath(playbook.file_path)
    return sorted(os.path.relpath(f, base) for f in all_files)


async def read_folder_file(playbook: Playbook, rel_path: str) -> str:
    if not playbook.is_folder:
        raise ValueError("This playbook is a single file")
    abs_path = _folder_abs_path(playbook, rel_path)
    ok, content, err = await asyncio.to_thread(read_file_content, abs_path)
    if not ok:
        raise ValueError(err or "Could not read file")
    return content


async def write_folder_file(
    db: AsyncSession, playbook: Playbook, rel_path: str, *, content: str,
    user_id: Optional[int] = None, ip_address: Optional[str] = None,
    changes_description: Optional[str] = None,
) -> None:
    if not playbook.is_folder:
        raise ValueError("This playbook is a single file")
    abs_path = _folder_abs_path(playbook, rel_path)
    old = ""
    ok, old_content, _ = await asyncio.to_thread(read_file_content, abs_path)
    if ok:
        old = old_content
    ok, err = await asyncio.to_thread(write_file_content, abs_path, content)
    if not ok:
        raise ValueError(err or "Could not write file")
    await _write_audit(db, playbook_id=playbook.id, playbook_name=playbook.name, user_id=user_id,
                       action="updated", old_content=old, new_content=content,
                       changes_description=changes_description or f"Edited {rel_path}",
                       ip_address=ip_address, commit=False)
    await db.commit()


# ─── ZIP preview / folder upload / download / verify ──────────────────────────

def preview_zip(content: bytes) -> dict:
    """Extract a ZIP to a temp dir and report its YAML files + suggested main file."""
    tmp_dir = tempfile.mkdtemp(prefix="pb_preview_")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        tmp.write(content)
        tmp_zip = tmp.name
    try:
        ok, msg = extract_zip(tmp_zip, tmp_dir)
        if not ok:
            raise ValueError(f"ZIP extraction failed: {msg}")
        yaml_files_abs = find_yaml_files(tmp_dir)
        yaml_files = sorted(os.path.relpath(f, tmp_dir) for f in yaml_files_abs)
        suggested = auto_detect_main_playbook(yaml_files_abs)
        if suggested:
            suggested = os.path.relpath(suggested, tmp_dir)
        total = count_files(tmp_dir)
        return {"yaml_files": yaml_files, "suggested_main": suggested or "", "total_files": total}
    finally:
        if os.path.exists(tmp_zip):
            os.unlink(tmp_zip)
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def create_folder_playbook(
    db: AsyncSession, *, name: str, content: bytes, main_playbook_file: Optional[str] = None,
    description: Optional[str] = None, user_id: Optional[int] = None,
) -> Playbook:
    existing = (await db.execute(select(Playbook).where(Playbook.name == name))).scalar_one_or_none()
    if existing is not None:
        raise ValueError(f"Playbook with name '{name}' already exists")
    kwargs = await asyncio.to_thread(_save_zip_folder, name, f"{name}.zip", content)
    if main_playbook_file:
        kwargs["main_playbook_file"] = main_playbook_file
    playbook = Playbook(name=name, description=description, is_active=True, **kwargs)
    db.add(playbook)
    await db.flush()  # obtain playbook.id
    await _write_audit(db, playbook_id=playbook.id, playbook_name=name, user_id=user_id,
                       action="uploaded", changes_description="Folder playbook uploaded", commit=False)
    await db.commit()
    await db.refresh(playbook)
    return playbook


def _download_path(playbook: Playbook) -> tuple:
    """Return (path, filename, cleanup_dir). For folders a ZIP is created in a temp dir."""
    if playbook.is_folder:
        tmp_dir = tempfile.mkdtemp(prefix="pb_dl_")
        zip_path = os.path.join(tmp_dir, f"{secure_filename(playbook.name)}.zip")
        ok, msg = create_zip_from_folder(playbook.file_path, zip_path)
        if not ok:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise ValueError(f"Could not create ZIP: {msg}")
        return zip_path, f"{secure_filename(playbook.name)}.zip", tmp_dir
    return playbook.file_path, os.path.basename(playbook.file_path), None


def verify_playbook(playbook: Playbook) -> dict:
    """Compute a SHA-256 integrity hash of the playbook file(s)."""
    hasher = hashlib.sha256()
    files = 0
    if playbook.is_folder:
        for f in sorted(get_all_files(playbook.file_path)):
            try:
                with open(f, "rb") as fh:
                    hasher.update(fh.read())
                files += 1
            except OSError:
                continue
    elif os.path.isfile(playbook.file_path):
        with open(playbook.file_path, "rb") as fh:
            hasher.update(fh.read())
        files = 1
    return {"playbook_id": playbook.id, "files_hashed": files,
            "sha256": hasher.hexdigest(), "exists": files > 0}
