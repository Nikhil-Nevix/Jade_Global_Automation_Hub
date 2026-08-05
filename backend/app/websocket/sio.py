"""Socket.IO server (ASGI) for real-time job logs.

The web process runs the AsyncServer with a Redis manager so it can receive
events published by Celery workers (separate processes). The frontend connects
with socket.io-client and subscribes to a job room.
"""
import logging
import socketio

from app.core.config import settings
from app.core.security import decode_token

logger = logging.getLogger(__name__)

# Redis manager lets messages emitted from other processes (Celery) reach clients.
mgr = socketio.AsyncRedisManager(settings.REDIS_URL)

sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=mgr,
    cors_allowed_origins=settings.cors_origins_list,
    logger=False,
    engineio_logger=False,
)

# ASGI app to mount under /socket.io
socket_app = socketio.ASGIApp(sio, socketio_path="socket.io")

_authenticated: dict = {}  # sid -> user_id


def _extract_token(auth, environ) -> str | None:
    if auth and isinstance(auth, dict) and auth.get("token"):
        return auth["token"]
    qs = environ.get("QUERY_STRING", "") if environ else ""
    for part in qs.split("&"):
        if part.startswith("token="):
            return part.split("=", 1)[1]
    return None


@sio.event
async def connect(sid, environ, auth):
    token = _extract_token(auth, environ)
    if token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            _authenticated[sid] = payload.get("sub")
            await sio.emit("connected", {"status": "authenticated", "user_id": payload.get("sub")}, to=sid)
            return
    await sio.emit("connected", {"status": "connected", "authenticated": False}, to=sid)


@sio.event
async def disconnect(sid):
    _authenticated.pop(sid, None)


@sio.event
async def subscribe_job(sid, data):
    if sid not in _authenticated:
        await sio.emit("error", {"message": "Authentication required"}, to=sid)
        return
    job_id = (data or {}).get("job_id")
    if job_id is None:
        await sio.emit("error", {"message": "job_id required"}, to=sid)
        return
    await sio.enter_room(sid, f"job_{job_id}")
    await sio.emit("subscribed", {"job_id": job_id}, to=sid)


@sio.event
async def unsubscribe_job(sid, data):
    job_id = (data or {}).get("job_id")
    if job_id is not None:
        await sio.leave_room(sid, f"job_{job_id}")
