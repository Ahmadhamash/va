"""Shared rate limiter (slowapi).

Uses Redis storage so limits hold across multiple API instances behind a load
balancer. Falls back to in-process memory if Redis can't be used.
"""
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings

logger = logging.getLogger("ratelimit")


from fastapi import Request

def secure_get_remote_address(request: Request) -> str:
    """
    Extract client IP safely.
    Blindly trusting X-Forwarded-For allows spoofing. If behind a proxy,
    the proxy appends the real IP to the end. Therefore, we take the right-most
    IP if X-Forwarded-For is present.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "127.0.0.1"


def _build_limiter() -> Limiter:
    try:
        return Limiter(
            key_func=secure_get_remote_address,
            storage_uri=settings.REDIS_URL,
            default_limits=["300/minute"],
        )
    except Exception:  # noqa: BLE001
        logger.warning("Redis rate-limit storage unavailable; using memory")
        return Limiter(
            key_func=secure_get_remote_address,
            default_limits=["300/minute"],
        )


limiter = _build_limiter()
