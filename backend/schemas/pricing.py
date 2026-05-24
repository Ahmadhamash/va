import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PricingRuleCreate(BaseModel):
    rule_type: str = Field(min_length=1, max_length=50)
    condition: dict = Field(default_factory=dict)
    adjusted_price: Decimal | None = None
    discount_percent: int | None = Field(default=None, ge=0, le=100)
    description: str | None = None


class PricingRuleUpdate(BaseModel):
    rule_type: str | None = None
    condition: dict | None = None
    adjusted_price: Decimal | None = None
    discount_percent: int | None = None
    description: str | None = None


class PricingRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    rule_type: str
    condition: dict
    adjusted_price: Decimal | None
    discount_percent: int | None
    description: str | None
    created_at: datetime
