import logging
import uuid
from typing import Any

import httpx
import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import ChatSession, User
from services.ai_chat import process_message

logger = logging.getLogger("chatwoot_bridge")

HANDOFF_REPLY = "أكيد، رح أحولك لموظف يساعدك بأسرع وقت."
PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 7
_redis_client: redis.Redis | None = None

HANDOFF_KEYWORDS = (
    "موظف",
    "احكي مع حدا",
    "أحكي مع حدا",
    "بدي انسان",
    "بدي إنسان",
    "انسان",
    "إنسان",
    "شكوى",
    "مشكلتي",
    "مشكلة",
    "زعلان",
    "معصب",
    "غاضب",
    "refund",
    "cancel",
    "angry",
    "complaint",
)


def _redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def mark_message_once(message_id: str) -> bool:
    if not message_id:
        return False
    key = f"chatwoot:processed:{message_id}"
    try:
        return bool(await _redis().set(key, "1", ex=PROCESSED_TTL_SECONDS, nx=True))
    except Exception:
        logger.exception("Chatwoot idempotency check failed")
        return False


def should_handoff(text: str) -> bool:
    normalized = (text or "").strip().lower()
    return any(keyword.lower() in normalized for keyword in HANDOFF_KEYWORDS)


def _labels_from_payload(payload: dict[str, Any]) -> set[str]:
    labels = payload.get("labels") or (payload.get("conversation") or {}).get("labels") or []
    if isinstance(labels, dict):
        labels = labels.keys()
    return {str(label) for label in labels if label}


def has_handoff_label(payload: dict[str, Any]) -> bool:
    labels = _labels_from_payload(payload)
    configured = settings.AI_HUMAN_HANDOFF_LABEL or "human_handoff"
    return bool(labels.intersection({configured, "human_handoff", "assigned_to_human"}))


def is_valid_customer_message(payload: dict[str, Any]) -> tuple[bool, str]:
    if payload.get("event") != "message_created":
        return False, "unsupported_event"
    if payload.get("private") is True:
        return False, "private_note"
    if payload.get("message_type") != "incoming":
        return False, "not_incoming"
    if has_handoff_label(payload):
        return False, "human_handoff"
    content = (payload.get("content") or "").strip()
    if not content:
        return False, "empty"
    sender = payload.get("sender") or {}
    sender_type = str(sender.get("type") or "").lower()
    if sender_type in {"user", "agent"}:
        return False, "agent_sender"
    bot_agent_id = settings.CHATWOOT_BOT_AGENT_ID
    if bot_agent_id and str(sender.get("id") or "") == str(bot_agent_id):
        return False, "bot_sender"
    return True, "ok"


async def resolve_chatwoot_user(account_id: str, db: AsyncSession) -> User | None:
    if account_id:
        stmt = select(User).where(User.chatwoot_account_id == account_id, User.is_active.is_(True))
        user = (await db.execute(stmt)).scalar_one_or_none()
        if user:
            return user

    if settings.CHATWOOT_USER_ID:
        try:
            user = await db.get(User, uuid.UUID(settings.CHATWOOT_USER_ID))
            if user and user.is_active:
                return user
        except ValueError:
            logger.error("Invalid CHATWOOT_USER_ID configured")
            return None

    stmt = (
        select(User)
        .where(User.role == "client", User.is_active.is_(True))
        .order_by(User.created_at.asc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_or_create_session(
    db: AsyncSession,
    user: User,
    account_id: str,
    conversation_id: str,
    sender_name: str | None,
) -> ChatSession:
    external_id = f"chatwoot:{account_id}:{conversation_id}"
    stmt = select(ChatSession).where(
        ChatSession.user_id == user.id,
        ChatSession.channel == "chatwoot",
        ChatSession.external_user_id == external_id,
    )
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session:
        return session

    title = f"Chatwoot #{conversation_id}"
    if sender_name:
        title = f"{sender_name} - {title}"
    session = ChatSession(
        user_id=user.id,
        title=title[:255],
        channel="chatwoot",
        external_user_id=external_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


def chatwoot_headers() -> dict[str, str]:
    return {
        "api_access_token": settings.CHATWOOT_API_ACCESS_TOKEN,
        "Content-Type": "application/json",
    }


def chatwoot_ready(account_id: str) -> bool:
    return bool(
        settings.CHATWOOT_BASE_URL
        and account_id
        and settings.CHATWOOT_API_ACCESS_TOKEN
    )


async def send_chatwoot_message(
    account_id: str,
    conversation_id: str,
    message: str,
    *,
    private: bool = False,
) -> None:
    if not chatwoot_ready(account_id):
        logger.warning("Chatwoot API is not configured; skipping outgoing message")
        return
    base = settings.CHATWOOT_BASE_URL.rstrip("/")
    url = (
        f"{base}/api/v1/accounts/{account_id}"
        f"/conversations/{conversation_id}/messages"
    )
    payload = {
        "content": message,
        "message_type": "outgoing",
        "private": private,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, headers=chatwoot_headers(), json=payload)
        response.raise_for_status()


async def add_chatwoot_labels(account_id: str, conversation_id: str, labels: list[str]) -> None:
    if not chatwoot_ready(account_id) or not labels:
        return
    base = settings.CHATWOOT_BASE_URL.rstrip("/")
    url = (
        f"{base}/api/v1/accounts/{account_id}"
        f"/conversations/{conversation_id}/labels"
    )
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, headers=chatwoot_headers(), json={"labels": labels})
        response.raise_for_status()


async def handle_chatwoot_payload(payload: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    valid, reason = is_valid_customer_message(payload)
    if not valid:
        return {"status": "ignored", "reason": reason}

    message_id = str(payload.get("id") or "")
    if not await mark_message_once(message_id):
        return {"status": "ignored", "reason": "duplicate"}

    conversation = payload.get("conversation") or {}
    conversation_id = str(
        payload.get("conversation_id")
        or conversation.get("id")
        or ""
    )
    account_id = str(payload.get("account_id") or settings.CHATWOOT_ACCOUNT_ID or "")
    if not conversation_id:
        return {"status": "ignored", "reason": "missing_conversation"}

    user = await resolve_chatwoot_user(account_id, db)
    if not user:
        return {"status": "ignored", "reason": "no_active_client_user"}

    content = (payload.get("content") or "").strip()
    sender = payload.get("sender") or {}
    sender_name = sender.get("name") or sender.get("email")
    session = await get_or_create_session(db, user, account_id, conversation_id, sender_name)

    if should_handoff(content):
        session.is_escalated = True
        await db.commit()
        label = settings.AI_HUMAN_HANDOFF_LABEL or "human_handoff"
        try:
            await add_chatwoot_labels(account_id, conversation_id, [label])
            await send_chatwoot_message(
                account_id,
                conversation_id,
                f"Private note: AI paused because the customer requested human help. Message ID: {message_id}",
                private=True,
            )
            await send_chatwoot_message(account_id, conversation_id, HANDOFF_REPLY)
        except Exception:
            logger.exception("Failed to complete Chatwoot handoff")
        return {"status": "handoff", "conversation_id": conversation_id}

    if not settings.AI_AUTO_REPLY_ENABLED:
        return {"status": "ignored", "reason": "auto_reply_disabled"}

    result = await process_message(content, user, session.id, db, media_type="text")
    reply = (result or {}).get("reply")
    action = (result or {}).get("action")
    if action == "handoff":
        session.is_escalated = True
        await db.commit()
        try:
            await add_chatwoot_labels(
                account_id,
                conversation_id,
                [settings.AI_HUMAN_HANDOFF_LABEL or "human_handoff"],
            )
            await send_chatwoot_message(
                account_id,
                conversation_id,
                "Private note: AI verifier requested human handoff.",
                private=True,
            )
        except Exception:
            logger.exception("Failed to label verifier handoff in Chatwoot")
    if reply:
        await send_chatwoot_message(account_id, conversation_id, reply)
    return {"status": "replied", "conversation_id": conversation_id, "action": action}
