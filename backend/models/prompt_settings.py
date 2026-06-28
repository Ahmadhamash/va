import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ClientPromptSettings(Base):
    """Per-client prompt overrides.

    Empty fields mean "use the protected default prompt from code". The platform
    still keeps critical grounding and safety rules outside these editable
    sections.
    """

    __tablename__ = "client_prompt_settings"

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

    sales_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    booking_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    general_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_persona_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    humanizer_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821


class ClientPromptVersion(Base):
    """Versioned prompt drafts and active releases for a client account."""

    __tablename__ = "client_prompt_versions"

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
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    test_status: Mapped[str] = mapped_column(String(20), nullable=False, default="untested")
    test_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])  # noqa: F821
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])  # noqa: F821
