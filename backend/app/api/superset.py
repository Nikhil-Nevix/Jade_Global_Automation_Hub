from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.models import User
from app.schemas import SupersetTokenResponse
from app.schemas.schemas import SupersetCustomizeResponse
from app.services import superset_service
from app.services.superset_service import SupersetError

router = APIRouter(prefix="/api/superset", tags=["superset"])


@router.get("/guest-token", response_model=SupersetTokenResponse)
async def guest_token(
    run_id: Optional[int] = Query(None, description="Scope the embedded dashboard to a specific scan run via RLS"),
    current_user: User = Depends(get_current_user),
):
    """Issue a short-lived Superset guest token for the embedded Vulnerability
    Dashboard. Resolves to the customer's private dashboard if they have one.
    When run_id is provided, an RLS clause is injected so all charts filter to that scan."""
    try:
        token, embed_uuid = await superset_service.generate_guest_token(
            current_user.email, email=current_user.email, run_id=run_id
        )
    except SupersetError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return SupersetTokenResponse(
        token=token,
        dashboard_id=embed_uuid,
        superset_domain=settings.SUPERSET_PUBLIC_URL,
    )


@router.get("/customize", response_model=SupersetCustomizeResponse)
async def customize(current_user: User = Depends(get_current_user)):
    """Provision (idempotently) the customer's Superset account + private editable
    dashboard, returning what the frontend needs to open the Superset editor."""
    try:
        ws = await superset_service.ensure_customer_workspace(
            email=current_user.email, first=current_user.username
        )
    except SupersetError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    return SupersetCustomizeResponse(**ws)
