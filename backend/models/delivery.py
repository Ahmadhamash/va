import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class DeliveryRule(Base):
    """Per-business delivery zone with pricing and conditions.

    A business owner can define multiple zones (e.g. Amman, Zarqa, Irbid) each
    with its own delivery fee, free-delivery threshold, and estimated days.
    """

    __tablename__ = "delivery_rules"

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
    zone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    delivery_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    currency: Mapped[str] = mapped_column(
        String(10), default="JOD", server_default="JOD"
    )
    # Free delivery when order total exceeds this amount (null = never free)
    free_above: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    estimated_days: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pickup_available: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="delivery_rules")  # noqa: F821
