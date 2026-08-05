import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import (
    auth, users, servers, tags, playbooks, jobs,
    vulnerability, notifications, superset,
    interactive_playbook, tickets,
)
from app.websocket.sio import socket_app

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger("infraansible")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if absent (Alembic remains the source of truth for migrations).
    try:
        import app.models  # noqa: F401  register models on Base.metadata
        from app.core.database import init_db
        await init_db()
    except Exception as e:
        logger.warning(f"DB init skipped (will rely on migrations): {e}")
    # Ensure the MinIO bucket exists at startup (best-effort).
    try:
        from app.services import minio_service
        minio_service.ensure_bucket()
    except Exception as e:
        logger.warning(f"MinIO bucket init skipped: {e}")
    yield


app = FastAPI(title="InfraAnsible API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(servers.router)
app.include_router(tags.router)
app.include_router(playbooks.router)
app.include_router(jobs.router)
app.include_router(interactive_playbook.router)
app.include_router(tickets.router)
app.include_router(vulnerability.router)
app.include_router(notifications.router)
app.include_router(superset.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "infraansible", "version": "2.0.0"}


# Mount Socket.IO ASGI app (real-time job logs) at /socket.io
app.mount("/socket.io", socket_app)
