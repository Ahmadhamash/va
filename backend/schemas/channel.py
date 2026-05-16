import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

PLATFORMS = {"messenger", "instagram", "webhook", "widget"}


class ChannelCreate(BaseModel):
    platform: str = Field(description="messenger | instagram | webhook | widget")
    # Secrets vary per platform:
    #  messenger/instagram: page_access_token, app_secret, verify_token
    #  webhook: webhook_secret (optional)
    credentials: dict = Field(default_factory=dict)


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    platform: str
    public_id: str
    is_active: bool
    created_at: datetime
    # Which secret keys are configured (values never returned)
    configured_keys: list[str] = []
    # Relative endpoints the client wires into the platform
    endpoints: dict = {}
