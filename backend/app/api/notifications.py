import asyncio
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, update, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models import User, Notification
from app.schemas import (
    NotificationOut, MessageResponse,
    NotificationPreferenceOut, NotificationPreferenceUpdate,
)
from app.services import notification_service, email_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    count_stmt = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)  # noqa: E712
        count_stmt = count_stmt.where(Notification.is_read == False)  # noqa: E712
    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    notifications = (await db.execute(stmt)).scalars().all()
    return {
        "notifications": [NotificationOut.model_validate(n) for n in notifications],
        "total": total, "limit": limit, "offset": offset,
    }


@router.get("/unread-count")
async def unread_count(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id, Notification.is_read == False  # noqa: E712
        )
    )).scalar_one()
    return {"count": count}


@router.get("/preferences", response_model=list[NotificationPreferenceOut])
async def get_preferences(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    prefs = await notification_service.get_preferences(db, current_user.id)
    return [NotificationPreferenceOut.model_validate(p) for p in prefs]


@router.put("/preferences/{event_type}", response_model=NotificationPreferenceOut)
async def update_preference(
    event_type: str,
    payload: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if event_type not in notification_service.EVENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown event type")
    pref = await notification_service.update_preference(
        db, current_user.id, event_type,
        in_app_enabled=payload.in_app_enabled, email_enabled=payload.email_enabled,
        browser_push_enabled=payload.browser_push_enabled,
    )
    return NotificationPreferenceOut.model_validate(pref)


@router.post("/test-email", response_model=MessageResponse)
async def send_test_email(current_user: User = Depends(get_current_user)):
    ok = await asyncio.to_thread(email_service.send_test_email, current_user.email)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not sent — check SMTP configuration (SMTP_ENABLED and credentials).",
        )
    return {"message": f"Test email sent to {current_user.email}"}


@router.get("/stream")
async def stream_notifications(token: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Server-Sent Events stream of new notifications for the authenticated user.

    EventSource can't set Authorization headers, so the access token is passed as
    a `token` query parameter.
    """
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")
    user_id = int(payload.get("sub"))

    # Establish a starting high-water mark so we only stream notifications created
    # after the connection opens.
    last_id = (await db.execute(
        select(func.coalesce(func.max(Notification.id), 0)).where(Notification.user_id == user_id)
    )).scalar_one()

    async def event_gen():
        nonlocal last_id
        while True:
            async with AsyncSessionLocal() as session:
                rows = (await session.execute(
                    select(Notification)
                    .where(Notification.user_id == user_id, Notification.id > last_id)
                    .order_by(Notification.id.asc())
                )).scalars().all()
                for n in rows:
                    last_id = n.id
                    yield f"data: {json.dumps(n.to_dict())}\n\n"
            yield ": keep-alive\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.put("/{notification_id}/read", response_model=MessageResponse)
async def mark_read(notification_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )).scalar_one_or_none()
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    n.mark_as_read()
    await db.commit()
    return {"message": "Marked as read"}


@router.put("/read-all", response_model=MessageResponse)
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Notification).where(
            Notification.user_id == current_user.id, Notification.is_read == False  # noqa: E712
        ).values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/read-all", response_model=MessageResponse)
async def delete_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        sql_delete(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == True,  # noqa: E712
        )
    )
    await db.commit()
    return {"message": f"{result.rowcount} read notification(s) deleted"}


@router.delete("/{notification_id}", response_model=MessageResponse)
async def delete_notification(notification_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )).scalar_one_or_none()
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    await db.delete(n)
    await db.commit()
    return {"message": "Notification deleted"}
