from datetime import datetime

from sqlalchemy import Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AppSettings(Base):
    """Singleton (id=1) runtime configuration editable by the admin.

    Values here override .env at runtime so the platform can be reconfigured
    without a redeploy (e.g. rotating the OpenAI key).
    """

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_model: Mapped[str] = mapped_column(
        String(50), default="gpt-4o", server_default="gpt-4o"
    )
    debounce_seconds: Mapped[int] = mapped_column(
        Integer, default=8, server_default="8"
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
