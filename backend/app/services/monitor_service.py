"""Server monitoring — real-time CPU/memory/disk metrics over SSH (paramiko).

Ported from InfraAnsible (VM). The collection functions are synchronous (blocking
SSH); async API endpoints call them via ``asyncio.to_thread`` and the Celery beat
task calls them directly with a sync session.
"""
import logging
from datetime import datetime
from typing import Dict, Optional

import paramiko

logger = logging.getLogger("infraansible")


def _connect(*, ip_address: str, ssh_user: str, ssh_port: int, ssh_key_path: Optional[str]) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs = {"hostname": ip_address, "port": ssh_port, "username": ssh_user, "timeout": 10}
    if ssh_key_path:
        kwargs["key_filename"] = ssh_key_path
    ssh.connect(**kwargs)
    return ssh


def _run(ssh: paramiko.SSHClient, cmd: str) -> str:
    _stdin, stdout, _stderr = ssh.exec_command(cmd)
    return stdout.read().decode().strip()


def _clamp(value: str) -> Optional[float]:
    try:
        return round(min(max(float(value), 0.0), 100.0), 2)
    except (ValueError, TypeError):
        return None


def collect_metrics(
    *, ip_address: str, ssh_user: str, ssh_port: int = 22, ssh_key_path: Optional[str] = None,
) -> Dict[str, Optional[float]]:
    """Open a single SSH connection and collect CPU / memory / disk usage (%).

    Returns a dict with keys cpu_usage, memory_usage, disk_usage (values may be
    None if a particular metric could not be read). Raises on connection failure.
    """
    ssh = _connect(ip_address=ip_address, ssh_user=ssh_user, ssh_port=ssh_port, ssh_key_path=ssh_key_path)
    try:
        cpu = _clamp(_run(
            ssh, "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
        ))
        mem = _clamp(_run(ssh, "free | grep Mem | awk '{print ($3/$2) * 100.0}'"))
        disk = _clamp(_run(ssh, "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'"))
        return {"cpu_usage": cpu, "memory_usage": mem, "disk_usage": disk}
    finally:
        ssh.close()


def _apply_metrics(server, metrics: Dict[str, Optional[float]]) -> None:
    if metrics.get("cpu_usage") is not None:
        server.cpu_usage = metrics["cpu_usage"]
    if metrics.get("memory_usage") is not None:
        server.memory_usage = metrics["memory_usage"]
    if metrics.get("disk_usage") is not None:
        server.disk_usage = metrics["disk_usage"]
    server.last_monitored = datetime.utcnow()


def update_all_servers_sync(session) -> dict:
    """Celery-side refresh of every active server (sync DB session)."""
    from app.models import Server
    servers = session.query(Server).filter(Server.is_active.is_(True)).all()
    results = {}
    for server in servers:
        try:
            metrics = collect_metrics(
                ip_address=server.ip_address, ssh_user=server.ssh_user,
                ssh_port=server.ssh_port, ssh_key_path=server.ssh_key_path,
            )
            _apply_metrics(server, metrics)
            results[server.ip_address] = metrics
        except Exception as e:  # noqa: BLE001 — best-effort per server
            logger.warning(f"Metric refresh failed for {server.ip_address}: {e}")
            results[server.ip_address] = {"error": str(e)}
    session.commit()
    return results
