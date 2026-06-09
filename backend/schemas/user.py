import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    business_name: str | None = Field(default=None, max_length=255)
    business_type: str | None = Field(default=None, max_length=50)


class UserLogin(BaseModel):
    username: str
    password: str


class PersonaUpdate(BaseModel):
    ai_persona: str = Field(max_length=4000)
    business_name: str | None = Field(default=None, max_length=255)

class UserUpdate(BaseModel):
    business_name: str | None = Field(default=None, max_length=255)
    business_type: str | None = Field(default=None, max_length=50)
    ai_persona: str | None = Field(default=None, max_length=4000)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    business_name: str | None
    business_type: str | None = None
    ai_persona: str | None
    role: str
    is_active: bool
    created_at: datetime
    email_verified: bool
    ai_credit_balance: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    business_name: str | None
    business_type: str | None = None
    ai_persona: str | None
    role: str
    is_active: bool
    ai_auto_reply_enabled: bool = True
    created_at: datetime
    item_count: int = 0
    session_count: int = 0
    style_sample_count: int = 0
    manychat_setup_status: str = "not_started"
    fb_page_link: str | None = None
    ig_username: str | None = None
    wa_number: str | None = None
    manychat_admin_confirmed: bool = False
    manychat_setup_submitted_at: datetime | None = None
    manychat_setup_completed_at: datetime | None = None


class ActiveUpdate(BaseModel):
    is_active: bool


class ClientCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    business_name: str | None = Field(default=None, max_length=255)
    business_type: str | None = Field(default=None, max_length=50)
    ai_persona: str | None = Field(default=None, max_length=4000)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)
