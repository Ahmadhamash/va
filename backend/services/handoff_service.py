"""Human handoff service.

Manages the lifecycle of handing conversations from AI to human support agents.
Replaces/extends the existing simple Escalation model with:
- Agent assignment (manual, round-robin, least-active, priority-based)
- SLA tracking
- AI conversation summary
- Backward compatibility with existing escalation system
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    ChatSession,
    Escalation,
    HandoffAssignment,
    HandoffSession,
    PlatformSupportAgent,
)

logger = logging.getLogger("handoff")

# Default SLA: 30 minutes
DEFAULT_SLA_MINUTES = 30
MAX_REASON_LENGTH = 100

# Priority-based SLA multipliers
SLA_MULTIPLIERS = {
    "urgent": 0.25,  # 7.5 minutes
    "high": 0.5,     # 15 minutes
    "normal": 1.0,   # 30 minutes
    "low": 2.0,      # 60 minutes
}


def _fit_reason(reason: str | None) -> tuple[str, str | None]:
    original = (reason or "unspecified").strip() or "unspecified"
    if len(original) <= MAX_REASON_LENGTH:
        return original, None
    return original[: MAX_REASON_LENGTH - 3].rstrip() + "...", original


def _append_full_reason(
    reason_details: str | None, full_reason: str | None
) -> str | None:
    if not full_reason:
        return reason_details
    full_reason_note = f"Full reason: {full_reason}"
    if reason_details:
        return f"{full_reason_note}\n\n{reason_details}"
    return full_reason_note


def _utcnow() -> datetime:
    return datetime.utcnow()


async def create_handoff(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    reason: str,
    db: AsyncSession,
    *,
    reason_details: str | None = None,
    priority: str = "normal",
    ai_summary: str | None = None,
    ai_suggested_reply: str | None = None,
    verification_log_id: uuid.UUID | None = None,
) -> HandoffSession:
    """Create a new handoff session and mark the chat as escalated.

    Also creates a backward-compatible Escalation record.
    """
    reason, full_reason = _fit_reason(reason)
    reason_details = _append_full_reason(reason_details, full_reason)

    # Mark the chat session as escalated
    session = await db.get(ChatSession, session_id)
    if session:
        session.is_escalated = True

    # Calculate SLA deadline
    multiplier = SLA_MULTIPLIERS.get(priority, 1.0)
    sla_deadline = _utcnow() + timedelta(
        minutes=DEFAULT_SLA_MINUTES * multiplier
    )

    handoff = HandoffSession(
        session_id=session_id,
        user_id=user_id,
        reason=reason,
        reason_details=reason_details,
        priority=priority,
        status="unassigned",
        ai_summary=ai_summary,
        ai_suggested_reply=ai_suggested_reply,
        verification_log_id=verification_log_id,
        sla_deadline=sla_deadline,
    )
    db.add(handoff)

    # Backward compatibility: also create an Escalation record
    escalation = Escalation(
        user_id=user_id,
        session_id=session_id,
        reason=reason,
        details=reason_details,
        status="pending",
    )
    db.add(escalation)

    try:
        await db.commit()
        await db.refresh(handoff)
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Handoff created: id=%s session=%s reason='%s' priority=%s sla=%s",
        handoff.id,
        session_id,
        reason,
        priority,
        sla_deadline.isoformat(),
    )
    return handoff


async def assign_handoff(
    handoff_id: uuid.UUID,
    agent_id: uuid.UUID,
    db: AsyncSession,
    *,
    method: str = "manual",
    notes: str | None = None,
) -> HandoffAssignment | None:
    """Assign a handoff to a specific support agent."""
    handoff = await db.get(HandoffSession, handoff_id)
    if not handoff:
        return None

    assignment = HandoffAssignment(
        handoff_session_id=handoff_id,
        agent_id=agent_id,
        assignment_method=method,
        internal_notes=notes,
    )
    db.add(assignment)
    handoff.status = "assigned"
    await db.commit()
    await db.refresh(assignment)

    logger.info(
        "Handoff %s assigned to agent %s via %s",
        handoff_id,
        agent_id,
        method,
    )
    return assignment


async def auto_assign_handoff(
    handoff_id: uuid.UUID,
    db: AsyncSession,
    *,
    method: str = "least_active",
) -> HandoffAssignment | None:
    """Auto-assign a handoff using the specified method.

    Methods:
    - round_robin: next available agent
    - least_active: agent with fewest active handoffs
    - priority: agent with matching skills
    """
    handoff = await db.get(HandoffSession, handoff_id)
    if not handoff:
        return None

    # Find available agents
    agents_stmt = select(PlatformSupportAgent).where(
        PlatformSupportAgent.is_available.is_(True)
    )
    agents = list((await db.execute(agents_stmt)).scalars().all())

    if not agents:
        logger.warning("No available agents for handoff %s", handoff_id)
        return None

    if method == "least_active":
        # Count active assignments per agent
        best_agent = None
        min_count = float("inf")
        for agent in agents:
            count_stmt = (
                select(func.count())
                .select_from(HandoffAssignment)
                .join(HandoffSession)
                .where(
                    HandoffAssignment.agent_id == agent.id,
                    HandoffAssignment.resolved_at.is_(None),
                    HandoffSession.status.in_(["assigned", "waiting_customer", "waiting_agent"]),
                )
            )
            count = (await db.execute(count_stmt)).scalar() or 0
            if count < min_count and count < agent.max_concurrent_handoffs:
                min_count = count
                best_agent = agent

        if best_agent:
            return await assign_handoff(
                handoff_id, best_agent.id, db, method=method
            )

    elif method == "round_robin":
        # Pick the agent who was assigned least recently
        for agent in agents:
            count_stmt = (
                select(func.count())
                .select_from(HandoffAssignment)
                .where(
                    HandoffAssignment.agent_id == agent.id,
                    HandoffAssignment.resolved_at.is_(None),
                )
            )
            count = (await db.execute(count_stmt)).scalar() or 0
            if count < agent.max_concurrent_handoffs:
                return await assign_handoff(
                    handoff_id, agent.id, db, method=method
                )

    logger.warning("Could not auto-assign handoff %s — all agents at capacity", handoff_id)
    return None


async def resolve_handoff(
    handoff_id: uuid.UUID,
    db: AsyncSession,
    *,
    return_to_ai: bool = False,
) -> HandoffSession | None:
    """Resolve a handoff session."""
    handoff = await db.get(HandoffSession, handoff_id)
    if not handoff:
        return None

    now = _utcnow()
    handoff.status = "returned_to_ai" if return_to_ai else "resolved"
    handoff.resolved_at = now

    # Resolve active assignments
    assignments_stmt = select(HandoffAssignment).where(
        HandoffAssignment.handoff_session_id == handoff_id,
        HandoffAssignment.resolved_at.is_(None),
    )
    assignments = list((await db.execute(assignments_stmt)).scalars().all())
    for assignment in assignments:
        assignment.resolved_at = now

    # Un-escalate the chat session if returning to AI
    if return_to_ai:
        session = await db.get(ChatSession, handoff.session_id)
        if session:
            session.is_escalated = False

    # Update backward-compatible Escalation record
    esc_stmt = select(Escalation).where(
        Escalation.session_id == handoff.session_id,
        Escalation.status == "pending",
    )
    esc = (await db.execute(esc_stmt)).scalar_one_or_none()
    if esc:
        esc.status = "handled"
        esc.handled_at = now

    await db.commit()
    await db.refresh(handoff)

    logger.info(
        "Handoff %s resolved (return_to_ai=%s)", handoff_id, return_to_ai
    )
    return handoff


async def get_pending_handoffs(
    db: AsyncSession,
    *,
    agent_id: uuid.UUID | None = None,
    business_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[HandoffSession]:
    """Get handoff sessions with optional filters."""
    stmt = select(HandoffSession)

    if status:
        stmt = stmt.where(HandoffSession.status == status)
    else:
        stmt = stmt.where(
            HandoffSession.status.in_(
                ["unassigned", "assigned", "waiting_customer", "waiting_agent"]
            )
        )

    if business_id:
        stmt = stmt.where(HandoffSession.user_id == business_id)

    if agent_id:
        stmt = stmt.join(HandoffAssignment).where(
            HandoffAssignment.agent_id == agent_id
        )

    stmt = stmt.order_by(
        HandoffSession.priority.desc(),
        HandoffSession.created_at.asc(),
    )

    return list((await db.execute(stmt)).scalars().all())


async def get_sla_breached_handoffs(db: AsyncSession) -> list[HandoffSession]:
    """Get handoffs that have breached their SLA deadline."""
    now = _utcnow()
    stmt = select(HandoffSession).where(
        HandoffSession.sla_deadline < now,
        HandoffSession.status.in_(["unassigned", "assigned"]),
    )
    return list((await db.execute(stmt)).scalars().all())
