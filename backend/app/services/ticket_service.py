"""Support-ticket service (ported from InfraAnsible VM). Tickets can be raised
standalone or from a failed/attention-needing job."""
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ticket, Job


async def create_ticket(
    db: AsyncSession, *, created_by: int, title: str,
    description: Optional[str] = None, job_id: Optional[int] = None,
    priority: str = "medium",
) -> Ticket:
    if job_id is not None:
        job = await db.get(Job, job_id)
        if job is None:
            raise ValueError("Job not found")
    ticket = Ticket(
        ticket_id=str(uuid.uuid4()),
        created_by=created_by,
        title=title,
        description=description,
        job_id=job_id,
        priority=priority if priority in ("low", "medium", "high", "critical") else "medium",
        status="open",
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def list_tickets(
    db: AsyncSession, *, status: Optional[str] = None, created_by: Optional[int] = None,
    page: int = 1, per_page: int = 20,
) -> Tuple[List[Ticket], int]:
    query = select(Ticket)
    count_q = select(func.count()).select_from(Ticket)
    if status:
        query = query.where(Ticket.status == status)
        count_q = count_q.where(Ticket.status == status)
    if created_by is not None:
        query = query.where(Ticket.created_by == created_by)
        count_q = count_q.where(Ticket.created_by == created_by)
    total = (await db.execute(count_q)).scalar_one()
    query = query.order_by(Ticket.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    tickets = (await db.execute(query)).scalars().all()
    return tickets, total


async def get_ticket(db: AsyncSession, ticket_id: int) -> Optional[Ticket]:
    return await db.get(Ticket, ticket_id)


async def update_ticket(
    db: AsyncSession, ticket: Ticket, *, title: Optional[str] = None,
    description: Optional[str] = None, status: Optional[str] = None,
    priority: Optional[str] = None,
) -> Ticket:
    if title is not None:
        ticket.title = title
    if description is not None:
        ticket.description = description
    if priority is not None:
        ticket.priority = priority
    if status is not None:
        ticket.status = status
        if status in ("resolved", "closed") and ticket.resolved_at is None:
            ticket.resolved_at = datetime.utcnow()
        if status not in ("resolved", "closed"):
            ticket.resolved_at = None
    await db.commit()
    await db.refresh(ticket)
    return ticket
