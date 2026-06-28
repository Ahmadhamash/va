import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PromptSectionOut(BaseModel):
    key: str
    label: str
    description: str
    default_prompt: str
    custom_prompt: str
    active_custom_prompt: str = ""
    draft_prompt: str = ""
    effective_prompt: str
    draft_effective_prompt: str = ""
    is_custom: bool
    is_draft_custom: bool = False
    has_unpublished_changes: bool = False


class PromptVersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    status: str
    title: str
    notes: str
    prompt_payload: dict[str, str]
    test_status: str
    test_report: dict | None = None
    created_at: datetime
    updated_at: datetime
    activated_at: datetime | None = None


class ClientPromptSettingsOut(BaseModel):
    client_id: uuid.UUID
    username: str
    business_name: str | None
    client_ai_persona: str
    admin_persona_prompt: str
    ai_persona: str
    active_version: PromptVersionOut | None = None
    draft_version: PromptVersionOut | None = None
    versions: list[PromptVersionOut] = []
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
    title: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
