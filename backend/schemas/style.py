import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StyleSampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    sample: str
    created_at: datetime


class StyleUploadResult(BaseModel):
    added: int
    total: int
