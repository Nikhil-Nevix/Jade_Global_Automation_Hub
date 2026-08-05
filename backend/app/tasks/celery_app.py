from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "infraansible",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.job_tasks", "app.tasks.vuln_tasks", "app.tasks.monitor_tasks"],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
)

# Scheduled background jobs.
celery_app.conf.beat_schedule = {
    # Vulnerability scan — every hour on all active servers.
    "hourly-vulnerability-scan": {
        "task": "app.tasks.vuln_tasks.run_scheduled_scan",
        "schedule": float(settings.VULN_SCAN_INTERVAL_SECONDS),
    },
    # Server metrics refresh — every 5 minutes (best-effort; skips unreachable hosts).
    "server-metrics-refresh": {
        "task": "app.tasks.monitor_tasks.refresh_all_server_metrics",
        "schedule": float(settings.SERVER_METRICS_INTERVAL_SECONDS),
    },
}
