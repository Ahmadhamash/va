import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, func, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

class SubscriptionTier(Base):
    __tablename__ = "subscription_tiers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_monthly: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, server_default="0.0")
    features: Mapped[list | dict] = mapped_column(JSONB, default=list, server_default="[]")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    
    subscriptions: Mapped[list["UserSubscription"]] = relationship(
        back_populates="tier", cascade="all, delete-orphan"
    )

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    tier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_tiers.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    start_date: Mapped[datetime] = mapped_column(server_default=func.now())
    end_date: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="subscription")
    tier = relationship("SubscriptionTier", back_populates="subscriptions")
