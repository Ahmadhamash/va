import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
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
    humanizer_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
