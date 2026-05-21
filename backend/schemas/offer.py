import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ─── Offers ──────────────────────────────────────────────────────────────────
class OfferCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    offer_type: str = Field(min_length=1, max_length=50)
    discount_value: Decimal | None = None
    min_quantity: int | None = None
    promo_code: str | None = Field(default=None, max_length=50)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    is_active: bool = True
    applicable_items: dict | None = None


class OfferUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    offer_type: str | None = None
    discount_value: Decimal | None = None
    min_quantity: int | None = None
    promo_code: str | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None
    applicable_items: dict | None = None


class OfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    offer_type: str
    discount_value: Decimal | None
    min_quantity: int | None
    promo_code: str | None
    starts_at: datetime | None
    expires_at: datetime | None
    is_active: bool
    applicable_items: dict | None
    created_at: datetime


# ─── Packages ────────────────────────────────────────────────────────────────
class PackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=10)
    package_items: dict | None = None
    is_active: bool = True


class PackageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    package_items: dict | None = None
    is_active: bool | None = None


class PackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    price: Decimal | None
    currency: str
    package_items: dict | None
    is_active: bool
    created_at: datetime
