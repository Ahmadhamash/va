import uuid

from pydantic import BaseModel, Field


class PromptSectionOut(BaseModel):
    key: str
    label: str
    description: str
    default_prompt: str
    custom_prompt: str
    effective_prompt: str
    is_custom: bool


class ClientPromptSettingsOut(BaseModel):
    client_id: uuid.UUID
    username: str
    business_name: str | None
    client_ai_persona: str
    admin_persona_prompt: str
    ai_persona: str
    sections: dict[str, PromptSectionOut]


class ClientPromptSettingsUpdate(BaseModel):
    ai_persona: str | None = Field(default=None, max_length=12000)
    admin_persona_prompt: str | None = Field(default=None, max_length=12000)
    sales_prompt: str | None = Field(default=None, max_length=16000)
    support_prompt: str | None = Field(default=None, max_length=16000)
    booking_prompt: str | None = Field(default=None, max_length=16000)
    general_prompt: str | None = Field(default=None, max_length=16000)
    humanizer_prompt: str | None = Field(default=None, max_length=16000)
    voice_prompt: str | None = Field(default=None, max_length=16000)
