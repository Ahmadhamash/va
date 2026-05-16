import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Item(Base):
    __tablename__ = "items"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", server_default="USD")
    available: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    item_metadata: Mapped[dict] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}"
    )

    # ─── Warranty ─────────────────────────────────────────────────────────
    warranty_duration: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g. "سنة", "6 أشهر", "بدون"
    warranty_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_coverage: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_exclusions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Stock ────────────────────────────────────────────────────────────
    stock_quantity: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # None = not tracked / unlimited
    # "in_stock", "out_of_stock", "preorder", "coming_soon"
    stock_status: Mapped[str] = mapped_column(
        String(30), default="in_stock", server_default="in_stock"
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="items")  # noqa: F821
    variants: Mapped[list["ItemVariant"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )
    pricing_rules: Mapped[list["PricingRule"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )

