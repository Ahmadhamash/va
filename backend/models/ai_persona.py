import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AIPersonaSettings(Base):
    """Per-business AI personality and dialect configuration.

    Stores the Jordanian Arabic personality settings separately from the
    free-text ai_persona field on the User model, allowing structured
    configuration of dialect, tone, emoji level, and banned phrases.
    """

    __tablename__ = "ai_persona_settings"

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
    # jordanian | saudi | egyptian | syrian | msa
    dialect: Mapped[str] = mapped_column(
        String(20), default="jordanian", server_default="jordanian"
    )
    # friendly | professional | salesy
    tone: Mapped[str] = mapped_column(
        String(20), default="friendly", server_default="friendly"
    )
    # none | low | medium | high
    emoji_level: Mapped[str] = mapped_column(
        String(10), default="low", server_default="low"
    )
    # Business-specific banned phrases (JSON array of strings)
    banned_phrases: Mapped[dict] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    # Override default safe responses for specific scenarios
    custom_safe_responses: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
    personality_name: Mapped[str] = mapped_column(
        String(50), default="مساعد", server_default="مساعد"
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="ai_persona_settings")  # noqa: F821
