import hmac
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from services.chatwoot_bridge import handle_chatwoot_payload
from services.ratelimit import limiter

router = APIRouter(tags=["chatwoot"])


def _extract_secret(request: Request) -> str:
    return (
        request.headers.get("x-chatwoot-webhook-secret")
        or request.headers.get("x-webhook-secret")
        or request.query_params.get("secret")
        or ""
    )


def _verify_secret(request: Request) -> None:
    expected = settings.CHATWOOT_WEBHOOK_SECRET
    if not expected:
        raise HTTPException(status_code=503, detail="Chatwoot webhook is not configured")
    provided = _extract_secret(request)
    if not provided or not hmac.compare_digest(provided.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="Invalid webhook secret")


@router.post("/webhooks/chatwoot")
@limiter.limit("60/minute")
async def chatwoot_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    _verify_secret(request)
    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    return await handle_chatwoot_payload(payload, db)
