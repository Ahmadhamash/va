import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, func, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    # 'admin' (platform super-admin) | 'client' (business owner) | 'support_agent' (platform support)
    role: Mapped[str] = mapped_column(
        String(20), default="client", server_default="client", index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Phase 6: business type template
    business_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Phase 5: payment methods (JSONB)
    # e.g. {"cod": true, "cliq": "0791234567", "wallet": "Orange Money"}
    payment_methods: Mapped[dict] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )

    # Phase 2: Reliability & Usage Tracking
    ai_credit_balance: Mapped[int] = mapped_column(Integer, default=1000, server_default="1000")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

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
    delivery_rules: Mapped[list["DeliveryRule"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    escalations: Mapped[list["Escalation"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    policies: Mapped[list["BusinessPolicy"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    offers: Mapped[list["Offer"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    packages: Mapped[list["Package"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    time_slots: Mapped[list["TimeSlot"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    workflows: Mapped[list["BusinessWorkflow"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    subscription: Mapped["UserSubscription"] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    # ── New relationships for the platform upgrade ──
    voice_settings: Mapped["VoiceSettings"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    ai_persona_settings: Mapped["AIPersonaSettings"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    support_agent_profile: Mapped["PlatformSupportAgent"] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_support_agent(self) -> bool:
        return self.role == "support_agent"

