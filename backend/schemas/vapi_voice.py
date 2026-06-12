import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VapiCallSettingsUpdate(BaseModel):
    enabled: bool | None = None
    status: str | None = Field(default=None, max_length=30)
    assistant_strategy: str | None = Field(default=None, max_length=30)
    assistant_id: str | None = Field(default=None, max_length=100)
    phone_number_id: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=40)
    webhook_credential_id: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=20)
    dialect: str | None = Field(default=None, max_length=80)
    handoff_phone: str | None = Field(default=None, max_length=40)
    business_hours: str | None = None
    model_provider: str | None = Field(default=None, max_length=40)
    model_name: str | None = Field(default=None, max_length=80)
    voice_provider: str | None = Field(default=None, max_length=40)
    voice_id: str | None = Field(default=None, max_length=120)
    recording_enabled: bool | None = None
    config: dict | None = None


class VapiCallSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    public_id: str
    enabled: bool
    status: str
    assistant_strategy: str
    assistant_id: str | None
    phone_number_id: str | None
    phone_number: str | None
    webhook_credential_id: str | None
    language: str
    dialect: str
    handoff_phone: str | None
    business_hours: str | None
    model_provider: str
    model_name: str
    voice_provider: str
    voice_id: str | None
    recording_enabled: bool
    config: dict
    webhook_url: str
    created_at: datetime
    updated_at: datetime


class VoiceCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    chat_session_id: uuid.UUID | None
    vapi_call_id: str
    assistant_id: str | None
    phone_number_id: str | None
    direction: str
    status: str
    customer_phone: str | None
    customer_name: str | None
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: int | None
    ended_reason: str | None
    recording_url: str | None
    transcript: str | None
    summary: str | None
    intent: str | None
    sentiment: str | None
    needs_followup: bool
    order_status: str | None
    structured_data: dict
    created_at: datetime
    updated_at: datetime
