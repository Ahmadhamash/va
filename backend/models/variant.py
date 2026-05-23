import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ItemVariant(Base):
    """A specific option/variant of a catalog item.

    Examples: colour "Black", size "L", flavour "Vanilla", model "Pro Max".
    Each variant can override the parent item's price and track its own stock.
    """

    __tablename__ = "item_variants"

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
    # e.g. "color", "size", "flavor", "model", "material", "edition"
    option_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g. "أسود", "L", "فانيلا", "Pro Max"
    option_value: Mapped[str] = mapped_column(String(100), nullable=False)
    # If set, overrides the parent item price for this specific variant
    price_override: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    available: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    stock_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    item: Mapped["Item"] = relationship(back_populates="variants")  # noqa: F821
