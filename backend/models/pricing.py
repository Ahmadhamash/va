import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PricingRule(Base):
    """Dynamic pricing rule for an item.

    Supports quantity discounts, zone-based pricing, subscription tiers,
    payment method discounts, etc.
    """

    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'quantity_discount' | 'zone_price' | 'subscription' | 'payment_method' | 'custom'
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g. {"min_qty": 5} or {"zone": "عمان"} or {"period": "yearly"}
    condition: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    adjusted_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    discount_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    item: Mapped["Item"] = relationship(back_populates="pricing_rules")  # noqa: F821
