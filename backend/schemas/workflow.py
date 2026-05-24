import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkflowCreate(BaseModel):
    trigger_event: str = Field(min_length=1, max_length=255)
    action_type: str = Field(min_length=1, max_length=50)
    content: str = Field(min_length=1, max_length=2000)
    is_active: bool = True


class WorkflowUpdate(BaseModel):
    trigger_event: str | None = Field(None, min_length=1, max_length=255)
    action_type: str | None = Field(None, min_length=1, max_length=50)
    content: str | None = Field(None, min_length=1, max_length=2000)
    is_active: bool | None = None


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    trigger_event: str
    action_type: str
    content: str
    is_active: bool
    created_at: datetime
