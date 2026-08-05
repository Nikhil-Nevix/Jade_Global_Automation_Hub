"""Celery task: periodic server metrics refresh (ported from InfraAnsible VM)."""
import logging

from app.tasks.celery_app import celery_app
from app.core.sync_db import get_sync_session
from app.services import monitor_service

logger = logging.getLogger("infraansible")


@celery_app.task(name="app.tasks.monitor_tasks.refresh_all_server_metrics")
def refresh_all_server_metrics():
    """Refresh CPU/memory/disk metrics for all active servers (best-effort)."""
    with get_sync_session() as session:
        results = monitor_service.update_all_servers_sync(session)
    ok = sum(1 for v in results.values() if "error" not in v)
    logger.info(f"Server metrics refresh: {ok}/{len(results)} succeeded")
    return {"total": len(results), "succeeded": ok}
