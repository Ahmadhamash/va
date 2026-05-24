import uuid
from datetime import datetime

from sqlalchemy import Integer, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class MessageDeliveryLog(Base):
    """Tracks every outbound message delivery attempt to external channels.

    Stores Meta API responses and error payloads so we can diagnose
    delivery failures (especially the Messenger audio bug).
    """

    __tablename__ = "message_delivery_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    # text | audio | image
    delivery_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # pending | sent | delivered | failed | fallback_text_sent
    status: Mapped[str] = mapped_column(
        String(30), default="pending", server_default="pending", index=True
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    meta_message_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    meta_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
