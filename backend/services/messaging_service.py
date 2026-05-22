"""Inbound routing + outbound delivery for external messaging channels.

- Messenger / Instagram / widget: message is buffered (processed=False) and a
  debounced worker job is scheduled; the worker answers the whole batch once.
- Generic webhook: synchronous request/response (no debounce — it's an API).
"""
import hashlib
import hmac
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChannelIntegration, ChatSession, User
from services.ai_chat import process_message, save_message
from services.queue_service import schedule_session

logger = logging.getLogger("messaging")

GRAPH_API = "https://graph.facebook.com/v21.0"


def verify_meta_signature(
    app_secret: str | None, raw_body: bytes, signature_header: str | None
) -> bool:
    if not app_secret:
        return False
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


async def _client_for(integration: ChannelIntegration, db: AsyncSession) -> User | None:
    client = await db.get(User, integration.user_id)
    if client is None or not client.is_active:
        return None
    return client


async def enqueue_inbound(
    integration: ChannelIntegration,
    external_user_id: str,
    text: str | None,
    db: AsyncSession,
    *,
    media_type: str = "text",
    media_url: str | None = None,
) -> ChatSession | None:
    """Buffer an inbound message and schedule debounced processing."""
    client = await _client_for(integration, db)
    if client is None:
        return None
    session = await _get_or_create_session(
        client, integration.platform, external_user_id, db
    )
    await save_message(
        session.id, "user", text, media_type, media_url, db, processed=False,
    )
    await schedule_session(session.id, db)
    return session


async def sync_reply(
    integration: ChannelIntegration,
    external_user_id: str,
    text: str,
    db: AsyncSession,
) -> str:
    """Synchronous answer for the generic webhook (request/response)."""
    client = await _client_for(integration, db)
    if client is None:
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
    audio_url: str | None = None,
) -> None:
    if not page_access_token:
        logger.warning("No page_access_token; cannot send reply")
        return
        
    payloads = []
    
    # Send text only if no audio, or maybe we send both? 
    # Let's send text first, then audio if present, because users usually want both. 
    # But wait, the user asked "why does it send text with it" -> let's send ONLY audio if audio_url is present, 
    # OR we can just send the audio attachment instead of text. Let's stick to sending both since text is useful, 
    # but I'll let them know it's a feature. Actually, I'll send only audio if they want.
    if audio_url:
        payloads.append({
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "audio",
                    "payload": {
                        "url": audio_url,
                        "is_reusable": True
                    }
                }
            },
            "messaging_type": "RESPONSE",
        })
    else:
        payloads.append({
            "recipient": {"id": recipient_id},
            "message": {"text": text[:1900]},
            "messaging_type": "RESPONSE",
        })
        
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            for payload in payloads:
                resp = await http.post(
                    f"{GRAPH_API}/me/messages",
                    params={"access_token": page_access_token},
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.error("Meta send failed (%s): %s", resp.status_code, resp.text)
    except Exception:  # noqa: BLE001
        logger.exception("Meta send error")
