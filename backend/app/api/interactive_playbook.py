"""Interactive playbook API — ported from InfraAnsible (VM).

Drives the runtime patch-selection flow:

  running playbook ──POST /patches-ready──▶ backend ──(WebSocket patches_ready)──▶ UI
  UI ──GET /available-patches──▶ backend ──(SSH read available_patches_<job>.txt)
  UI ──POST /selected-patches──▶ backend ──(SSH write selected_patches_<job>.txt)──▶ unblocks playbook
  running playbook ──POST /patch-report──▶ backend (stores CSV on the job)

`patches-ready` and `patch-report` are unauthenticated because they are called by
the Ansible playbook itself (via the injected backend_url). The user-facing
endpoints require a normal access token.

All endpoints accept a job reference that is either the numeric DB id or the job
UUID (`Job.job_id`), so both the job-management UI and the interactive dialog work.
"""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Job, Server
from app.utils import ssh_client
from app.websocket.emitter import emit_patches_ready

logger = logging.getLogger("infraansible")
router = APIRouter(prefix="/api/jobs", tags=["interactive"])


async def resolve_job(db: AsyncSession, job_ref: str) -> Job:
    """Look up a job by numeric DB id or by UUID string."""
    job = None
    if job_ref.isdigit():
        job = await db.get(Job, int(job_ref))
    if job is None:
        result = await db.execute(select(Job).where(Job.job_id == job_ref))
        job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("/{job_ref}/patches-ready")
async def patches_ready(job_ref: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Ansible callback: available_patches file is ready → notify the UI."""
    job = await resolve_job(db, job_ref)
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass
    file_path = data.get("file_path") or f"/tmp/available_patches_{job.job_id}.txt"
    logger.info(f"patches-ready for job {job.job_id}, file: {file_path}")
    emit_patches_ready(job.job_id, file_path)
    return {"message": "Notification sent", "job_id": job.job_id}


@router.get("/{job_ref}/available-patches")
async def get_available_patches(
    job_ref: str,
    file_path: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read available_patches_<job>.txt from the target server over SSH."""
    job = await resolve_job(db, job_ref)
    server = await db.get(Server, job.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    path = file_path or f"/tmp/available_patches_{job.job_id}.txt"
    try:
        content = await asyncio.to_thread(
            ssh_client.read_remote_file,
            ip_address=server.ip_address, ssh_user=server.ssh_user,
            ssh_port=server.ssh_port, remote_path=path, ssh_key_path=server.ssh_key_path,
        )
    except Exception as e:
        logger.error(f"Error fetching patches for job {job.job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to read patches: {e}")

    patches = [line.strip() for line in content.splitlines() if line.strip()]
    return {"job_id": job.job_id, "file_path": path, "patches": patches, "total": len(patches)}


@router.post("/{job_ref}/selected-patches")
async def submit_selected_patches(
    job_ref: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Write the user's selected patches back to the target server, unblocking the playbook."""
    job = await resolve_job(db, job_ref)
    server = await db.get(Server, job.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")

    selected = payload.get("selected_patches") or []
    if not selected:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No patches selected")
    path = payload.get("file_path") or f"/tmp/selected_patches_{job.job_id}.txt"
    content = "\n".join(selected) + "\n"

    try:
        await asyncio.to_thread(
            ssh_client.write_remote_file,
            ip_address=server.ip_address, ssh_user=server.ssh_user,
            ssh_port=server.ssh_port, remote_path=path, content=content,
            ssh_key_path=server.ssh_key_path,
        )
    except Exception as e:
        logger.error(f"Error writing selected patches for job {job.job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to write patches: {e}")

    logger.info(f"Selected patches written for job {job.job_id}: {len(selected)} patches")
    return {"message": "Selected patches saved successfully", "job_id": job.job_id,
            "patches_count": len(selected), "file_path": path}


@router.post("/{job_ref}/patch-report")
async def save_patch_report(job_ref: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Ansible callback: store the post-patch CSV report on the job."""
    job = await resolve_job(db, job_ref)
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass
    csv_data = data.get("csv_data", "")
    if not csv_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No CSV data provided")

    job.patch_report = csv_data
    await db.commit()

    # Best-effort: persist to disk and build result_summary (report_service, Phase 2.4).
    try:
        from app.services import report_service
        await asyncio.to_thread(report_service.save_patch_report_file, job.id, csv_data)
    except Exception as e:
        logger.warning(f"Patch report file save failed (non-fatal): {e}")

    logger.info(f"Patch report saved for job {job.job_id}")
    return {"message": "Patch report saved successfully", "job_id": job.job_id}


@router.get("/{job_ref}/patch-report")
async def download_patch_report(
    job_ref: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the stored patch-report CSV for a job."""
    job = await resolve_job(db, job_ref)
    if not job.patch_report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No patch report available for this job")
    return Response(
        content=job.patch_report,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=patch_report_{job.job_id}.csv"},
    )
