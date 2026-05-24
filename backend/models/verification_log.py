import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, String, Text, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AIVerificationLog(Base):
    """Log of every AI answer verification decision.

    Every draft answer passes through the Answer Verifier before being sent.
    This table records the verifier's decision, risk score, and reasoning
    so we can audit every AI interaction.
    """

    __tablename__ = "ai_verification_logs"
    __table_args__ = (
        Index("idx_ai_verification_log_session_status", "session_id", "verifier_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    customer_message: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_data: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    draft_answer: Mapped[str] = mapped_column(Text, nullable=False)

    # SAFE_TO_SEND | NEEDS_MORE_DATA | ASK_CLARIFICATION |
    # HUMAN_HANDOFF_REQUIRED | BLOCKED_UNGROUNDED_ANSWER |
    # TOOL_RESULT_REQUIRED | MULTIMODAL_REVIEW_REQUIRED
    verifier_status: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    reasons: Mapped[dict] = mapped_column(JSONB, default=list, server_default="[]")
    flagged_claims: Mapped[dict] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    grounding_data_used: Mapped[dict] = mapped_column(
        JSONB, default=list, server_default="[]"
    )

    # sent | modified | blocked | handoff | clarification
    final_action: Mapped[str] = mapped_column(String(30), nullable=False)
    final_answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    session: Mapped["ChatSession"] = relationship()  # noqa: F821
