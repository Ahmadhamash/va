import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Offer(Base):
    """A promotional offer or discount for a business.

    Covers percentage discounts, fixed discounts, buy-X-get-Y,
    free delivery, promo codes, etc.
    """

    __tablename__ = "offers"

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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'percentage' | 'fixed' | 'buy_x_get_y' | 'free_delivery' | 'bundle' | 'custom'
    offer_type: Mapped[str] = mapped_column(String(50), nullable=False)
    discount_value: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    min_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    promo_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    # List of item_ids this offer applies to (null = all items)
    applicable_items: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="offers")  # noqa: F821


class Package(Base):
    """A bundle/package combining multiple items at a special price.

    Used for course packages (Basic/Premium/VIP), product bundles,
    subscription tiers, etc.
    """

    __tablename__ = "packages"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(10), default="USD", server_default="USD"
    )
    # JSON list of {item_id, quantity, notes}
    package_items: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="packages")  # noqa: F821
