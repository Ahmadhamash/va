"""Handoff management router.

Endpoints for creating, assigning, resolving, and listing human handoff
sessions. Accessible by admins, support agents, and business owners.
"""
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import (
    ChatSession,
    HandoffAssignment,
    HandoffSession,
    PlatformSupportAgent,
    User,
)
from services import handoff_service
from services.auth_service import hash_password

logger = logging.getLogger("handoff_router")
router = APIRouter(prefix="/handoff", tags=["handoff"])


# ── Schemas ──────────────────────────────────────────────────────────────
class HandoffCreate(BaseModel):
    session_id: uuid.UUID
    reason: str
    reason_details: str | None = None
    priority: str = "normal"
    ai_summary: str | None = None
    ai_suggested_reply: str | None = None


class HandoffAssign(BaseModel):
    agent_id: uuid.UUID | None = None
    method: str = "manual"
    notes: str | None = None


class SupportAgentCreate(BaseModel):
    username: str
    email: str
    password: str
    display_name: str
    skills: list[str] = []
    max_concurrent_handoffs: int = 5


class HandoffResolve(BaseModel):
    return_to_ai: bool = False
    resolution_note: str | None = None


class AgentProfileUpdate(BaseModel):
    display_name: str | None = None
    is_available: bool | None = None
    max_concurrent_handoffs: int | None = None
    skills: list[str] | None = None


class HandoffOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID
    reason: str
    reason_details: str | None
    priority: str
    status: str
    ai_summary: str | None
    ai_suggested_reply: str | None
    created_at: str
    resolved_at: str | None

    class Config:
        from_attributes = True


def _normalize_status(status: str | None) -> str | None:
    aliases = {
        "pending": "unassigned",
        "in_progress": "waiting_agent",
    }
    return aliases.get(status or "", status)


def _api_status(status: str) -> str:
    aliases = {
        "unassigned": "pending",
        "waiting_agent": "in_progress",
        "waiting_customer": "in_progress",
        "returned_to_ai": "resolved",
    }
    return aliases.get(status, status)


async def _current_agent_id(
    current_user: User, db: AsyncSession
) -> uuid.UUID | None:
    profile = (
        await db.execute(
            select(PlatformSupportAgent).where(
                PlatformSupportAgent.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    return profile.id if profile else None


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("/")
async def list_handoffs(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List handoff sessions. Admins/agents see all; clients see their own."""
    agent_id = None
    business_id = None

    if current_user.role == "support_agent":
        agent_profile = (
            await db.execute(
                select(PlatformSupportAgent).where(
                    PlatformSupportAgent.user_id == current_user.id
                )
            )
        ).scalar_one_or_none()
        if agent_profile:
            agent_id = agent_profile.id
    elif current_user.role == "client":
        business_id = current_user.id

    handoffs = await handoff_service.get_pending_handoffs(
        db,
        agent_id=agent_id,
        business_id=business_id,
        status=_normalize_status(status),
    )
    return [
        {
            "id": str(h.id),
            "session_id": str(h.session_id),
            "user_id": str(h.user_id),
            "reason": h.reason,
            "reason_details": h.reason_details,
            "priority": h.priority,
            "status": _api_status(h.status),
            "ai_summary": h.ai_summary,
            "ai_suggested_reply": h.ai_suggested_reply,
            "sla_deadline": h.sla_deadline.isoformat() if h.sla_deadline else None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "resolved_at": h.resolved_at.isoformat() if h.resolved_at else None,
        }
        for h in handoffs
    ]


@router.post("/")
async def create_handoff(
    body: HandoffCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new handoff session."""
    session = await db.get(ChatSession, body.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.role == "client" and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    handoff = await handoff_service.create_handoff(
        session_id=body.session_id,
        user_id=session.user_id,
        reason=body.reason,
        db=db,
        reason_details=body.reason_details,
        priority=body.priority,
        ai_summary=body.ai_summary,
        ai_suggested_reply=body.ai_suggested_reply,
    )
    return {"id": str(handoff.id), "status": _api_status(handoff.status)}


@router.post("/{handoff_id}/assign")
async def assign_to_agent(
    handoff_id: uuid.UUID,
    body: HandoffAssign | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a handoff to a support agent."""
    if current_user.role not in ("admin", "support_agent"):
        raise HTTPException(status_code=403, detail="Not authorized")

    agent_id = body.agent_id if body else None
    if agent_id is None:
        agent_id = await _current_agent_id(current_user, db)
    if agent_id is None:
        raise HTTPException(status_code=400, detail="agent_id is required")

    assignment = await handoff_service.assign_handoff(
        handoff_id,
        agent_id,
        db,
        method=body.method if body else "manual",
        notes=body.notes if body else None,
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Handoff not found")
    return {"assignment_id": str(assignment.id), "status": "assigned"}


@router.post("/{handoff_id}/auto-assign")
async def auto_assign(
    handoff_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-assign a handoff to the best available agent."""
    if current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Not authorized")

    assignment = await handoff_service.auto_assign_handoff(handoff_id, db)
    if not assignment:
        raise HTTPException(
            status_code=409, detail="No available agents or handoff not found"
        )
    return {"assignment_id": str(assignment.id), "status": "assigned"}


@router.post("/{handoff_id}/resolve")
async def resolve(
    handoff_id: uuid.UUID,
    body: HandoffResolve,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a handoff session."""
    if current_user.role not in ("admin", "support_agent"):
        raise HTTPException(status_code=403, detail="Not authorized")

    handoff = await handoff_service.resolve_handoff(
        handoff_id, db, return_to_ai=body.return_to_ai
    )
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff not found")
    return {"status": handoff.status}


@router.get("/agents")
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all support agents (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(PlatformSupportAgent)
    agents = list((await db.execute(stmt)).scalars().all())
    return [
        {
            "id": str(a.id),
            "user_id": str(a.user_id),
            "display_name": a.display_name,
            "is_available": a.is_available,
            "max_concurrent_handoffs": a.max_concurrent_handoffs,
            "skills": a.skills,
        }
        for a in agents
    ]


@router.post("/agents")
async def create_agent(
    body: SupportAgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support agent (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check existing user
    from sqlalchemy import or_
    exists = await db.execute(
        select(User).where(or_(User.username == body.username, User.email == body.email))
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role="support_agent",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    profile = PlatformSupportAgent(
        user_id=user.id,
        display_name=body.display_name,
        is_available=True,
        skills=body.skills,
        max_concurrent_handoffs=body.max_concurrent_handoffs,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return {
        "id": str(profile.id),
        "user_id": str(user.id),
        "display_name": profile.display_name,
        "is_available": profile.is_available,
        "skills": profile.skills,
        "max_concurrent_handoffs": profile.max_concurrent_handoffs,
    }


@router.put("/agents/me")
async def update_my_agent_profile(
    body: AgentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current support agent's profile."""
    if current_user.role != "support_agent":
        raise HTTPException(status_code=403, detail="Not a support agent")

    profile = (
        await db.execute(
            select(PlatformSupportAgent).where(
                PlatformSupportAgent.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Agent profile not found")

    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.is_available is not None:
        profile.is_available = body.is_available
    if body.max_concurrent_handoffs is not None:
        profile.max_concurrent_handoffs = body.max_concurrent_handoffs
    if body.skills is not None:
        profile.skills = body.skills

    await db.commit()
    return {"status": "updated"}


@router.get("/sla-breached")
async def sla_breached(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get handoffs that have breached their SLA deadline."""
    if current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Not authorized")

    handoffs = await handoff_service.get_sla_breached_handoffs(db)
    return [
        {
            "id": str(h.id),
            "session_id": str(h.session_id),
            "reason": h.reason,
            "priority": h.priority,
            "status": h.status,
            "sla_deadline": h.sla_deadline.isoformat() if h.sla_deadline else None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in handoffs
    ]
