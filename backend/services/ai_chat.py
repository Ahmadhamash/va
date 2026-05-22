import json
import logging
import uuid
from openai import APIError, AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChatSession, Message, User, BusinessWorkflow
from services.file_service import encode_image_base64
from services.settings_service import effective_model, effective_openai_key

from .ai_tools import TOOLS, execute_db_function
from .ai_prompts import build_system_prompt, get_style_samples
from .ai_media import transcribe_audio, TranscriptionError, _encode_image_from_url, _transcribe_from_url

logger = logging.getLogger("ai_chat")
HISTORY_LIMIT = 20
MAX_TOOL_ROUNDS = 5

_clients: dict[str, AsyncOpenAI] = {}
def _client_for(api_key: str) -> AsyncOpenAI:
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = _clients.get(api_key)
    if client is None:
        client = AsyncOpenAI(api_key=api_key)
        _clients[api_key] = client
    return client

async def get_session_history(
    session_id: uuid.UUID, db: AsyncSession, limit: int = HISTORY_LIMIT
) -> list[dict]:
    stmt = (
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.role.in_(("user", "assistant")),
            Message.content.isnot(None),
            Message.processed.is_(True),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    rows.reverse()
    return [{"role": m.role, "content": m.content or ""} for m in rows]


async def save_message(
    session_id: uuid.UUID,
    role: str,
    content: str | None,
    media_type: str | None,
    media_url: str | None,
    db: AsyncSession,
    tool_calls: dict | None = None,
    processed: bool = True,
) -> Message:
    msg = Message(
        session_id=session_id,
        role=role,
        content=content,
        media_type=media_type,
        media_url=media_url,
        tool_calls=tool_calls,
        processed=processed,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


# ─── Core model loop ─────────────────────────────────────────────────────────
async def _generate_reply(user: User, session_id: uuid.UUID, content, db: AsyncSession) -> str:
    """Run the tool-calling loop and return the assistant's text. Does not
    persist anything — the caller controls persistence."""
    api_key = await effective_openai_key(db)
    model = await effective_model(db)
    client = _client_for(api_key)

    history = await get_session_history(session_id, db, limit=HISTORY_LIMIT)
    style_samples = await get_style_samples(user.id, db)
    
    # Fetch active workflows
    stmt_wf = select(BusinessWorkflow).where(
        BusinessWorkflow.user_id == user.id, 
        BusinessWorkflow.is_active.is_(True)
    )
    workflows = list((await db.execute(stmt_wf)).scalars().all())

    messages: list[dict] = [
        {"role": "system", "content": build_system_prompt(user, style_samples, workflows)},
        *history,
        {"role": "user", "content": content},
    ]

    # Force a DB lookup on the first turn so the assistant can never answer a
    # product/price/availability question from style/persona alone.

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        temperature=0.2,
        max_tokens=1000,
    )

    rounds = 0
    while (
        response.choices[0].finish_reason == "tool_calls"
        and rounds < MAX_TOOL_ROUNDS
    ):
        rounds += 1
        assistant_msg = response.choices[0].message
        messages.append(assistant_msg.model_dump(exclude_none=True))
        for tool_call in assistant_msg.tool_calls or []:
            try:
                func_args = json.loads(tool_call.function.arguments or "{}")
            except json.JSONDecodeError:
                func_args = {}
            result = await execute_db_function(
                tool_call.function.name, func_args, user.id, db,
                session_id=session_id,
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=1000,
        )

    return response.choices[0].message.content or "I don't have that information."


def is_prompt_injection(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    jailbreak_phrases = [
        "ignore previous instructions",
        "ignore all previous instructions",
        "system prompt",
        "you are a helpful assistant",
        "disregard previous",
        "forget previous instructions",
        "forget all previous instructions",
    ]
    for phrase in jailbreak_phrases:
        if phrase in text_lower:
            return True
    return False

# ─── Synchronous path (owner web chat, generic webhook) ──────────────────────
async def process_message(
    user_message: str,
    user: User,
    session_id: uuid.UUID,
    db: AsyncSession,
    media_type: str = "text",
    media_url: str | None = None,
) -> dict:
    if getattr(user, 'ai_credit_balance', 0) <= 0:
        return {
            "reply": "Service paused: AI credit limit reached.",
            "transcription": None
        }

    transcription: str | None = None

    if media_type == "audio" and media_url:
        try:
            user_message = (await transcribe_audio(media_url, db)).strip()
            transcription = user_message
        except Exception as exc:  # noqa: BLE001
            logger.exception("transcription failed")
            raise TranscriptionError(str(exc)) from exc

    if media_type == "image" and media_url:
        b64, mime = encode_image_base64(media_url)
        content: object = [
            {"type": "text", "text": user_message or "The customer sent this image. Identify the product shown, then call get_catalog to check if we have it and provide details (price, availability, etc.)."},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
            },
        ]
    else:
        content = user_message

    if user_message and is_prompt_injection(user_message):
        reply = "I'm sorry, but I cannot process that request."
        await save_message(session_id, "user", user_message, media_type, media_url, db)
        await save_message(session_id, "assistant", reply, "text", None, db)
        return {
            "reply": reply,
            "transcription": transcription,
        }

    try:
        reply = await _generate_reply(user, session_id, content, db)
    except APIError:
        logger.exception("OpenAI API error")
        return {
            "reply": "Service temporarily unavailable, please try again",
            "transcription": transcription,
        }
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in process_message")
        return {
            "reply": "I couldn't retrieve that information right now",
            "transcription": transcription,
        }

    # Deduct AI credit
    user.ai_credit_balance -= 1
    
    # Handle optional voice reply
    voice_reply_enabled = False
    tts_voice = "alloy"
    if user.ai_persona:
        import re
        import json
        match = re.search(r"<!--\s*({.*?})\s*-->", user.ai_persona)
        if match:
            try:
                config = json.loads(match.group(1))
                voice_reply_enabled = config.get("voice_reply_enabled", False)
                tts_voice = config.get("tts_voice", "alloy")
            except Exception:
                pass
                
    reply_media_type = "text"
    reply_media_url = None
    if voice_reply_enabled and reply and reply not in ("Service temporarily unavailable, please try again", "I couldn't retrieve that information right now"):
        try:
            from services.ai_media import generate_tts
            reply_media_url = await generate_tts(reply, tts_voice, user.id, db)
            reply_media_type = "audio"
        except Exception:
            logger.exception("Failed to generate TTS")

    await save_message(
        session_id, "user", user_message, media_type, media_url, db
    )
    await save_message(session_id, "assistant", reply, reply_media_type, reply_media_url, db)
    await db.commit()
    
    return {"reply": reply, "transcription": transcription, "audio_url": reply_media_url}


# ─── Debounced path (channels/widget via worker) ─────────────────────────────
async def process_pending(session_id: uuid.UUID, db: AsyncSession) -> dict | None:
    """Coalesce all unprocessed user messages in a session into one turn,
    answer once, persist, and mark them processed.  Now supports image and
    audio attachments from external channels (Messenger / Instagram)."""
    session = await db.get(ChatSession, session_id)
    if session is None:
        return None
    # A human agent owns this conversation — don't auto-reply
    if session.is_escalated:
        return None

    user = await db.get(User, session.user_id)
    if user is None or not user.is_active:
        return None

    stmt = (
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.role == "user",
            Message.processed.is_(False),
        )
        .order_by(Message.created_at.asc())
    )
    pending = list((await db.execute(stmt)).scalars().all())
    if not pending:
        return None

    # ── Separate text, images, and audio from pending messages ──
    text_parts: list[str] = []
    image_urls: list[str] = []

    for m in pending:
        logger.info(
            "pending msg id=%s media_type=%s media_url=%s content=%s",
            m.id, m.media_type, m.media_url, (m.content or "")[:80],
        )
        if m.media_type == "audio" and m.media_url:
            try:
                transcription = await _transcribe_from_url(m.media_url, db)
                if transcription.strip():
                    text_parts.append(transcription.strip())
            except Exception:  # noqa: BLE001
                logger.exception("audio transcription failed for pending msg")
        elif m.media_type == "image" and m.media_url:
            image_urls.append(m.media_url)
            if m.content:
                text_parts.append(m.content)
        else:
            if m.content:
                text_parts.append(m.content)

    combined_text = "\n".join(text_parts).strip()

    if not combined_text and not image_urls:
        for m in pending:
            m.processed = True
        await db.commit()
        return None

    # ── Build content payload for OpenAI ──
    if image_urls:
        logger.info("Processing %d image(s) for session %s", len(image_urls), session_id)
        content: object = [
            {
                "type": "text",
                "text": combined_text or "The customer sent this image. Identify the product shown, then call get_catalog to check if we have it and provide details (price, availability, etc.).",
            },
        ]
        images_added = 0
        for img_url in image_urls:
            try:
                logger.info("Downloading image from: %s", img_url[:120])
                b64, mime = await _encode_image_from_url(img_url)
                logger.info("Image encoded: mime=%s size=%d bytes", mime, len(b64))
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{b64}",
                        "detail": "high",
                    },
                })
                images_added += 1
            except Exception:  # noqa: BLE001
                logger.exception("image download/encode failed for %s", img_url[:120])

        # If all image downloads failed, fall back to text or send error
        if images_added == 0:
            logger.warning("All image downloads failed, falling back to text")
            if combined_text:
                content = combined_text
            else:
                content = "The customer sent an image but I could not download it."
    else:
        content = combined_text

    if combined_text and is_prompt_injection(combined_text):
        reply = "I'm sorry, but I cannot process that request."
    else:
        try:
            reply = await _generate_reply(user, session_id, content, db)
        except APIError:
            logger.exception("OpenAI API error (worker)")
            reply = "Service temporarily unavailable, please try again"
        except Exception:  # noqa: BLE001
            logger.exception("worker reply failed")
            reply = "I couldn't retrieve that information right now"

    for m in pending:
        m.processed = True

    # Handle optional voice reply
    voice_reply_enabled = False
    tts_voice = "alloy"
    if user.ai_persona:
        import re
        import json
        match = re.search(r"<!--\s*({.*?})\s*-->", user.ai_persona)
        if match:
            try:
                config = json.loads(match.group(1))
                voice_reply_enabled = config.get("voice_reply_enabled", False)
                tts_voice = config.get("tts_voice", "alloy")
            except Exception:
                pass
                
    reply_media_type = "text"
    reply_media_url = None
    if voice_reply_enabled and reply and reply not in ("Service temporarily unavailable, please try again", "I couldn't retrieve that information right now"):
        try:
            from services.ai_media import generate_tts
            reply_media_url = await generate_tts(reply, tts_voice, user.id, db)
            reply_media_type = "audio"
        except Exception:
            logger.exception("Failed to generate TTS")

    await save_message(session_id, "assistant", reply, reply_media_type, reply_media_url, db)
    await db.commit()

    return {
        "reply": reply,
        "channel": session.channel,
        "external_user_id": session.external_user_id,
        "user_id": str(user.id),
        "audio_url": reply_media_url,
    }
