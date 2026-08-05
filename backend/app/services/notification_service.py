"""Notification service (ported from InfraAnsible VM).

Creates in-app notifications and fans them out to the channels enabled in the
user's preferences (in-app always stored; email via SMTP; browser-push via the
Socket.IO emitter). Provides a sync path for Celery workers and async helpers for
the preferences API.
"""
import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationPreference, User
from app.services import email_service

logger = logging.getLogger("infraansible")

# Event types users can tune preferences for.
EVENT_TYPES: List[str] = [
    "job_success", "job_failure", "batch_complete", "server_failure",
    "high_cpu", "user_change", "playbook_update", "system_alert",
]

DEFAULT_SEVERITY = {
    "job_success": "info", "job_failure": "error", "batch_complete": "info",
    "server_failure": "error", "high_cpu": "warning", "user_change": "info",
    "playbook_update": "info", "system_alert": "warning",
}


# ─── Sync path (Celery workers) ───────────────────────────────────────────────

def _get_pref_sync(session, user_id: int, event_type: str) -> NotificationPreference:
    pref = (
        session.query(NotificationPreference)
        .filter(NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type)
        .first()
    )
    if pref is None:
        pref = NotificationPreference(user_id=user_id, event_type=event_type,
                                      in_app_enabled=True, email_enabled=False,
                                      browser_push_enabled=False)
        session.add(pref)
        session.flush()
    return pref


def create_notification_sync(
    session, *, user_id: int, event_type: str, title: str, message: str,
    severity: Optional[str] = None, related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None, extra_data: Optional[dict] = None,
) -> Optional[Notification]:
    """Create a notification honoring the user's channel preferences (sync)."""
    severity = severity or DEFAULT_SEVERITY.get(event_type, "info")
    pref = _get_pref_sync(session, user_id, event_type)
    channels_sent = {}

    notif = None
    if pref.in_app_enabled:
        notif = Notification(
            user_id=user_id, type=event_type, event_type=event_type, title=title,
            message=message, severity=severity, related_entity_type=related_entity_type,
            related_entity_id=related_entity_id, extra_data=extra_data,
        )
        session.add(notif)
        channels_sent["in_app"] = True

    if pref.email_enabled:
        user = session.get(User, user_id)
        if user and user.email:
            ok = email_service.send_notification_email(user.email, title, message, severity, event_type)
            channels_sent["email"] = ok

    if pref.browser_push_enabled:
        try:
            from app.websocket.emitter import _external_sio
            _external_sio.emit("notification", {"title": title, "message": message,
                                                "severity": severity, "event_type": event_type},
                               room=f"user_{user_id}")
            channels_sent["browser_push"] = True
        except Exception as e:  # noqa: BLE001
            logger.debug(f"browser push emit failed: {e}")

    if notif is not None:
        notif.channels_sent = channels_sent
    session.flush()
    return notif


# ─── Async helpers (preferences API) ──────────────────────────────────────────

async def get_preferences(db: AsyncSession, user_id: int) -> List[NotificationPreference]:
    """Return the user's preferences, creating defaults for any missing event type."""
    existing = (await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )).scalars().all()
    by_event = {p.event_type: p for p in existing}
    created = False
    for et in EVENT_TYPES:
        if et not in by_event:
            pref = NotificationPreference(user_id=user_id, event_type=et,
                                          in_app_enabled=True, email_enabled=False,
                                          browser_push_enabled=False)
            db.add(pref)
            by_event[et] = pref
            created = True
    if created:
        await db.commit()
    return [by_event[et] for et in EVENT_TYPES]


async def update_preference(
    db: AsyncSession, user_id: int, event_type: str, *,
    in_app_enabled: Optional[bool] = None, email_enabled: Optional[bool] = None,
    browser_push_enabled: Optional[bool] = None,
) -> NotificationPreference:
    pref = (await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    )).scalar_one_or_none()
    if pref is None:
        pref = NotificationPreference(user_id=user_id, event_type=event_type)
        db.add(pref)
    if in_app_enabled is not None:
        pref.in_app_enabled = in_app_enabled
    if email_enabled is not None:
        pref.email_enabled = email_enabled
    if browser_push_enabled is not None:
        pref.browser_push_enabled = browser_push_enabled
    await db.commit()
    await db.refresh(pref)
    return pref
