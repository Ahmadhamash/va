import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crypto import EncryptedJSONB
from database import Base


class VapiCallSettings(Base):
    """Per-tenant Vapi voice-call configuration."""

    __tablename__ = "vapi_call_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    public_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(30), default="draft", server_default="draft")

    # Vapi resources. The MVP can use a shared assistant with dynamic variables,
    # while later phases may provision one assistant per tenant.
    assistant_strategy: Mapped[str] = mapped_column(
        String(30), default="shared", server_default="shared"
    )
    assistant_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    webhook_credential_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    language: Mapped[str] = mapped_column(String(20), default="ar", server_default="ar")
    dialect: Mapped[str] = mapped_column(
        String(80), default="Jordanian / Levantine", server_default="Jordanian / Levantine"
    )
    handoff_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    business_hours: Mapped[str | None] = mapped_column(Text, nullable=True)

    model_provider: Mapped[str] = mapped_column(
        String(40), default="openai", server_default="openai"
    )
    model_name: Mapped[str] = mapped_column(String(80), default="gpt-4o", server_default="gpt-4o")
    voice_provider: Mapped[str] = mapped_column(String(40), default="vapi", server_default="vapi")
    voice_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recording_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    config: Mapped[dict] = mapped_column(EncryptedJSONB, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821


class VoiceCall(Base):
    """A Vapi phone/web voice call linked to a tenant and optional chat session."""

    __tablename__ = "voice_calls"

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
    call_setting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vapi_call_settings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chat_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    vapi_call_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    assistant_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    phone_number_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    direction: Mapped[str] = mapped_column(String(20), default="inbound", server_default="inbound")
    status: Mapped[str] = mapped_column(String(30), default="received", server_default="received", index=True)

    customer_phone: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ended_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)

    recording_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    intent: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String(40), nullable=True)
    needs_followup: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    order_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    structured_data: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    artifact: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    call_setting: Mapped["VapiCallSettings"] = relationship()
    chat_session: Mapped["ChatSession"] = relationship()  # noqa: F821


class VoiceCallEvent(Base):
    """Raw Vapi server event stored for audit and replay/debugging."""

    __tablename__ = "voice_call_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    voice_call_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voice_calls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    vapi_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(EncryptedJSONB, default=dict, server_default="{}")
    received_at: Mapped[datetime] = mapped_column(server_default=func.now())

    voice_call: Mapped["VoiceCall"] = relationship()
    user: Mapped["User"] = relationship()  # noqa: F821


class VoiceToolCall(Base):
    """Tool-call audit trail with idempotency by Vapi toolCallId."""

    __tablename__ = "voice_tool_calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    voice_call_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voice_calls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_call_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    arguments: Mapped[dict] = mapped_column(EncryptedJSONB, default=dict, server_default="{}")
    result: Mapped[dict] = mapped_column(EncryptedJSONB, default=dict, server_default="{}")
    success: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    voice_call: Mapped["VoiceCall"] = relationship()
    user: Mapped["User"] = relationship()  # noqa: F821


class VoiceLead(Base):
    """Order/lead captured during a voice call before a full order system exists."""

    __tablename__ = "voice_leads"

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
    voice_call_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voice_calls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    size: Mapped[str | None] = mapped_column(String(80), nullable=True)
    color: Mapped[str | None] = mapped_column(String(80), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new", server_default="new", index=True)
    product_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    confirmation_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    voice_call: Mapped["VoiceCall"] = relationship()
    product: Mapped["Item"] = relationship()  # noqa: F821
