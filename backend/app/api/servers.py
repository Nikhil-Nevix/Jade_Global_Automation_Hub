import asyncio
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import User, Server
from app.schemas import ServerCreate, ServerUpdate, ServerOut, TagOut, MessageResponse, ServerMetricsOut
from app.services import server_service, monitor_service

router = APIRouter(prefix="/api/servers", tags=["servers"])


def _to_out(server) -> ServerOut:
    out = ServerOut.model_validate(server)
    out.tags = [TagOut.model_validate(t) for t in server.tags]
    return out


@router.get("")
async def list_servers(
    is_active: Optional[bool] = None,
    os_type: Optional[str] = None,
    search: Optional[str] = None,
    tag_id: Optional[int] = None,
    location: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    servers, total = await server_service.list_servers(
        db, is_active=is_active, os_type=os_type, search=search,
        tag_id=tag_id, location=location, page=page, per_page=per_page,
    )
    return {
        "items": [_to_out(s) for s in servers],
        "pagination": {"page": page, "per_page": per_page, "total": total,
                       "pages": (total + per_page - 1) // per_page},
    }


@router.get("/locations")
async def list_server_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Distinct locations across active servers, each with a server count, plus the
    overall total. Feeds the scan interface's location dropdown / Select All."""
    return await server_service.list_locations(db)


@router.get("/ids")
async def list_server_ids(
    location: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """IDs of all active servers (optionally scoped to one location) — the target
    set behind the scan interface's Select All action."""
    ids = await server_service.server_ids_for_selection(db, location=location)
    return {"server_ids": ids, "count": len(ids)}


@router.post("/metrics/refresh")
async def refresh_all_metrics(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Refresh CPU/memory/disk metrics for every active server over SSH."""
    result = await db.execute(select(Server).where(Server.is_active.is_(True)))
    servers = result.scalars().all()
    updated = 0
    for server in servers:
        try:
            metrics = await asyncio.to_thread(
                monitor_service.collect_metrics,
                ip_address=server.ip_address, ssh_user=server.ssh_user,
                ssh_port=server.ssh_port, ssh_key_path=server.ssh_key_path,
            )
            monitor_service._apply_metrics(server, metrics)
            updated += 1
        except Exception:  # noqa: BLE001 — best effort per server
            continue
    await db.commit()
    return {"message": "Metrics refreshed", "updated": updated, "total": len(servers)}


@router.get("/{server_id}/metrics", response_model=ServerMetricsOut)
async def get_server_metrics(
    server_id: int,
    refresh: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest metrics for a server. When refresh=True (default), collect
    fresh values over SSH first; otherwise return the last stored snapshot."""
    server = await server_service.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    if refresh:
        try:
            metrics = await asyncio.to_thread(
                monitor_service.collect_metrics,
                ip_address=server.ip_address, ssh_user=server.ssh_user,
                ssh_port=server.ssh_port, ssh_key_path=server.ssh_key_path,
            )
            monitor_service._apply_metrics(server, metrics)
            await db.commit()
        except Exception as e:  # noqa: BLE001 — fall back to stored values
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail=f"Could not reach server: {e}")
    return ServerMetricsOut(
        server_id=server.id, cpu_usage=server.cpu_usage, memory_usage=server.memory_usage,
        disk_usage=server.disk_usage, last_monitored=server.last_monitored,
    )


@router.post("/{server_id}/test-connection")
async def test_connection(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify SSH connectivity to a server by collecting metrics once."""
    server = await server_service.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    try:
        await asyncio.to_thread(
            monitor_service.collect_metrics,
            ip_address=server.ip_address, ssh_user=server.ssh_user,
            ssh_port=server.ssh_port, ssh_key_path=server.ssh_key_path,
        )
        return {"success": True, "message": "Connection successful"}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "message": f"Connection failed: {e}"}


@router.get("/{server_id}", response_model=ServerOut)
async def get_server(server_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await server_service.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return _to_out(server)


@router.post("", response_model=ServerOut, status_code=status.HTTP_201_CREATED)
async def create_server(
    payload: ServerCreate,
    current_user: User = Depends(get_current_user),  # any authenticated user may add a server/IP
    db: AsyncSession = Depends(get_db),
):
    try:
        server = await server_service.create_server(db, payload)
        return _to_out(server)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{server_id}", response_model=ServerOut)
async def update_server(
    server_id: int,
    payload: ServerUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    server = await server_service.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return _to_out(await server_service.update_server(db, server, payload))


@router.delete("/{server_id}", response_model=MessageResponse)
async def delete_server(
    server_id: int,
    hard: bool = False,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    server = await server_service.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    await server_service.delete_server(db, server, hard=hard)
    return {"message": "Server deleted successfully"}
