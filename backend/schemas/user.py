import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    business_name: str | None = Field(default=None, max_length=255)


class UserLogin(BaseModel):
    username: str
    password: str


class PersonaUpdate(BaseModel):
    ai_persona: str = Field(max_length=4000)
    business_name: str | None = Field(default=None, max_length=255)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    business_name: str | None
    ai_persona: str | None
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    business_name: str | None
    ai_persona: str | None
    role: str
    is_active: bool
    created_at: datetime
    item_count: int = 0
    session_count: int = 0
    style_sample_count: int = 0


class ActiveUpdate(BaseModel):
    is_active: bool


class ClientCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    business_name: str | None = Field(default=None, max_length=255)
    ai_persona: str | None = Field(default=None, max_length=4000)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)
