"""Runtime configuration backed by the app_settings DB row (id=1).

Overrides .env so the platform can be reconfigured (e.g. rotating the OpenAI
key, changing the model or the debounce window) without a redeploy. A short
in-process TTL cache avoids hitting the DB on every request/job.
"""
import time

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as env_settings
from models import AppSettings

_CACHE_TTL = 20  # seconds
_cache: dict = {"row": None, "ts": 0.0}


async def get_settings_row(db: AsyncSession) -> AppSettings:
    row = await db.get(AppSettings, 1)
    if row is None:
        row = AppSettings(id=1, ai_model="gpt-4o", debounce_seconds=8)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def _cached(db: AsyncSession) -> AppSettings:
    now = time.monotonic()
    if _cache["row"] is not None and now - _cache["ts"] < _CACHE_TTL:
        return _cache["row"]
    row = await get_settings_row(db)
    # Detach a plain snapshot so it stays usable after the session closes
    snap = AppSettings(
        id=row.id,
        openai_api_key=row.openai_api_key,
        ai_model=row.ai_model,
        debounce_seconds=row.debounce_seconds,
    )
    _cache["row"] = snap
    _cache["ts"] = now
    return snap


def invalidate_cache() -> None:
    _cache["row"] = None
    _cache["ts"] = 0.0


async def effective_openai_key(db: AsyncSession) -> str:
    row = await _cached(db)
    return (row.openai_api_key or "").strip() or env_settings.OPENAI_API_KEY


async def effective_model(db: AsyncSession) -> str:
    row = await _cached(db)
    return row.ai_model or "gpt-4o"


async def effective_debounce(db: AsyncSession) -> int:
    row = await _cached(db)
    try:
        return max(0, min(120, int(row.debounce_seconds)))
    except (TypeError, ValueError):
        return 8
