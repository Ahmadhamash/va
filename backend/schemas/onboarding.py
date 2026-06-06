from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ManyChatSetupStatus = Literal["not_started", "pending_setup", "completed"]


class ManyChatOnboardingRequest(BaseModel):
    fb_page_link: str = Field(min_length=8, max_length=500)
    ig_username: str | None = Field(default=None, max_length=100)
    wa_number: str | None = Field(default=None, max_length=40)
    admin_added_confirmed: bool

    @field_validator("fb_page_link")
    @classmethod
    def clean_fb_page_link(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Facebook Page link is required")
        return cleaned

    @field_validator("ig_username", "wa_number", mode="before")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("ig_username")
    @classmethod
    def normalize_ig_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.lstrip("@")


class ManyChatOnboardingStatus(BaseModel):
    manychat_setup_status: ManyChatSetupStatus
    fb_page_link: str | None = None
    ig_username: str | None = None
    wa_number: str | None = None
    manychat_admin_confirmed: bool = False
    manychat_setup_submitted_at: datetime | None = None
    manychat_setup_completed_at: datetime | None = None


class ManyChatStatusUpdate(BaseModel):
    manychat_setup_status: ManyChatSetupStatus
