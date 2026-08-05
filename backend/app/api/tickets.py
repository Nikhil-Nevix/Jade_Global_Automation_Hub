"""Support-ticket API (ported from InfraAnsible VM)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.deps import has_permission
from app.models import User
from app.schemas import TicketCreate, TicketUpdate, TicketOut, MessageResponse
from app.services import ticket_service

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("")
async def list_tickets(
    status: Optional[str] = None,
    mine: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Regular users only see their own tickets; admins see all (unless mine=True).
    created_by = current_user.id if (mine or not has_permission(current_user, "admin")) else None
    tickets, total = await ticket_service.list_tickets(
        db, status=status, created_by=created_by, page=page, per_page=per_page,
    )
    return {
        "items": [TicketOut.model_validate(t) for t in tickets],
        "pagination": {"page": page, "per_page": per_page, "total": total,
                       "pages": (total + per_page - 1) // per_page},
    }


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        ticket = await ticket_service.create_ticket(
            db, created_by=current_user.id, title=payload.title,
            description=payload.description, job_id=payload.job_id, priority=payload.priority,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return TicketOut.model_validate(ticket)


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.created_by != current_user.id and not has_permission(current_user, "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return TicketOut.model_validate(ticket)


@router.put("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.get_ticket(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if ticket.created_by != current_user.id and not has_permission(current_user, "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    ticket = await ticket_service.update_ticket(
        db, ticket, title=payload.title, description=payload.description,
        status=payload.status, priority=payload.priority,
    )
    return TicketOut.model_validate(ticket)
