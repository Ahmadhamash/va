import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class StyleSample(Base):
    """A representative example of how the client personally talks.

    Extracted from conversation history the client uploads. Injected into the
    system prompt so the AI mimics their *voice* — never their *facts*.
    """

    __tablename__ = "style_samples"

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
    source: Mapped[str] = mapped_column(String(50), default="upload")
    sample: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="style_samples")  # noqa: F821


class ChannelIntegration(Base):
    """Per-client connection to an external messaging platform."""

    __tablename__ = "channel_integrations"

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
    # 'messenger' | 'instagram' | 'webhook' | 'widget'
    platform: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Public, unguessable id used to route inbound webhook/widget traffic
    public_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    # Secrets: page_access_token, app_secret, verify_token, webhook_secret, …
    credentials: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="channel_integrations"
    )
