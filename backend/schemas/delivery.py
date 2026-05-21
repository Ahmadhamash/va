import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DeliveryRuleCreate(BaseModel):
    zone_name: str = Field(min_length=1, max_length=100)
    delivery_fee: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="JOD", max_length=10)
    free_above: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    estimated_days: str | None = Field(default=None, max_length=50)
    pickup_available: bool = False
    notes: str | None = None
    is_active: bool = True


class DeliveryRuleUpdate(BaseModel):
    zone_name: str | None = Field(default=None, min_length=1, max_length=100)
    delivery_fee: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: str | None = Field(default=None, max_length=10)
    free_above: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    estimated_days: str | None = None
    pickup_available: bool | None = None
    notes: str | None = None
    is_active: bool | None = None


class DeliveryRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    zone_name: str
    delivery_fee: Decimal
    currency: str
    free_above: Decimal | None
    estimated_days: str | None
    pickup_available: bool
    notes: str | None
    is_active: bool
    created_at: datetime
