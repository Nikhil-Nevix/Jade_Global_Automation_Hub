"""Report service (ported from InfraAnsible VM).

After a job finishes, scans its logs for CSV paths, SSH-copies those CSVs off the
target server into REPORTS_DIR/<job_id>/, persists the patch_report text as a
file, and builds a compliance result_summary on the Job.

Synchronous — invoked from the Celery job task (with the task's session) and from
the interactive patch-report callback (with its own sync session).
"""
import csv
import os
import re
import logging
from datetime import datetime
from typing import List, Optional

from app.core.config import settings
from app.core.sync_db import get_sync_session
from app.models import Job, JobLog, Server
from app.utils import ssh_client

logger = logging.getLogger("infraansible")

_CSV_LOG_PATTERNS = [r'/tmp/[^\s\'"]+\.csv', r'/var/tmp/[^\s\'"]+\.csv']
_COMPLIANT_VALUES = {"compliant", "0", "", "pass", "passed", "ok", "none", "clean"}


# ─── Public entry points ──────────────────────────────────────────────────────

def collect_job_reports(session, job_id: int) -> None:
    """Collect CSV/patch reports for a finished job and store a compliance summary."""
    try:
        job = session.get(Job, job_id)
        if not job:
            return

        job_reports_dir = os.path.join(settings.REPORTS_DIR, str(job_id))
        os.makedirs(job_reports_dir, exist_ok=True)

        collected: List[dict] = []

        server = session.get(Server, job.server_id) if job.server_id else None
        if server:
            log_content = _get_log_content(session, job_id)
            remote_paths = _extract_csv_paths(log_content)
            if remote_paths:
                collected += _copy_remote_csvs(server, remote_paths, job_reports_dir)

        if job.patch_report:
            pf = _save_patch_report_file(job.patch_report, job_reports_dir, job_id)
            if pf:
                collected.append(pf)

        if not collected:
            return

        # De-duplicate by filename (keep last).
        seen = {f["filename"]: f for f in collected}
        collected = list(seen.values())

        job.report_files = collected
        job.result_summary = _build_result_summary(collected)
        session.commit()
        logger.info(f"[report_service] job {job_id}: saved {len(collected)} report(s), "
                    f"compliance={job.result_summary.get('compliance_pct')}%")
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[report_service] job {job_id} collection error: {exc}")


def save_patch_report_file(job_id: int, csv_data: str) -> None:
    """Persist the patch_report CSV to disk and refresh result_summary (own session)."""
    try:
        with get_sync_session() as session:
            job = session.get(Job, job_id)
            if not job:
                return
            job_reports_dir = os.path.join(settings.REPORTS_DIR, str(job_id))
            os.makedirs(job_reports_dir, exist_ok=True)
            file_info = _save_patch_report_file(csv_data, job_reports_dir, job_id)
            if not file_info:
                return
            existing = [f for f in (job.report_files or []) if f.get("filename") != file_info["filename"]]
            existing.append(file_info)
            job.report_files = existing
            job.result_summary = _build_result_summary(existing)
            session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[report_service] patch_report file save error job {job_id}: {exc}")


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _get_log_content(session, job_id: int) -> str:
    logs = session.query(JobLog).filter(JobLog.job_id == job_id).order_by(JobLog.line_number).all()
    return "\n".join(log.content for log in logs)


def _extract_csv_paths(log_content: str) -> list:
    found = set()
    for pattern in _CSV_LOG_PATTERNS:
        found.update(re.findall(pattern, log_content, re.IGNORECASE))
    return list(found)


def _copy_remote_csvs(server: Server, remote_paths: list, dest_dir: str) -> list:
    collected = []
    for remote_path in remote_paths:
        try:
            content = ssh_client.read_remote_file(
                ip_address=server.ip_address, ssh_user=server.ssh_user,
                ssh_port=server.ssh_port, remote_path=remote_path, ssh_key_path=server.ssh_key_path,
            )
            filename = os.path.basename(remote_path)
            local_path = os.path.join(dest_dir, filename)
            with open(local_path, "w", encoding="utf-8") as fh:
                fh.write(content)
            collected.append({
                "filename": filename, "path": local_path, "remote_path": remote_path,
                "size_kb": round(os.path.getsize(local_path) / 1024, 2),
                "type": _classify_csv(filename), "saved_at": datetime.utcnow().isoformat(),
            })
        except Exception:  # noqa: BLE001 — one missing file shouldn't block others
            continue
    return collected


def _save_patch_report_file(csv_data: str, dest_dir: str, job_id: int) -> Optional[dict]:
    try:
        filename = f"patch_report_{job_id}.csv"
        local_path = os.path.join(dest_dir, filename)
        with open(local_path, "w", encoding="utf-8") as fh:
            fh.write(csv_data)
        return {
            "filename": filename, "path": local_path, "remote_path": None,
            "size_kb": round(os.path.getsize(local_path) / 1024, 2),
            "type": "patch", "saved_at": datetime.utcnow().isoformat(),
        }
    except Exception:  # noqa: BLE001
        return None


def _classify_csv(filename: str) -> str:
    name = filename.lower()
    if any(k in name for k in ("compliance", "network", "firmware", "device")):
        return "compliance"
    if any(k in name for k in ("patch", "rpm", "upgrade", "lag")):
        return "patch"
    return "general"


def _build_result_summary(file_infos: list) -> dict:
    all_rows, headers_by_file = [], {}
    for fi in file_infos:
        path = fi.get("path")
        if not path or not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                rows = list(csv.reader(fh))
            if not rows:
                continue
            headers_by_file[fi["filename"]] = rows[0]
            all_rows.extend(rows[1:])
        except Exception:  # noqa: BLE001
            continue

    if not all_rows:
        return {}

    compliant = non_compliant = 0
    status_counts: dict = {}
    for row in all_rows:
        if not row:
            continue
        status_val = row[-1].strip() if row[-1] else ""
        status_counts[status_val] = status_counts.get(status_val, 0) + 1
        low = status_val.lower()
        if low in _COMPLIANT_VALUES or ("compliant" in low and "non" not in low):
            compliant += 1
        else:
            non_compliant += 1

    total = compliant + non_compliant
    pct = round((compliant / total) * 100, 1) if total else 0.0
    risk = "LOW" if pct >= 90 else "MEDIUM" if pct >= 70 else "HIGH"
    return {
        "compliant": compliant, "non_compliant": non_compliant, "total": total,
        "compliance_pct": pct, "risk_level": risk, "status_breakdown": status_counts,
        "headers_by_file": headers_by_file, "row_count": len(all_rows),
        "parsed_at": datetime.utcnow().isoformat(),
    }
