import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Integer, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AutomationRule(Base):
    """A no-code automation rule with trigger → conditions → actions.

    Replaces the simpler BusinessWorkflow model with a much richer
    automation engine supporting 20+ triggers, 15+ conditions, and
    20+ actions.
    """

    __tablename__ = "automation_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # new_message | customer_voice | customer_image | customer_link |
    # ask_price | ask_delivery | ask_human | angry_customer |
    # low_confidence | hallucination_risk | product_not_found |
    # product_out_of_stock | order_created | order_cancelled |
    # no_reply_timeout | outside_hours | conversation_tagged |
    # new_lead | keyword_detected | whatsapp_24h_expired
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    trigger_config: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )

    # Array of condition objects [{type, operator, value}]
    conditions: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")
    # Array of action objects [{type, config}]
    actions: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")
    # Template variable names used
    variables_used: Mapped[dict] = mapped_column(
        JSONB, default=list, server_default="[]"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    priority: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    prevent_loops: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    max_executions_per_conversation: Mapped[int] = mapped_column(
        Integer, default=3, server_default="3"
    )
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    template_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    runs: Mapped[list["AutomationRun"]] = relationship(
        back_populates="rule", cascade="all, delete-orphan"
    )


class AutomationRun(Base):
    """A single execution of an automation rule."""

    __tablename__ = "automation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("automation_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    trigger_matched: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    conditions_matched: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    conditions_evaluation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    actions_executed: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # success | partial | failed | skipped | dry_run
    status: Mapped[str] = mapped_column(
        String(20), default="success", server_default="success"
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_time_ms: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    rule: Mapped["AutomationRule"] = relationship(back_populates="runs")


class AutomationLog(Base):
    """Detailed step-by-step log for a single automation execution."""

    __tablename__ = "automation_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("automation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step: Mapped[str] = mapped_column(String(50), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    # info | warning | error
    level: Mapped[str] = mapped_column(
        String(10), default="info", server_default="info"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    run: Mapped["AutomationRun"] = relationship()
