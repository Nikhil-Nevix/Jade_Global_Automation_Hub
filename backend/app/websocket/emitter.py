"""Write-only Socket.IO emitter for Celery workers (sync process).

Publishes events into the same Redis channel the AsyncServer listens on, so
job logs/status emitted from a Celery worker reach connected browsers.
"""
import socketio
from app.core.config import settings

_external_sio = socketio.RedisManager(settings.REDIS_URL, write_only=True)


def emit_job_log(job_id: int, log: dict) -> None:
    _external_sio.emit("job_log", log, room=f"job_{job_id}")


def emit_job_status(job_id: int, status: str, error_message: str | None = None) -> None:
    _external_sio.emit(
        "job_status",
        {"job_id": job_id, "status": status, "error_message": error_message},
        room=f"job_{job_id}",
    )


def emit_patches_ready(job_uuid: str, file_path: str) -> None:
    """Broadcast the interactive-patching prompt to all connected clients.

    The frontend registers a global `patches_ready` listener (App.tsx) rather than
    subscribing to a job room, so this is emitted without a room (matches the
    original InfraAnsible behaviour). Payload: {job_id: <uuid>, file_path}.
    """
    _external_sio.emit("patches_ready", {"job_id": job_uuid, "file_path": file_path})
