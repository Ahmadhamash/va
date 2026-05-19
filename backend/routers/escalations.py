import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import ChannelIntegration, ChatSession, Escalation, Message, User
from schemas.escalation import EscalationHandle, EscalationOut
from services.ai_service import save_message
from services.messaging_service import send_meta_message

router = APIRouter(prefix="/escalations", tags=["escalations"])


class AgentReplyPayload(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


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
    esc.handled_at = datetime.utcnow()
    await db.commit()
    await db.refresh(esc)
    return esc


# ─── Human Agent Reply ───────────────────────────────────────────────────────
@router.post("/{escalation_id}/reply")
async def agent_reply(
    escalation_id: uuid.UUID,
    payload: AgentReplyPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a human agent reply to the customer via the original channel."""
    # 1. Find the escalation
    result = await db.execute(
        select(Escalation).where(
            Escalation.id == escalation_id,
            Escalation.user_id == current_user.id,
        )
    )
    esc = result.scalar_one_or_none()
    if esc is None:
        raise HTTPException(status_code=404, detail="Escalation not found")

    # 2. Get the session
    session = await db.get(ChatSession, esc.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # 3. Save the agent message to the conversation history
    await save_message(
        session.id, "assistant", payload.message, "text", None, db,
    )

    # 4. Send to the customer via Messenger/Instagram if applicable
    sent = False
    if session.channel in ("messenger", "instagram") and session.external_user_id:
        # Find the active channel integration
        int_result = await db.execute(
            select(ChannelIntegration).where(
                ChannelIntegration.user_id == current_user.id,
                ChannelIntegration.platform == session.channel,
                ChannelIntegration.is_active.is_(True),
            )
        )
        integration = int_result.scalar_one_or_none()
        if integration:
            token = (integration.credentials or {}).get("page_access_token", "")
            await send_meta_message(
                token, session.external_user_id, payload.message, session.channel
            )
            sent = True

    return {
        "status": "sent" if sent else "saved",
        "channel": session.channel,
        "message": "تم إرسال الرد للزبون" if sent else "تم حفظ الرد (القناة لا تدعم الإرسال المباشر)",
    }


# ─── Release session back to AI ─────────────────────────────────────────────
@router.post("/{escalation_id}/release")
async def release_to_ai(
    escalation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Release the session back to AI auto-reply mode."""
    result = await db.execute(
        select(Escalation).where(
            Escalation.id == escalation_id,
            Escalation.user_id == current_user.id,
        )
    )
    esc = result.scalar_one_or_none()
    if esc is None:
        raise HTTPException(status_code=404, detail="Escalation not found")

    # Mark escalation as handled
    esc.status = "handled"
    esc.handled_at = datetime.utcnow()

    # Release session back to AI
    session = await db.get(ChatSession, esc.session_id)
    if session:
        session.is_escalated = False

    await db.commit()
    return {"status": "released", "message": "تم إرجاع المحادثة للمساعد الذكي"}
