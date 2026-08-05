import asyncio
import csv as csv_mod
import io
import os
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response, FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Job, Server, JobLog
from app.schemas import JobCreate, JobOut, JobLogOut, MessageResponse
from app.services import job_service
from app.utils import ssh_client

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _human_size(size_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


_FILE_TYPE_BY_EXT = {
    ".csv": "csv", ".txt": "text", ".log": "text", ".json": "json",
    ".xml": "markup", ".html": "markup", ".xlsx": "excel", ".xls": "excel", ".pdf": "pdf",
}


@router.get("")
async def list_jobs(
    status: Optional[str] = None,
    playbook_id: Optional[int] = None,
    server_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    jobs, total = await job_service.list_jobs(
        db, status=status, playbook_id=playbook_id, server_id=server_id,
        page=page, per_page=per_page,
    )
    return {
        "items": [JobOut.model_validate(j) for j in jobs],
        "pagination": {"page": page, "per_page": per_page, "total": total,
                       "pages": (total + per_page - 1) // per_page},
    }


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.server_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one server is required")
    try:
        job = await job_service.create_jobs(
            db, playbook_id=payload.playbook_id, server_ids=payload.server_ids,
            user_id=current_user.id, extra_vars=payload.extra_vars, batch_config=payload.batch_config,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Dispatch to Celery (import here to avoid loading celery in request path import time)
    from app.tasks.job_tasks import execute_playbook_task, execute_batch_job_task
    if job.is_batch_job:
        execute_batch_job_task.delay(job.id)
    else:
        execute_playbook_task.delay(job.id)

    return JobOut.model_validate(job)


@router.get("/stats")
async def job_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate job counts by status. Declared before /{job_id} so 'stats'
    isn't matched as an int job id."""
    result = await db.execute(select(Job.status, func.count()).group_by(Job.status))
    counts = {status_val: cnt for status_val, cnt in result.all()}
    total = sum(counts.values())
    success = counts.get("success", 0)
    finished = success + counts.get("failed", 0)
    return {
        "total": total,
        "pending": counts.get("pending", 0),
        "running": counts.get("running", 0),
        "success": success,
        "failed": counts.get("failed", 0),
        "cancelled": counts.get("cancelled", 0),
        "success_rate": round((success / finished) * 100, 1) if finished else 0.0,
    }


# Analytics endpoints. They return valid empty shapes so the dashboard's
# built-in client-side fallback (computed from the jobs list) populates the
# charts. Declared before /{job_id} to avoid the int-path collision.
@router.get("/analytics/success-rate-trends")
async def analytics_success_rate_trends(
    time_range: Optional[str] = None, start_date: Optional[str] = None,
    end_date: Optional[str] = None, granularity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    return {"trends": []}


@router.get("/analytics/execution-time")
async def analytics_execution_time(
    time_range: Optional[str] = None, start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    return {"playbooks": []}


@router.get("/analytics/failure-analysis")
async def analytics_failure_analysis(
    time_range: Optional[str] = None, start_date: Optional[str] = None,
    end_date: Optional[str] = None, group_by: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    return {"summary": {"total_jobs": 0}, "by_playbook": [], "by_server": []}


@router.get("/analytics/export")
async def export_analytics(
    format: str = "csv",
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export job analytics as CSV or PDF (reportlab)."""
    fmt = (format or "csv").lower()
    if fmt not in ("csv", "pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='format must be "pdf" or "csv"')

    # Aggregate status counts and per-playbook execution stats.
    status_rows = (await db.execute(select(Job.status, func.count()).group_by(Job.status))).all()
    status_counts = {s: c for s, c in status_rows}
    total = sum(status_counts.values())
    success = status_counts.get("success", 0)
    finished = success + status_counts.get("failed", 0)
    success_rate = round((success / finished) * 100, 1) if finished else 0.0
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    if fmt == "csv":
        buf = io.StringIO()
        w = csv_mod.writer(buf)
        w.writerow(["Metric", "Value"])
        w.writerow(["Generated", generated])
        w.writerow(["Total jobs", total])
        for st in ("pending", "running", "success", "failed", "cancelled"):
            w.writerow([st.capitalize(), status_counts.get(st, 0)])
        w.writerow(["Success rate (%)", success_rate])
        data = buf.getvalue().encode("utf-8")
        return Response(content=data, media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=analytics.csv"})

    # PDF via reportlab.
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buf, pagesize=A4, title="Job Analytics")
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Job Analytics Report", styles["Title"]),
        Paragraph(f"Generated: {generated}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
    ]
    table_data = [["Metric", "Value"], ["Total jobs", str(total)]]
    for st in ("pending", "running", "success", "failed", "cancelled"):
        table_data.append([st.capitalize(), str(status_counts.get(st, 0))])
    table_data.append(["Success rate (%)", str(success_rate)])
    table = Table(table_data, hAlign="LEFT", colWidths=[8 * cm, 6 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7E22CE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
    ]))
    elements.append(table)
    doc.build(elements)
    pdf_buf.seek(0)
    return Response(content=pdf_buf.read(), media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=analytics.pdf"})


@router.get("/compliance/firmware-matrix")
async def firmware_compliance_matrix(
    job_ids: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Firmware compliance matrix per location/vendor.

    Mirrors the InfraAnsible placeholder implementation (the source app returned a
    static structure pending per-customer CSV parsing). Kept as a stable shape the
    ComplianceMatrix component renders against.
    """
    vendors = ["Cisco", "Fortinet", "Palo Alto", "HPE"]
    data = [
        {"location": "Mumbai DC", "vendors": {
            "Cisco": {"percentage": 92, "status": "compliant"},
            "Fortinet": {"percentage": 78, "status": "warning"},
            "Palo Alto": {"percentage": 88, "status": "warning"},
            "HPE": {"percentage": 85, "status": "warning"}}},
        {"location": "BLR DC", "vendors": {
            "Cisco": {"percentage": 81, "status": "warning"},
            "Fortinet": {"percentage": 74, "status": "warning"},
            "Palo Alto": {"percentage": 90, "status": "compliant"},
            "HPE": {"percentage": 72, "status": "warning"}}},
        {"location": "US DC", "vendors": {
            "Cisco": {"percentage": 88, "status": "warning"},
            "Fortinet": {"percentage": 83, "status": "warning"},
            "Palo Alto": {"percentage": 79, "status": "warning"},
            "HPE": {"percentage": 70, "status": "critical"}}},
    ]
    return {"success": True, "data": data, "vendors": vendors}


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def create_batch(
    payload: JobCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a batch job across multiple servers (alias of create with batch_config)."""
    if not payload.server_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one server is required")
    try:
        job = await job_service.create_jobs(
            db, playbook_id=payload.playbook_id, server_ids=payload.server_ids,
            user_id=current_user.id, extra_vars=payload.extra_vars,
            batch_config=payload.batch_config or {},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    from app.tasks.job_tasks import execute_playbook_task, execute_batch_job_task
    if job.is_batch_job:
        execute_batch_job_task.delay(job.id)
    else:
        execute_playbook_task.delay(job.id)
    return JobOut.model_validate(job)


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/{job_id}/children")
async def get_child_jobs(job_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List child jobs of a batch parent."""
    parent = await job_service.get_job(db, job_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    rows = (await db.execute(
        select(Job).where(Job.parent_job_id == job_id).order_by(Job.id.asc())
    )).scalars().all()
    return {"success": True, "parent_job_id": job_id, "children": [JobOut.model_validate(c) for c in rows],
            "total": len(rows)}


@router.get("/{job_id}/reports")
async def list_job_reports(job_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List stored report files and pre-parsed compliance summary for a job."""
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"success": True, "job_id": job_id, "report_files": job.report_files or [],
            "result_summary": job.result_summary or {}}


@router.get("/{job_id}/reports/{filename}")
async def download_job_report(
    job_id: int, filename: str, format: str = "csv",
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Serve a stored CSV report file (raw CSV, or parsed rows with ?format=json)."""
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    matched = next((f for f in (job.report_files or []) if f.get("filename") == filename), None)
    if not matched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found for job")
    local_path = matched.get("path", "")
    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file no longer exists on disk")
    if format.lower() == "json":
        with open(local_path, "r", encoding="utf-8", errors="replace") as fh:
            rows = list(csv_mod.reader(fh))
        headers = rows[0] if rows else []
        data = rows[1:] if len(rows) > 1 else []
        return {"success": True, "filename": filename, "headers": headers, "data": data, "total_rows": len(data)}
    return FileResponse(local_path, media_type="text/csv", filename=filename)


@router.get("/{job_id}/rpm-csv")
async def get_rpm_csv(job_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Fetch /var/tmp/rpm_upgrades_with_lag.csv from the job's target server over SSH."""
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    server = await db.get(Server, job.server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found for this job")
    csv_path = "/var/tmp/rpm_upgrades_with_lag.csv"
    try:
        content = await asyncio.to_thread(
            ssh_client.read_remote_file,
            ip_address=server.ip_address, ssh_user=server.ssh_user,
            ssh_port=server.ssh_port, remote_path=csv_path, ssh_key_path=server.ssh_key_path,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CSV not available: {e}")
    rows = list(csv_mod.reader(io.StringIO(content)))
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty")
    return {"success": True, "filename": "rpm_upgrades_with_lag.csv",
            "headers": rows[0], "data": rows[1:], "total_rows": len(rows) - 1}


@router.get("/{job_id}/generated-files")
async def get_generated_files(job_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Detect files a playbook produced by scanning the job logs for file paths."""
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    logs = (await db.execute(
        select(JobLog).where(JobLog.job_id == job_id).order_by(JobLog.line_number)
    )).scalars().all()
    log_content = "\n".join(l.content for l in logs)

    patterns = [rf'/(?:var/)?tmp/[^\s\'"]+\.{ext}' for ext in
                ("csv", "txt", "json", "xml", "log", "xlsx", "pdf")]
    found = set()
    for p in patterns:
        found.update(re.findall(p, log_content, re.IGNORECASE))
    if not found:
        return {"success": True, "files": [], "total": 0, "message": "No generated files detected in job logs"}

    files_info = []
    for fp in found:
        filename = os.path.basename(fp)
        ext = os.path.splitext(filename)[1].lower()
        size = os.path.getsize(fp) if os.path.exists(fp) else 0
        files_info.append({
            "path": fp, "filename": filename, "size": size,
            "size_formatted": _human_size(size),
            "type": _FILE_TYPE_BY_EXT.get(ext, "other"), "extension": ext,
        })
    return {"success": True, "files": files_info, "total": len(files_info)}


@router.get("/{job_id}/download-file")
async def download_generated_file(
    job_id: int, file_path: str, action: str = "download",
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Download or view a generated file from the job's target server (SSH) or local disk."""
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not (file_path.startswith("/tmp/") or file_path.startswith("/var/tmp/")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Access to files outside /tmp and /var/tmp is not allowed")
    server = await db.get(Server, job.server_id)
    content = None
    if server is not None:
        try:
            content = await asyncio.to_thread(
                ssh_client.read_remote_file,
                ip_address=server.ip_address, ssh_user=server.ssh_user,
                ssh_port=server.ssh_port, remote_path=file_path, ssh_key_path=server.ssh_key_path,
            )
        except Exception:
            content = None
    if content is None and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found at {file_path}")

    filename = os.path.basename(file_path)
    ext = os.path.splitext(filename)[1].lower()
    if action == "view":
        if ext == ".csv":
            rows = list(csv_mod.reader(io.StringIO(content)))
            return {"success": True, "filename": filename, "type": "csv",
                    "headers": rows[0] if rows else [], "data": rows[1:] if len(rows) > 1 else [],
                    "total_rows": max(len(rows) - 1, 0)}
        if ext in (".txt", ".log", ".json", ".xml"):
            return {"success": True, "filename": filename, "type": "text", "content": content}
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"File type {ext} cannot be viewed inline; download instead")
    content_types = {".csv": "text/csv", ".txt": "text/plain", ".log": "text/plain",
                     ".json": "application/json", ".xml": "application/xml", ".html": "text/html"}
    return Response(content=content, media_type=content_types.get(ext, "application/octet-stream"),
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{job_id}/logs")
async def get_job_logs(
    job_id: int,
    after_line: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    logs = await job_service.get_job_logs(db, job_id, after_line=after_line)
    return {"items": [JobLogOut.model_validate(l) for l in logs]}


@router.post("/{job_ref}/cancel", response_model=MessageResponse)
async def cancel_job(job_ref: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Accept either the numeric DB id (job-management UI) or the UUID (interactive dialog).
    job = None
    if job_ref.isdigit():
        job = await job_service.get_job(db, int(job_ref))
    if job is None:
        job = await job_service.get_job_by_uuid(db, job_ref)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status not in ("pending", "running"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is not running")

    # Mark cancelled; the running Celery task polls this status and stops the runner.
    job.status = "cancelled"
    await db.commit()
    if job.celery_task_id:
        from app.tasks.celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True, signal="SIGTERM")
    return {"message": "Job cancellation requested"}
