from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/ai_assistant_db"

    # OpenAI
    OPENAI_API_KEY: str = ""

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

    # Public domain for constructing external URLs (e.g., audio URLs for Meta)
    DOMAIN: str = ""

    # Voice / TTS
    ELEVENLABS_API_KEY: str = ""

    # WhatsApp Cloud API (disabled until credentials are added)
    WHATSAPP_VERIFY_TOKEN: str = ""

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
