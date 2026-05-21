import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EscalationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID
    reason: str
    details: str | None
    status: str
    created_at: datetime
    handled_at: datetime | None
    handler_notes: str | None


class EscalationHandle(BaseModel):
    status: str = Field(pattern=r"^(handled|dismissed)$")
    handler_notes: str | None = None
