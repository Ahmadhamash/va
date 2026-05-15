import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_persona: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'admin' (platform super-admin) | 'client' (business owner)
    role: Mapped[str] = mapped_column(
        String(20), default="client", server_default="client", index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    items: Mapped[list["Item"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    style_samples: Mapped[list["StyleSample"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    channel_integrations: Mapped[list["ChannelIntegration"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
