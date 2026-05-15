import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

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
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 'web' | 'messenger' | 'instagram' | 'webhook' | 'widget'
    channel: Mapped[str] = mapped_column(
        String(20), default="web", server_default="web", index=True
    )
    # platform-side end-user id (Messenger PSID, IG IGSID, widget anon id, …)
    external_user_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="chat_sessions")  # noqa: F821
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user|assistant|tool
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # text|image|audio
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tool_calls: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
