import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import Escalation, User
from schemas.escalation import EscalationHandle, EscalationOut

router = APIRouter(prefix="/escalations", tags=["escalations"])


@router.get("", response_model=list[EscalationOut])
async def list_escalations(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Escalation)
        .where(Escalation.user_id == current_user.id)
        .order_by(Escalation.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Escalation.status == status_filter)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/count")
async def pending_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await db.scalar(
        select(func.count())
        .select_from(Escalation)
        .where(
            Escalation.user_id == current_user.id,
            Escalation.status == "pending",
        )
    )
    return {"pending": count or 0}


@router.patch("/{escalation_id}", response_model=EscalationOut)
async def handle_escalation(
    escalation_id: uuid.UUID,
    payload: EscalationHandle,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Escalation).where(
            Escalation.id == escalation_id,
            Escalation.user_id == current_user.id,
        )
    )
    esc = result.scalar_one_or_none()
    if esc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found"
        )
    esc.status = payload.status
    esc.handler_notes = payload.handler_notes
    esc.handled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(esc)
    return esc
