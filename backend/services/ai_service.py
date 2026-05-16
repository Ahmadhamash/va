import json
import logging
import re
import uuid
from decimal import Decimal

from openai import APIError, AsyncOpenAI
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ChatSession, Item, Message, StyleSample, User
from services.file_service import encode_image_base64, resolve_path
from services.settings_service import (
    effective_model,
    effective_openai_key,
)

logger = logging.getLogger("ai_service")

TRANSCRIBE_MODEL = "whisper-1"
HISTORY_LIMIT = 20
MAX_TOOL_ROUNDS = 5
STYLE_SAMPLE_LIMIT = 5

# Cache one AsyncOpenAI client per API key so rotating the key takes effect
# without leaking connections.
_clients: dict[str, AsyncOpenAI] = {}


def _client_for(api_key: str) -> AsyncOpenAI:
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = _clients.get(api_key)
    if client is None:
        client = AsyncOpenAI(api_key=api_key)
        _clients[api_key] = client
    return client


# ─── Tools ───────────────────────────────────────────────────────────────────
# A single retrieval tool — impossible to mis-select, always grounded.
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_catalog",
            "description": (
                "THE catalog lookup. Call this on EVERY product/price/"
                "availability/category question, before answering. Pass `query` "
                "with the product name or keyword the customer mentioned "
                "(e.g. 'سماعة', 'headphone', 'charger'). Leave `query` empty for "
                "general questions like 'what do you have' or 'which sections'. "
                "Returns matching items (name, price, currency, availability, "
                "description) plus the list of categories."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Product name/keyword, or empty for everything",
                    },
                    "available_only": {
                        "type": "boolean",
                        "description": "If true, only currently available items",
                    },
                },
            },
        },
    },
]


def build_system_prompt(
    user: User, style_samples: list[str] | None = None
) -> str:
    business = user.business_name or "this business"
    persona = user.ai_persona or "Friendly, professional, and helpful."

    style_block = ""
    if style_samples:
        joined = "\n---\n".join(style_samples[:STYLE_SAMPLE_LIMIT])
        style_block = f"""

## VOICE / STYLE REFERENCE (do NOT copy text):
Below are examples of the owner's writing style. Use them ONLY to imitate
tone, warmth, phrasing and emoji habits. NEVER copy a line verbatim, NEVER
reply with only a greeting when the customer asked something, and NEVER reuse
any product/price/fact from them. Always answer the customer's actual
question (calling a function first when it is about products).

<style_examples>
{joined}
</style_examples>
"""

    return f"""
You are an AI assistant representing {business}.
Your persona: {persona}

## CRITICAL RULES — NEVER BREAK THESE:
1. NEVER mention any product, price or detail that didn't come from a database function call.
2. ALWAYS call the appropriate function before answering product-related questions.
3. If a product is unavailable, say so clearly — never invent alternatives.
4. If you don't know something, say you don't have that information — never guess.
5. For non-business topics (politics, general knowledge), politely redirect.
6. Prices and availability come ONLY from the database.
7. Style examples shape ONLY wording, never facts. Never copy them verbatim.
8. If the customer asks anything about products, prices, availability or
   categories, you MUST call a function FIRST and then answer it. Do not
   reply with only a greeting when a question was asked.

## TOOL USE (mandatory):
- You have ONE tool: **get_catalog**. Call it FIRST on every product, price,
  availability or category question, before you answer anything.
- Put the product keyword the customer mentioned in `query` (e.g. "سماعة",
  "كيبورد", "charger"). Leave `query` empty for general questions like "what
  do you have" or "which sections do you have".
- Answer ONLY from the returned items/categories — quote the real price,
  currency and availability. If `matched` is false or items is empty, say you
  don't have that product; do NOT invent one.

## LANGUAGE & FORMATTING:
- Reply in the SAME language the customer uses.
- When replying in Arabic, keep numbers, prices, currency codes, English words,
  emails and URLs EXACTLY as returned (left-to-right, unchanged). Put Latin/
  numeric tokens on their own or wrap them so they don't get reversed, e.g.
  write: السعر 45 USD  (never reorder the digits or letters).
- The customer may split one question across several messages; treat the whole
  batch as a single question and answer once, clearly.
- Keep responses concise and helpful.{style_block}
""".strip()


# ─── DB tools ────────────────────────────────────────────────────────────────
def _serialize_item(item: Item) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "description": item.description,
        "category": item.category,
        "price": float(item.price) if isinstance(item.price, Decimal) else item.price,
        "currency": item.currency,
        "available": item.available,
        "image_url": item.image_url,
        "metadata": item.item_metadata or {},
    }


def _tokens(query: str) -> list[str]:
    """Normalize an Arabic/Latin query into match tokens.

    Strips the Arabic definite article 'ال' and short noise so 'السماعة'
    still matches an item named 'سماعة بلوتوث Pro'.
    """
    raw = re.split(r"[\s,،/]+", (query or "").strip().lower())
    out: list[str] = []
    for t in raw:
        t = t.strip("؟?!.")
        if t.startswith("ال") and len(t) > 4:
            t = t[2:]
        if len(t) >= 2:
            out.append(t)
    return out


async def execute_db_function(
    func_name: str, func_args: dict, user_id: uuid.UUID, db: AsyncSession
) -> dict:
    try:
        if func_name != "get_catalog":
            return {"error": f"unknown function {func_name}"}

        base = select(Item).where(Item.user_id == user_id)
        if func_args.get("available_only"):
            base = base.where(Item.available.is_(True))

        query = (func_args.get("query") or "").strip()
        tokens = _tokens(query)

        if tokens:
            conds = []
            for tok in tokens:
                like = f"%{tok}%"
                conds.append(Item.name.ilike(like))
                conds.append(Item.description.ilike(like))
                conds.append(Item.category.ilike(like))
            stmt = base.where(or_(*conds))
            rows = list((await db.execute(stmt)).scalars().all())
            # Fall back to the full catalog if the keyword matched nothing,
            # so the model can still help instead of guessing.
            if not rows:
                rows = list((await db.execute(base)).scalars().all())
                matched = False
            else:
                matched = True
        else:
            rows = list((await db.execute(base)).scalars().all())
            matched = True

        cats = sorted({r.category for r in rows if r.category})
        return {
            "query": query,
            "matched": matched,
            "count": len(rows),
            "items": [_serialize_item(i) for i in rows] if rows else [],
            "categories": cats,
            "note": (
                "no item matched the query; showing full catalog"
                if not matched
                else ("no items in catalog" if not rows else "")
            ),
        }
    except Exception:
        logger.exception("execute_db_function failed: %s", func_name)
        return {"error": "could not retrieve that information"}


# ─── History / persistence ───────────────────────────────────────────────────
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


async def get_style_samples(
    user_id: uuid.UUID, db: AsyncSession, limit: int = STYLE_SAMPLE_LIMIT
) -> list[str]:
    stmt = (
        select(StyleSample.sample)
        .where(StyleSample.user_id == user_id)
        .order_by(StyleSample.created_at.desc())
        .limit(limit)
    )
    return [s for s in (await db.execute(stmt)).scalars().all() if s]


# ─── Audio ───────────────────────────────────────────────────────────────────
class TranscriptionError(Exception):
    pass


async def transcribe_audio(media_url: str, db: AsyncSession) -> str:
    key = await effective_openai_key(db)
    abs_path = resolve_path(media_url)
    with open(abs_path, "rb") as fh:
        transcript = await _client_for(key).audio.transcriptions.create(
            model=TRANSCRIBE_MODEL, file=fh, response_format="text"
        )
    return transcript if isinstance(transcript, str) else getattr(
        transcript, "text", ""
    )


# ─── Core model loop ─────────────────────────────────────────────────────────
async def _generate_reply(user: User, session_id: uuid.UUID, content, db: AsyncSession) -> str:
    """Run the tool-calling loop and return the assistant's text. Does not
    persist anything — the caller controls persistence."""
    api_key = await effective_openai_key(db)
    model = await effective_model(db)
    client = _client_for(api_key)

    history = await get_session_history(session_id, db, limit=HISTORY_LIMIT)
    style_samples = await get_style_samples(user.id, db)
    messages: list[dict] = [
        {"role": "system", "content": build_system_prompt(user, style_samples)},
        *history,
        {"role": "user", "content": content},
    ]

    # Force a DB lookup on the first turn so the assistant can never answer a
    # product/price/availability question from style/persona alone.
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        tools=TOOLS,
        tool_choice="required",
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
                tool_call.function.name, func_args, user.id, db
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


# ─── Synchronous path (owner web chat, generic webhook) ──────────────────────
async def process_message(
    user_message: str,
    user: User,
    session_id: uuid.UUID,
    db: AsyncSession,
    media_type: str = "text",
    media_url: str | None = None,
) -> dict:
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
            {"type": "text", "text": user_message or "What do you see in this image?"},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
            },
        ]
    else:
        content = user_message

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

    await save_message(
        session_id, "user", user_message, media_type, media_url, db
    )
    await save_message(session_id, "assistant", reply, "text", None, db)
    return {"reply": reply, "transcription": transcription}


# ─── Debounced path (channels/widget via worker) ─────────────────────────────
async def process_pending(session_id: uuid.UUID, db: AsyncSession) -> dict | None:
    """Coalesce all unprocessed user messages in a session into one turn,
    answer once, persist, and mark them processed. Returns the reply info or
    None if there is nothing to do (another worker handled it / no messages)."""
    session = await db.get(ChatSession, session_id)
    if session is None:
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

    combined = "\n".join(m.content for m in pending if m.content).strip()
    if not combined:
        for m in pending:
            m.processed = True
        await db.commit()
        return None

    try:
        reply = await _generate_reply(user, session_id, combined, db)
    except APIError:
        logger.exception("OpenAI API error (worker)")
        reply = "Service temporarily unavailable, please try again"
    except Exception:  # noqa: BLE001
        logger.exception("worker reply failed")
        reply = "I couldn't retrieve that information right now"

    for m in pending:
        m.processed = True
    await db.commit()

    await save_message(session_id, "assistant", reply, "text", None, db)

    return {
        "reply": reply,
        "channel": session.channel,
        "external_user_id": session.external_user_id,
        "user_id": str(user.id),
    }
