from functools import lru_cache
from typing import List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/ai_assistant_db"
    DB_POOL_RECYCLE_SECONDS: int = 1800

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Local LLM / MoE
    LOCAL_LLM_BASE_URL: str = ""
    LOCAL_LLM_API_KEY: str = ""
    LOCAL_LLM_MODEL: str = "llama3"
    LOCAL_LLM_ENABLED: bool = False

    # Redis / task queue
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = "change-this-to-a-random-string-at-least-32-characters-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Files
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 25
    
    # S3
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_BUCKET: str | None = None
    AWS_REGION: str = "us-east-1"


    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.0

    # Public domain for constructing external URLs (e.g., audio URLs for Meta)
    DOMAIN: str = ""

    # Voice / TTS
    ELEVENLABS_API_KEY: str = ""

    # Vapi voice calls
    VAPI_API_KEY: str = ""
    VAPI_BASE_URL: str = "https://api.vapi.ai"
    VAPI_WEBHOOK_BEARER_TOKEN: str = ""
    VAPI_DEFAULT_ASSISTANT_ID: str = ""

    # Meta OAuth for Facebook Messenger / Instagram direct connection
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_OAUTH_REDIRECT_URI: str = ""
    META_OAUTH_SUCCESS_URL: str = ""
    AI_AUTO_REPLY_ENABLED: bool = True
    AI_HUMAN_HANDOFF_LABEL: str = "human_handoff"

    # WhatsApp Cloud API (disabled until credentials are added)
    WHATSAPP_VERIFY_TOKEN: str = ""

    # OpenWA / WhatsApp Web bridge
    OPENWA_API_URL: str = "http://openwa:2785"
    OPENWA_API_KEY: str = ""
    OPENWA_WEBHOOK_SECRET: str = ""
    OPENWA_ALLOW_GROUPS: bool = False

    # Make.com API
    MAKE_API_TOKEN: str = ""
    MAKE_TEAM_ID: str = ""
    MAKE_CONNECTION_ID: str = ""
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v):
        # Accept JSON list, comma-separated string, or already-a-list
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            if v:
                return [o.strip() for o in v.split(",") if o.strip()]
            return []
        return v

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES", mode="before")
    @classmethod
    def _strip_inline_comment(cls, v):
        # .env files sometimes carry inline comments after the value
        if isinstance(v, str):
            return int(v.split("#")[0].strip())
        return v

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def _validate_secret_key(cls, v):
        if v == "change-this-to-a-random-string-at-least-32-characters-long":
            raise ValueError("SECRET_KEY must be changed from the default value")
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @model_validator(mode="after")
    def _validate_production_cors(self):
        if self.APP_ENV.lower() == "production":
            origins = [origin.strip() for origin in self.CORS_ORIGINS if origin.strip()]
            if not origins:
                raise ValueError("CORS_ORIGINS must not be empty in production")
            if "*" in origins:
                raise ValueError("CORS_ORIGINS must not include '*' in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
