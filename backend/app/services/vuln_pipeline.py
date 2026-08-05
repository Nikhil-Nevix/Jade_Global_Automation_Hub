"""Vulnerability ingestion pipeline (sync — runs inside Celery workers).

Flow: locate CSV path from playbook logs -> resolve file (controller-local or
remote target via SSH) -> upload raw file to MinIO -> parse rows -> insert
VulnerabilityFinding rows linked to a ScanRun.
"""
import os
import uuid
from datetime import datetime
from typing import Optional, List

from app.core.config import settings
from app.models import Job, Server, ScanRun, VulnerabilityFinding
from app.services import minio_service
from app.services.csv_parser import parse_csv
from app.utils.log_parser import log_parser
from app.utils.ssh_client import resolve_csv_file


_SEVERITY_WEIGHTS = {"critical": 1.25, "high": 1.10, "medium": 0.90, "low": 0.65, "info": 0.40}


def _enrich(findings: List[dict]) -> List[dict]:
    """Calculate true_risk_score fallback when not present in CSV."""
    for f in findings:
        if f.get("true_risk_score") is None and f.get("qds") is not None:
            weight = _SEVERITY_WEIGHTS.get((f.get("severity") or "").lower(), 1.0)
            f["true_risk_score"] = round(min(f["qds"] * weight, 100.0), 1)
    return findings


def _summarize(findings: List[dict]) -> dict:
    total = len(findings)
    by_severity: dict = {}
    for f in findings:
        sev = (f.get("severity") or "unknown").lower()
        by_severity[sev] = by_severity.get(sev, 0) + 1
    return {"total_findings": total, "by_severity": by_severity}


def ingest_csv_file(
    session, *, local_csv_path: str, scan_run: ScanRun,
) -> dict:
    """Upload CSV to MinIO and insert parsed findings linked to scan_run. Returns summary."""
    object_name = minio_service.upload_csv(local_csv_path, scan_run.run_id)
    scan_run.minio_path = object_name

    findings = _enrich(parse_csv(local_csv_path))
    for f in findings:
        session.add(VulnerabilityFinding(scan_run_id=scan_run.id, **f))

    scan_run.status = "completed"
    scan_run.completed_at = datetime.utcnow()
    session.commit()

    return {"minio_path": object_name, **_summarize(findings)}


def ingest_job_csv(session, job_id: int, stdout: str) -> Optional[dict]:
    """
    Called after a regular playbook job completes. If the logs reference a CSV,
    resolve it, push to MinIO + DB (as a ScanRun), and link it back to the job.
    """
    csv_path = log_parser.extract_csv_path(stdout)
    if not csv_path:
        return None

    job = session.get(Job, job_id)
    server = session.get(Server, job.server_id) if job else None
    if job is None or server is None:
        return None

    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    local_path = resolve_csv_file(
        csv_path=csv_path, ip_address=server.ip_address, ssh_user=server.ssh_user,
        ssh_port=server.ssh_port, ssh_key_path=server.ssh_key_path, local_dir=settings.REPORTS_DIR,
    )

    scan_run = ScanRun(
        run_id=str(uuid.uuid4()),
        trigger_type="on_demand",
        triggered_by=job.user_id,
        server_count=1,
        status="running",
        started_at=datetime.utcnow(),
    )
    session.add(scan_run)
    session.flush()

    summary = ingest_csv_file(session, local_csv_path=local_path, scan_run=scan_run)

    job.csv_minio_path = scan_run.minio_path
    job.result_summary = summary
    session.commit()
    return summary
