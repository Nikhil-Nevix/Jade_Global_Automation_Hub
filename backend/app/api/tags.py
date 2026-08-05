from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import Tag, Server, server_tags
from app.schemas import TagCreate, TagUpdate, TagOut, MessageResponse
from app.services import tagging_service

router = APIRouter(prefix="/api/tags", tags=["tags"])


async def _tag_out(db: AsyncSession, tag: Tag, count: Optional[int] = None) -> TagOut:
    if count is None:
        count = (await db.execute(
            select(func.count()).select_from(server_tags).where(server_tags.c.tag_id == tag.id)
        )).scalar_one()
    out = TagOut.model_validate(tag)
    out.server_count = count
    return out


@router.get("")
async def list_tags(
    category: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tags (optionally scoped to one category), each with a server count.
    Ordered by category then name so the UI can render grouped chips."""
    stmt = select(Tag)
    if category:
        stmt = stmt.where(Tag.category == category)
    stmt = stmt.order_by(Tag.category.nulls_last(), Tag.name)
    tags = (await db.execute(stmt)).scalars().all()
    # one grouped count query instead of N per-tag queries
    counts = dict((await db.execute(
        select(server_tags.c.tag_id, func.count()).group_by(server_tags.c.tag_id)
    )).all())
    return {"items": [await _tag_out(db, t, counts.get(t.id, 0)) for t in tags]}


@router.post("/sync", response_model=MessageResponse)
async def sync_tags(
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Re-derive environment/role/location group tags for every server from the
    Marvel hostname convention. Idempotent — safe to re-run."""
    summary = await tagging_service.backfill_all(db)
    return {"message": (
        f"Synced {summary['servers_updated']}/{summary['servers_processed']} servers, "
        f"+{summary['associations_added']} associations, "
        f"{summary['category_tags']} category tags."
    )}


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(select(Tag).where(Tag.name == payload.name))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tag name already exists")
    tag = Tag(name=payload.name, description=payload.description,
              category=payload.category, created_by=current_user.id)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return await _tag_out(db, tag)


@router.put("/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: int,
    payload: TagUpdate,
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tag = (await db.execute(select(Tag).where(Tag.id == tag_id))).scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    if payload.name is not None:
        tag.name = payload.name
    if payload.description is not None:
        tag.description = payload.description
    if payload.category is not None:
        tag.category = payload.category
    await db.commit()
    await db.refresh(tag)
    return await _tag_out(db, tag)


@router.delete("/{tag_id}", response_model=MessageResponse)
async def delete_tag(
    tag_id: int,
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tag = (await db.execute(select(Tag).where(Tag.id == tag_id))).scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
    return {"message": "Tag deleted successfully"}


@router.post("/{tag_id}/servers", response_model=MessageResponse)
async def add_servers_to_tag(
    tag_id: int,
    server_ids: list[int],
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tag = (await db.execute(
        select(Tag).options(selectinload(Tag.servers)).where(Tag.id == tag_id)
    )).scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    servers = (await db.execute(select(Server).where(Server.id.in_(server_ids)))).scalars().all()
    existing_ids = {s.id for s in tag.servers}
    for s in servers:
        if s.id not in existing_ids:
            tag.servers.append(s)
    await db.commit()
    return {"message": f"Added {len(servers)} server(s) to tag"}


@router.delete("/{tag_id}/servers/{server_id}", response_model=MessageResponse)
async def remove_server_from_tag(
    tag_id: int,
    server_id: int,
    current_user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tag = (await db.execute(
        select(Tag).options(selectinload(Tag.servers)).where(Tag.id == tag_id)
    )).scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    tag.servers = [s for s in tag.servers if s.id != server_id]
    await db.commit()
    return {"message": "Server removed from tag"}
