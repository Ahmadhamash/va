import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class VoiceSettings(Base):
    """Per-business voice configuration for STT/TTS pipeline."""

    __tablename__ = "voice_settings"

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
    # off | voice_when_voice | always_voice | text_and_voice
    voice_mode: Mapped[str] = mapped_column(
        String(30), default="off", server_default="off"
    )
    fallback_to_text: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    max_audio_duration_seconds: Mapped[int] = mapped_column(
        Integer, default=120, server_default="120"
    )
    preferred_voice: Mapped[str] = mapped_column(
        String(50), default="nova", server_default="nova"
    )
    # openai | elevenlabs | azure | google
    stt_provider: Mapped[str] = mapped_column(
        String(30), default="openai", server_default="openai"
    )
    tts_provider: Mapped[str] = mapped_column(
        String(30), default="openai", server_default="openai"
    )
    audio_format: Mapped[str] = mapped_column(
        String(10), default="mp3", server_default="mp3"
    )
    speech_speed: Mapped[float] = mapped_column(
        Float, default=1.0, server_default="1.0"
    )
    voice_personality: Mapped[str] = mapped_column(
        String(30), default="friendly", server_default="friendly"
    )
    # Provider-specific settings (API keys, voice IDs, etc.)
    stt_config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    tts_config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="voice_settings")  # noqa: F821
