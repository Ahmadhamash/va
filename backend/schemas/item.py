import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", max_length=10)
    available: bool = True
    image_url: str | None = Field(default=None, max_length=500)
    item_metadata: dict = Field(default_factory=dict, alias="metadata")


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: str | None = Field(default=None, max_length=10)
    available: bool | None = None
    image_url: str | None = Field(default=None, max_length=500)
    item_metadata: dict | None = Field(default=None, alias="metadata")


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    price: Decimal | None
    currency: str
    available: bool
    image_url: str | None
    item_metadata: dict = Field(serialization_alias="metadata")
    created_at: datetime
    updated_at: datetime
