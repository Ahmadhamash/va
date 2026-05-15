"""Inbound routing + outbound delivery for external messaging channels.

Inbound platform message → resolve client + per-end-user session →
`process_message` (same DB-only/function-calling brain) → send reply back.
"""
import hashlib
import hmac
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChannelIntegration, ChatSession, User
from services.ai_service import process_message

logger = logging.getLogger("messaging")

GRAPH_API = "https://graph.facebook.com/v21.0"


def verify_meta_signature(
    app_secret: str | None, raw_body: bytes, signature_header: str | None
) -> bool:
    """Validate X-Hub-Signature-256. If no app_secret is configured we skip
    (acceptable for local/dev), otherwise the signature must match."""
    if not app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        app_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


async def get_integration(
    public_id: str, db: AsyncSession
) -> ChannelIntegration | None:
    result = await db.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.public_id == public_id,
            ChannelIntegration.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def _get_or_create_session(
    client: User, channel: str, external_user_id: str, db: AsyncSession
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == client.id,
            ChatSession.channel == channel,
            ChatSession.external_user_id == external_user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        session = ChatSession(
            user_id=client.id,
            channel=channel,
            external_user_id=external_user_id,
            title=f"{channel}:{external_user_id}",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


async def handle_inbound_text(
    integration: ChannelIntegration,
    external_user_id: str,
    text: str,
    db: AsyncSession,
) -> str:
    """Run an inbound channel message through the assistant; returns the reply."""
    client = await db.get(User, integration.user_id)
    if client is None or not client.is_active:
        return "This assistant is currently unavailable."

    session = await _get_or_create_session(
        client, integration.platform, external_user_id, db
    )
    result = await process_message(
        user_message=text,
        user=client,
        session_id=session.id,
        db=db,
        media_type="text",
        media_url=None,
    )
    return result["reply"]


async def send_meta_message(
    page_access_token: str,
    recipient_id: str,
    text: str,
    platform: str = "messenger",
) -> None:
    """Send a reply via Meta Graph (Messenger & Instagram share this endpoint)."""
    if not page_access_token:
        logger.warning("No page_access_token configured; cannot send reply")
        return
    url = f"{GRAPH_API}/me/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text[:1900]},
        "messaging_type": "RESPONSE",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post(
                url,
                params={"access_token": page_access_token},
                json=payload,
            )
            if resp.status_code >= 400:
                logger.error(
                    "Meta send failed (%s): %s", resp.status_code, resp.text
                )
    except Exception:  # noqa: BLE001
        logger.exception("Meta send error")
