"""Shared rate limiter (slowapi).

Uses Redis storage so limits hold across multiple API instances behind a load
balancer. Falls back to in-process memory if Redis can't be used.
"""
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings

logger = logging.getLogger("ratelimit")


def _build_limiter() -> Limiter:
    try:
        return Limiter(
            key_func=get_remote_address,
            storage_uri=settings.REDIS_URL,
            default_limits=["300/minute"],
        )
    except Exception:  # noqa: BLE001
        logger.warning("Redis rate-limit storage unavailable; using memory")
        return Limiter(
            key_func=get_remote_address,
            default_limits=["300/minute"],
        )


limiter = _build_limiter()
