"""Celery tasks for vulnerability scanning (scheduled + on-demand)."""
import os
import uuid
from datetime import datetime
from typing import List, Optional

from app.tasks.celery_app import celery_app
from app.core.sync_db import get_sync_session
from app.core.config import settings
from app.models import Server, Playbook, ScanRun
from app.services.ansible_runner import ansible_runner_instance
from app.services.csv_parser import parse_csv
from app.services import minio_service
from app.utils.log_parser import log_parser
from app.utils.ssh_client import resolve_csv_file


def _build_inventory(servers: List[Server]) -> str:
    lines = ["[target_hosts]"]
    for s in servers:
        host = s.hostname or s.ip_address
        lines.append(f"{host} ansible_host={s.ip_address} ansible_user={s.ssh_user} ansible_port={s.ssh_port}")
    return "\n".join(lines) + "\n"


def _resolve_vuln_playbook(session, playbook_id: Optional[int]) -> Optional[Playbook]:
    if playbook_id:
        return session.get(Playbook, playbook_id)
    # Fall back to a playbook named like the configured vulnerability playbook.
    pb = (
        session.query(Playbook)
        .filter(Playbook.is_active == True, Playbook.name.ilike("%vuln%"))  # noqa: E712
        .first()
    )
    if pb is None:
        pb = session.query(Playbook).filter(Playbook.is_active == True).first()  # noqa: E712
    return pb


def _run_scan(session, scan_run: ScanRun, servers: List[Server], playbook: Playbook) -> dict:
    scan_run.status = "running"
    scan_run.started_at = datetime.utcnow()
    scan_run.server_count = len(servers)
    session.commit()

    inventory = _build_inventory(servers)
    extra_vars = {"run_id": scan_run.run_id, "backend_url": settings.BACKEND_URL}

    if playbook.is_folder and playbook.main_playbook_file:
        working_dir = playbook.file_path
        playbook_path = os.path.join(playbook.file_path, playbook.main_playbook_file)
    else:
        working_dir = None
        playbook_path = playbook.file_path

    # Use the first server's SSH key as the connection key (shared inventory).
    key_path = servers[0].ssh_key_path if servers else None
    runner = ansible_runner_instance.run_playbook(
        playbook_path=playbook_path, inventory=inventory, extra_vars=extra_vars,
        private_key_path=key_path, working_dir=working_dir, async_mode=False,
    )
    parsed = ansible_runner_instance.parse_runner_output(runner)

    csv_path = log_parser.extract_csv_path(parsed.get("stdout", ""))
    if not csv_path:
        scan_run.status = "failed"
        scan_run.error_message = "No CSV file path found in playbook output"
        scan_run.completed_at = datetime.utcnow()
        session.commit()
        return {"status": "failed", "reason": "no_csv"}

    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    # Combined CSV is expected on the controller; fall back to first server via SSH.
    fallback = servers[0] if servers else None
    local_path = resolve_csv_file(
        csv_path=csv_path,
        ip_address=fallback.ip_address if fallback else "127.0.0.1",
        ssh_user=fallback.ssh_user if fallback else "root",
        ssh_port=fallback.ssh_port if fallback else 22,
        ssh_key_path=fallback.ssh_key_path if fallback else None,
        local_dir=settings.REPORTS_DIR,
    )

    object_name = minio_service.upload_csv(local_path, scan_run.run_id)
    scan_run.minio_path = object_name

    findings = parse_csv(local_path)
    from app.models import VulnerabilityFinding
    for f in findings:
        session.add(VulnerabilityFinding(scan_run_id=scan_run.id, **f))

    scan_run.status = "completed"
    scan_run.completed_at = datetime.utcnow()
    session.commit()
    return {"status": "completed", "findings": len(findings), "minio_path": object_name}


@celery_app.task(name="app.tasks.vuln_tasks.run_scheduled_scan")
def run_scheduled_scan():
    with get_sync_session() as session:
        servers = session.query(Server).filter(Server.is_active == True).all()  # noqa: E712
        if not servers:
            return {"status": "skipped", "reason": "no_active_servers"}
        playbook = _resolve_vuln_playbook(session, None)
        if playbook is None:
            return {"status": "skipped", "reason": "no_playbook"}

        scan_run = ScanRun(run_id=str(uuid.uuid4()), trigger_type="scheduled",
                           triggered_by=None, status="pending")
        session.add(scan_run)
        session.commit()
        try:
            return _run_scan(session, scan_run, servers, playbook)
        except Exception as e:
            scan_run.status = "failed"
            scan_run.error_message = str(e)
            scan_run.completed_at = datetime.utcnow()
            session.commit()
            return {"status": "error", "message": str(e)}


@celery_app.task(name="app.tasks.vuln_tasks.run_on_demand_scan")
def run_on_demand_scan(scan_run_id: int, server_ids: List[int], ip_addresses: List[str], playbook_id: Optional[int]):
    with get_sync_session() as session:
        scan_run = session.get(ScanRun, scan_run_id)
        if scan_run is None:
            return {"status": "error", "message": "Scan run not found"}

        servers = []
        if server_ids:
            servers.extend(session.query(Server).filter(Server.id.in_(server_ids)).all())
        # Brand-new IPs: create lightweight server rows so the scan can target them.
        existing_ips = {s.ip_address for s in servers}
        for ip in ip_addresses:
            if ip in existing_ips:
                continue
            srv = session.query(Server).filter(Server.ip_address == ip).first()
            if srv is None:
                srv = Server(ip_address=ip, hostname=ip, is_active=True)
                session.add(srv)
                session.flush()
            servers.append(srv)
            existing_ips.add(ip)

        if not servers:
            scan_run.status = "failed"
            scan_run.error_message = "No servers resolved for scan"
            session.commit()
            return {"status": "failed", "reason": "no_servers"}

        playbook = _resolve_vuln_playbook(session, playbook_id)
        if playbook is None:
            scan_run.status = "failed"
            scan_run.error_message = "No vulnerability playbook available"
            session.commit()
            return {"status": "failed", "reason": "no_playbook"}

        try:
            return _run_scan(session, scan_run, servers, playbook)
        except Exception as e:
            scan_run.status = "failed"
            scan_run.error_message = str(e)
            scan_run.completed_at = datetime.utcnow()
            session.commit()
            return {"status": "error", "message": str(e)}
