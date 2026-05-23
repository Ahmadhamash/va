import json
import logging
import os
import uuid
from openai import APIError, AsyncOpenAI
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChatSession, Message, User, BusinessWorkflow, VoiceSettings
from services.file_service import encode_image_base64
from services.settings_service import effective_model, effective_openai_key
from services.answer_verifier import (
    AnswerVerifier,
    VerificationResult,
    SAFE_TO_SEND,
    BLOCKED_UNGROUNDED,
    HUMAN_HANDOFF_REQUIRED,
    ASK_CLARIFICATION,
    SAFE_RESPONSES,
)

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
async def _generate_reply(
    user: User, session_id: uuid.UUID, content, db: AsyncSession
) -> tuple[str, dict]:
    """Run the tool-calling loop and return (assistant_text, retrieved_data).

    retrieved_data is a dict of tool results collected during the loop,
    used by the Answer Verifier for grounding checks.
    """
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

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        temperature=0.2,
        max_tokens=1000,
    )

    # Collect all tool results for the verifier
    retrieved_data: dict = {}
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
            # Store tool result for verification grounding
            tool_key = f"{tool_call.function.name}:{json.dumps(func_args, ensure_ascii=False)}"
            retrieved_data[tool_key] = result

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

    draft = response.choices[0].message.content or "I don't have that information."
    return draft, retrieved_data


# ─── Answer Verification ─────────────────────────────────────────────────────
async def _verify_and_finalize(
    draft_answer: str,
    customer_message: str,
    retrieved_data: dict,
    user: User,
    session_id: uuid.UUID,
    db: AsyncSession,
    message_id: uuid.UUID | None = None,
) -> tuple[str, str]:
    """Verify the AI's draft answer and return (final_reply, action).

    Actions: sent, modified, blocked, handoff, clarification
    """
    user_id = user.id
    api_key = await effective_openai_key(db)
    verifier = AnswerVerifier(api_key=api_key)

    try:
        result = await verifier.verify(customer_message, retrieved_data, draft_answer)
    except Exception:
        logger.exception("Answer verification failed — sending with caution")
        return draft_answer, "sent"

    logger.info(
        "Verification: verdict=%s risk=%.2f reasons=%s",
        result.verdict, result.risk_score, result.reasons,
    )

    final_reply = draft_answer
    action = "sent"

    if result.verdict == SAFE_TO_SEND:
        final_reply = draft_answer
        action = "sent"

    elif result.verdict == ASK_CLARIFICATION:
        # Use the verifier's suggested clarification or a natural Jordanian one
        final_reply = result.safe_response or (
            "ممكن توضحلي أكثر شو بالظبط اللي بتدور عليه؟ عشان أقدر أساعدك بشكل أفضل 😊"
        )
        action = "clarification"

    elif result.verdict == "NEEDS_MORE_DATA":
        # Could try to fetch more data, but for now ask the customer
        final_reply = result.safe_response or (
            "خليني أتأكد من المعلومة وأرجعلك."
        )
        action = "modified"

    elif result.verdict == HUMAN_HANDOFF_REQUIRED:
        # Create a handoff session
        try:
            from services.handoff_service import create_handoff
            await create_handoff(
                session_id=session_id,
                user_id=user_id,
                reason="AI verifier: " + "; ".join(result.reasons[:2]),
                db=db,
                priority="high" if result.risk_score > 0.8 else "normal",
                ai_summary=f"Customer: {customer_message[:200]}\nDraft: {draft_answer[:200]}",
                ai_suggested_reply=result.safe_response,
            )
        except Exception:
            await db.rollback()
            logger.exception("Failed to create handoff session")
        final_reply = result.safe_response or SAFE_RESPONSES.get(
            "handoff", "لحظة من فضلك، رح أحولك لزميلي ليقدر يساعدك بشكل أفضل."
        )
        action = "handoff"

    elif result.verdict == BLOCKED_UNGROUNDED:
        final_reply = result.safe_response or SAFE_RESPONSES.get(
            "hallucination_blocked",
            "لحظة من فضلك، خليني أتأكد من المعلومة وأرجعلك.",
        )
        action = "blocked"
        logger.warning(
            "BLOCKED ungrounded answer: %s | Flagged: %s",
            result.reasons, result.flagged_claims,
        )

    else:
        # Unknown verdict — send with caution
        logger.warning("Unknown verifier verdict: %s", result.verdict)
        action = "sent"

    # Log the verification decision
    try:
        await verifier.log_verification(
            result=result,
            customer_message=customer_message,
            retrieved_data=retrieved_data,
            draft_answer=draft_answer,
            final_action=action,
            final_answer=final_reply,
            session_id=session_id,
            user_id=user_id,
            message_id=message_id,
            db=db,
        )
    except Exception:
        await db.rollback()
        logger.exception("Failed to log verification result")

    return final_reply, action


# ─── Voice Reply Helper ──────────────────────────────────────────────────────
async def _determine_voice_mode(
    user_id: uuid.UUID,
    db: AsyncSession,
    incoming_media_type: str = "text",
    ai_persona: str | None = None,
) -> tuple[bool, str, float, dict | None, str, str]:
    """Determine if a voice reply should be generated.

    Returns: (should_voice, preferred_voice, speed, voice_config)
    """
    # Check VoiceSettings from DB first
    stmt = select(VoiceSettings).where(VoiceSettings.user_id == user_id)
    vs = (await db.execute(stmt)).scalar_one_or_none()

    if vs:
        should_voice = False
        if vs.voice_mode == "always_voice":
            should_voice = True
        elif vs.voice_mode == "voice_when_voice" and incoming_media_type == "audio":
            should_voice = True
        elif vs.voice_mode == "text_and_voice":
            should_voice = True
        return (
            should_voice,
            vs.preferred_voice,
            vs.speech_speed,
            vs.tts_config,
            vs.tts_provider,
            vs.audio_format,
        )

    # Legacy: check ai_persona for voice config only when no VoiceSettings row exists.
    # Once a user saves Voice Settings, "off" must be authoritative.
    if ai_persona:
        import re
        match = re.search(r"<!--\s*({.*?})\s*-->", ai_persona)
        if match:
            try:
                config = json.loads(match.group(1))
                voice_reply_enabled = config.get("voice_reply_enabled", False)
                tts_voice = config.get("tts_voice", "alloy")
                return voice_reply_enabled, tts_voice, 1.0, None, "openai", "mp3"
            except Exception:
                pass

    return False, "nova", 1.0, None, "openai", "mp3"


async def _generate_voice_reply(
    text: str,
    user_id: uuid.UUID,
    db: AsyncSession,
    voice: str = "nova",
    speed: float = 1.0,
    voice_config: dict | None = None,
    tts_provider: str = "auto",
    output_format: str = "mp3",
) -> str | None:
    """Generate voice reply using VoiceService. Returns media URL or None."""
    try:
        from services.voice import VoiceService
        voice_service = await VoiceService.from_db(db, tts_provider=tts_provider)
        media_url = await voice_service.synthesize_and_save(
            text,
            user_id,
            voice=voice,
            speed=speed,
            output_format=output_format,
            voice_config=voice_config,
        )
        return media_url
    except Exception:
        logger.exception("Failed to generate voice reply")
        return None


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
    user_id = user.id
    ai_persona = user.ai_persona
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
        draft_reply, retrieved_data = await _generate_reply(user, session_id, content, db)
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

    # ── Answer Verification (anti-hallucination) ──
    customer_text = user_message if isinstance(user_message, str) else str(content)
    reply, action = await _verify_and_finalize(
        draft_reply, customer_text, retrieved_data,
        user, session_id, db,
    )

    # Deduct AI credit
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(ai_credit_balance=User.ai_credit_balance - 1)
    )

    # ── Voice reply (uses new VoiceService abstraction) ──
    reply_media_type = "text"
    reply_media_url = None
    ERROR_REPLIES = (
        "Service temporarily unavailable, please try again",
        "I couldn't retrieve that information right now",
    )
    if reply and reply not in ERROR_REPLIES:
        should_voice, voice, speed, voice_config, tts_provider, audio_format = await _determine_voice_mode(
            user_id,
            db,
            incoming_media_type=media_type,
            ai_persona=ai_persona,
        )
        if should_voice:
            reply_media_url = await _generate_voice_reply(
                reply,
                user_id,
                db,
                voice=voice,
                speed=speed,
                voice_config=voice_config,
                tts_provider=tts_provider,
                output_format=audio_format,
            )
            if reply_media_url:
                reply_media_type = "audio"

    await save_message(
        session_id, "user", user_message, media_type, media_url, db
    )
    await save_message(session_id, "assistant", reply, reply_media_type, reply_media_url, db)
    await db.commit()

    return {"reply": reply, "transcription": transcription, "audio_url": reply_media_url, "action": action}


# ─── Debounced path (channels/widget via worker) ─────────────────────────────
async def process_pending(session_id: uuid.UUID, db: AsyncSession) -> dict | None:
    """Coalesce all unprocessed user messages in a session into one turn,
    answer once, persist, and mark them processed.  Now supports image and
    audio attachments from external channels (Messenger / Instagram / WhatsApp).

    Every reply passes through the Answer Verifier before sending.
    Voice replies use the new VoiceService abstraction.
    """
    session = await db.get(ChatSession, session_id)
    if session is None:
        return None
    # A human agent owns this conversation — don't auto-reply
    if session.is_escalated:
        return None

    session_user_id = session.user_id
    session_channel = session.channel
    session_external_user_id = session.external_user_id

    user = await db.get(User, session_user_id)
    if user is None or not user.is_active:
        return None
    user_id = user.id
    ai_persona = user.ai_persona

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
    incoming_media_type = "text"  # Track for voice mode decision

    for m in pending:
        logger.info(
            "pending msg id=%s media_type=%s media_url=%s content=%s",
            m.id, m.media_type, m.media_url, (m.content or "")[:80],
        )
        if m.media_type == "audio" and m.media_url:
            incoming_media_type = "audio"
            try:
                transcription = await _transcribe_from_url(m.media_url, db)
                if transcription.strip():
                    text_parts.append(transcription.strip())
            except Exception:  # noqa: BLE001
                logger.exception("audio transcription failed for pending msg")
        elif m.media_type == "image" and m.media_url:
            incoming_media_type = "image"
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

        if images_added == 0:
            logger.warning("All image downloads failed, falling back to text")
            if combined_text:
                content = combined_text
            else:
                content = "The customer sent an image but I could not download it."
    else:
        content = combined_text

    action = "sent"
    if combined_text and is_prompt_injection(combined_text):
        reply = "I'm sorry, but I cannot process that request."
    else:
        try:
            draft_reply, retrieved_data = await _generate_reply(user, session_id, content, db)

            # ── Answer Verification (anti-hallucination) ──
            customer_text = combined_text or str(content)
            reply, action = await _verify_and_finalize(
                draft_reply, customer_text, retrieved_data,
                user, session_id, db,
            )
        except APIError:
            logger.exception("OpenAI API error (worker)")
            reply = "Service temporarily unavailable, please try again"
        except Exception:  # noqa: BLE001
            logger.exception("worker reply failed")
            reply = "I couldn't retrieve that information right now"

    for m in pending:
        m.processed = True

    # ── Voice reply (uses new VoiceService) ──
    reply_media_type = "text"
    reply_media_url = None
    ERROR_REPLIES = (
        "Service temporarily unavailable, please try again",
        "I couldn't retrieve that information right now",
    )
    if reply and reply not in ERROR_REPLIES:
        should_voice, voice, speed, voice_config, tts_provider, audio_format = await _determine_voice_mode(
            user_id,
            db,
            incoming_media_type=incoming_media_type,
            ai_persona=ai_persona,
        )
        if should_voice:
            # For Meta channels, use AAC instead of MP3 to avoid bad audio quality caused by Facebook's transcoder
            if session_channel in ("messenger", "instagram", "whatsapp") and audio_format == "mp3":
                audio_format = "aac"

            reply_media_url = await _generate_voice_reply(
                reply,
                user_id,
                db,
                voice=voice,
                speed=speed,
                voice_config=voice_config,
                tts_provider=tts_provider,
                output_format=audio_format,
            )
            if reply_media_url:
                reply_media_type = "audio"

    await save_message(session_id, "assistant", reply, reply_media_type, reply_media_url, db)
    await db.commit()

    return {
        "reply": reply,
        "channel": session_channel,
        "external_user_id": session_external_user_id,
        "user_id": str(user_id),
        "audio_url": reply_media_url,
        "action": action,
    }
