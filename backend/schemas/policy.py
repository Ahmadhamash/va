import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PolicyCreate(BaseModel):
    policy_type: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    is_active: bool = True


class PolicyUpdate(BaseModel):
    policy_type: str | None = Field(default=None, min_length=1, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    is_active: bool | None = None


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    policy_type: str
    title: str
    content: str
    is_active: bool
    created_at: datetime
