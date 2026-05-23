import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Integer, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PlatformSupportAgent(Base):
    """A platform employee who handles human handoff conversations.

    Distinct from the business owner (client role) — these are internal
    support agents from the platform company.
    """

    __tablename__ = "platform_support_agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_available: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    max_concurrent_handoffs: Mapped[int] = mapped_column(
        Integer, default=10, server_default="10"
    )
    # Optional: restrict to specific businesses (JSON array of UUIDs)
    assigned_businesses: Mapped[dict] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    # Skills for routing: ["arabic", "technical", "billing"]
    skills: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="support_agent_profile")  # noqa: F821


class HandoffSession(Base):
    """A conversation that has been handed off from AI to a human agent.

    Replaces/extends the old Escalation model with richer assignment,
    SLA tracking, and AI context.
    """

    __tablename__ = "handoff_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Business owner whose customer is being helped
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    reason_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    # low | normal | high | urgent
    priority: Mapped[str] = mapped_column(
        String(10), default="normal", server_default="normal"
    )
    # unassigned | assigned | waiting_customer | waiting_agent | resolved | returned_to_ai
    status: Mapped[str] = mapped_column(
        String(30), default="unassigned", server_default="unassigned", index=True
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggested_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_log_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_verification_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    session: Mapped["ChatSession"] = relationship()  # noqa: F821
    user: Mapped["User"] = relationship()  # noqa: F821
    assignments: Mapped[list["HandoffAssignment"]] = relationship(
        back_populates="handoff_session", cascade="all, delete-orphan"
    )


class HandoffAssignment(Base):
    """Assignment of a handoff session to a specific support agent."""

    __tablename__ = "handoff_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    handoff_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("handoff_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_support_agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(server_default=func.now())
    # manual | round_robin | least_active | priority
    assignment_method: Mapped[str] = mapped_column(
        String(20), default="manual", server_default="manual"
    )
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    handoff_session: Mapped["HandoffSession"] = relationship(
        back_populates="assignments"
    )
    agent: Mapped["PlatformSupportAgent"] = relationship()
