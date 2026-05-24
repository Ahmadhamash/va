import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatSendResponse(BaseModel):
    session_id: uuid.UUID
    reply: str
    transcription: str | None = None  # populated when an audio message was sent


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str | None
    media_type: str | None
    media_url: str | None
    created_at: datetime


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    channel: str
    external_user_id: str | None
    created_at: datetime
