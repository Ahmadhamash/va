import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Escalation(Base):
    """A conversation escalated to a human agent.

    Created when the AI determines it cannot safely handle a customer
    interaction (angry customer, return request, payment issue, etc.).
    """

    __tablename__ = "escalations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'pending' | 'handled' | 'dismissed'
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    handled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    handler_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="escalations")  # noqa: F821
    session: Mapped["ChatSession"] = relationship()  # noqa: F821
