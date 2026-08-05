import os
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import User
from app.schemas import (
    PlaybookOut, PlaybookUpdate, MessageResponse,
    PlaybookContentUpdate, PlaybookFileUpdate, PlaybookAuditLogOut,
)
from app.services import playbook_service

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])


@router.get("")
async def list_playbooks(
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    playbooks, total = await playbook_service.list_playbooks(
        db, is_active=is_active, search=search, page=page, per_page=per_page,
    )
    return {
        "items": [PlaybookOut.model_validate(p) for p in playbooks],
        "pagination": {"page": page, "per_page": per_page, "total": total,
                       "pages": (total + per_page - 1) // per_page},
    }


@router.post("/preview-zip")
async def preview_zip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Inspect a ZIP without saving it: list YAML files and suggest the main playbook."""
    content = await file.read()
    try:
        import asyncio
        return await asyncio.to_thread(playbook_service.preview_zip, content)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/upload", response_model=PlaybookOut, status_code=status.HTTP_201_CREATED)
async def upload_single(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    try:
        return await playbook_service.create_playbook(
            db, name=name, filename=file.filename, content=content, description=description,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/upload-folder", response_model=PlaybookOut, status_code=status.HTTP_201_CREATED)
async def upload_folder(
    name: str = Form(...),
    main_playbook_file: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    try:
        return await playbook_service.create_folder_playbook(
            db, name=name, content=content, main_playbook_file=main_playbook_file,
            description=description, user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("", response_model=PlaybookOut, status_code=status.HTTP_201_CREATED)
async def upload_playbook(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Legacy/root upload — single file or ZIP (auto-detected by extension)."""
    content = await file.read()
    try:
        return await playbook_service.create_playbook(
            db, name=name, filename=file.filename, content=content, description=description,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{playbook_id}", response_model=PlaybookOut)
async def get_playbook(playbook_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return playbook


@router.get("/{playbook_id}/content")
async def get_content(playbook_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        content = await playbook_service.read_single_content(playbook)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"playbook_id": playbook_id, "content": content}


@router.put("/{playbook_id}/content")
async def update_content(
    playbook_id: int,
    payload: PlaybookContentUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        playbook = await playbook_service.update_single_content(
            db, playbook, content=payload.content, user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            changes_description=payload.changes_description,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"message": "Playbook content updated", "playbook": PlaybookOut.model_validate(playbook)}


@router.get("/{playbook_id}/files")
async def list_files(playbook_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        files = await playbook_service.list_folder_files(playbook)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"files": files}


@router.get("/{playbook_id}/files/{file_path:path}")
async def get_folder_file(
    playbook_id: int, file_path: str,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        content = await playbook_service.read_folder_file(playbook, file_path)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"content": content, "file_path": file_path}


@router.put("/{playbook_id}/files/{file_path:path}")
async def update_folder_file(
    playbook_id: int, file_path: str,
    payload: PlaybookFileUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        await playbook_service.write_folder_file(
            db, playbook, file_path, content=payload.content, user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            changes_description=payload.changes_description,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"message": f"File {file_path} updated"}


@router.get("/{playbook_id}/download")
async def download_playbook(playbook_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    try:
        path, filename, cleanup_dir = playbook_service._download_path(playbook)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    task = BackgroundTask(shutil.rmtree, cleanup_dir, ignore_errors=True) if cleanup_dir else None
    return FileResponse(path, filename=filename, background=task)


@router.get("/{playbook_id}/verify")
async def verify_playbook(playbook_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    import asyncio
    return await asyncio.to_thread(playbook_service.verify_playbook, playbook)


@router.get("/{playbook_id}/audit-logs")
async def get_audit_logs(
    playbook_id: int, page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    logs = await playbook_service.list_audit_logs(db, playbook_id, page=page, per_page=per_page)
    return {"playbook_id": playbook_id, "audit_logs": [PlaybookAuditLogOut.model_validate(l) for l in logs]}


@router.put("/{playbook_id}", response_model=PlaybookOut)
async def update_playbook(
    playbook_id: int,
    payload: PlaybookUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return await playbook_service.update_playbook(db, playbook, payload)


@router.delete("/{playbook_id}", response_model=MessageResponse)
async def delete_playbook(
    playbook_id: int,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    playbook = await playbook_service.get_playbook(db, playbook_id)
    if playbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    await playbook_service.delete_playbook(db, playbook)
    return {"message": "Playbook deleted successfully"}
