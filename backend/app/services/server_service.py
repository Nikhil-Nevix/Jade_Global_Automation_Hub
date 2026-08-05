from typing import Optional, List
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Server, Tag
from app.services import tagging_service


async def _load_tags(db: AsyncSession, tag_ids: List[int]) -> List[Tag]:
    if not tag_ids:
        return []
    result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
    return list(result.scalars().all())


def _apply_server_filters(stmt, *, is_active, os_type, search, tag_id, location):
    if is_active is not None:
        stmt = stmt.where(Server.is_active == is_active)
    if os_type:
        stmt = stmt.where(Server.os_type == os_type)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(Server.hostname.ilike(like), Server.ip_address.ilike(like)))
    if tag_id:
        stmt = stmt.where(Server.tags.any(Tag.id == tag_id))
    if location:
        stmt = stmt.where(Server.location == location)
    return stmt


async def list_servers(
    db: AsyncSession, *, is_active: Optional[bool] = None, os_type: Optional[str] = None,
    search: Optional[str] = None, tag_id: Optional[int] = None, location: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    stmt = _apply_server_filters(
        select(Server).options(selectinload(Server.tags)),
        is_active=is_active, os_type=os_type, search=search, tag_id=tag_id, location=location,
    )
    count_stmt = _apply_server_filters(
        select(func.count(Server.id)),
        is_active=is_active, os_type=os_type, search=search, tag_id=tag_id, location=location,
    )

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Server.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    servers = (await db.execute(stmt)).scalars().unique().all()
    return servers, total


async def list_locations(db: AsyncSession, *, is_active: Optional[bool] = True):
    """Distinct server locations with a count of servers in each, plus the overall
    total. Powers the scan interface's location dropdown / Select All."""
    stmt = select(Server.location, func.count(Server.id)).group_by(Server.location)
    if is_active is not None:
        stmt = stmt.where(Server.is_active == is_active)
    rows = (await db.execute(stmt)).all()
    locations = [
        {"location": loc, "server_count": cnt}
        for loc, cnt in rows if loc is not None
    ]
    locations.sort(key=lambda x: x["location"].lower())
    unassigned = sum(cnt for loc, cnt in rows if loc is None)
    total = sum(cnt for _, cnt in rows)
    return {"locations": locations, "unassigned": unassigned, "total": total}


async def server_ids_for_selection(
    db: AsyncSession, *, location: Optional[str] = None, is_active: Optional[bool] = True,
) -> List[int]:
    """All server IDs matching an optional location filter — the target set for
    the scan interface's Select All action."""
    stmt = select(Server.id)
    if is_active is not None:
        stmt = stmt.where(Server.is_active == is_active)
    if location:
        stmt = stmt.where(Server.location == location)
    return list((await db.execute(stmt)).scalars().all())


async def get_server(db: AsyncSession, server_id: int) -> Optional[Server]:
    result = await db.execute(
        select(Server).options(selectinload(Server.tags)).where(Server.id == server_id)
    )
    return result.scalar_one_or_none()


async def get_or_create_by_ip(db: AsyncSession, ip_address: str) -> Server:
    """Used by on-demand scans accepting brand-new IPs."""
    result = await db.execute(select(Server).where(Server.ip_address == ip_address))
    server = result.scalar_one_or_none()
    if server is None:
        server = Server(ip_address=ip_address, hostname=ip_address, is_active=True)
        server.tags = []
        db.add(server)
        await db.flush()
        # hostname == ip here, so the parser is a no-op, but keep the hook so a later
        # hostname update flows through the same path.
        await tagging_service.sync_server_tags(db, server)
    return server


async def create_server(db: AsyncSession, data) -> Server:
    existing = await db.execute(select(Server).where(Server.ip_address == data.ip_address))
    if existing.scalar_one_or_none() is not None:
        raise ValueError(f"Server with IP {data.ip_address} already exists")

    server = Server(
        ip_address=data.ip_address,
        hostname=data.hostname or data.ip_address,
        os_type=data.os_type,
        os_version=data.os_version,
        ssh_port=data.ssh_port,
        ssh_user=data.ssh_user,
        ssh_key_path=data.ssh_key_path,
        location=data.location,
        is_active=True,
    )
    server.tags = await _load_tags(db, data.tag_ids)
    db.add(server)
    await db.flush()
    # auto-derive environment/role/location group tags from the Marvel hostname
    await tagging_service.sync_server_tags(db, server)
    await db.commit()
    return await get_server(db, server.id)


async def update_server(db: AsyncSession, server: Server, data) -> Server:
    for field in ("hostname", "os_type", "os_version", "ssh_port", "ssh_user", "ssh_key_path", "location", "is_active"):
        value = getattr(data, field)
        if value is not None:
            setattr(server, field, value)
    if data.tag_ids is not None:
        server.tags = await _load_tags(db, data.tag_ids)
    await db.commit()
    return await get_server(db, server.id)


async def delete_server(db: AsyncSession, server: Server, hard: bool = False) -> None:
    if hard:
        await db.delete(server)
    else:
        server.is_active = False
    await db.commit()
