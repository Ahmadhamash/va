from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    openai_api_key_masked: str
    key_source: str  # "database" | "env" | "none"
    ai_model: str
    debounce_seconds: int


class SettingsUpdate(BaseModel):
    # Empty string clears the DB key (falls back to env). None = leave as-is.
    openai_api_key: str | None = None
    ai_model: str | None = Field(default=None, max_length=50)
    debounce_seconds: int | None = Field(default=None, ge=0, le=120)


class StatsOut(BaseModel):
    clients: int
    active_clients: int
    items: int
    sessions: int
    messages: int
    style_samples: int
    channels: int
    sessions_by_channel: dict
