"""Enqueue side of the debounce pipeline.

Each inbound channel message bumps a per-session counter and schedules a
deferred worker job. Only the job whose counter matches the latest message
does the work — so a burst of rapid messages collapses into one AI reply.
"""
import logging
import uuid

from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from services.settings_service import effective_debounce

logger = logging.getLogger("queue")

_pool = None


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.REDIS_URL)


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await create_pool(_redis_settings())
    return _pool


async def schedule_session(session_id: uuid.UUID, db: AsyncSession) -> None:
    """Bump the session's inbound counter and defer a processing job."""
    debounce = await effective_debounce(db)
    pool = await get_pool()
    seq = await pool.incr(f"inbound_seq:{session_id}")
    await pool.expire(f"inbound_seq:{session_id}", 3600)
    await pool.enqueue_job(
        "process_session_task",
        str(session_id),
        int(seq),
        _defer_by=debounce,
    )
    logger.info("scheduled session=%s seq=%s defer=%ss", session_id, seq, debounce)
