import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class VariantCreate(BaseModel):
    option_type: str = Field(min_length=1, max_length=50)
    option_value: str = Field(min_length=1, max_length=100)
    price_override: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    available: bool = True
    stock_quantity: int | None = None


class VariantUpdate(BaseModel):
    option_type: str | None = Field(default=None, min_length=1, max_length=50)
    option_value: str | None = Field(default=None, min_length=1, max_length=100)
    price_override: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    available: bool | None = None
    stock_quantity: int | None = None


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    option_type: str
    option_value: str
    price_override: Decimal | None
    available: bool
    stock_quantity: int | None
    created_at: datetime
