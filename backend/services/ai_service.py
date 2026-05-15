import json
import logging
import uuid
from decimal import Decimal

from openai import APIError, AsyncOpenAI
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import ChatSession, Item, Message, StyleSample, User
from services.file_service import encode_image_base64, resolve_path

logger = logging.getLogger("ai_service")

CHAT_MODEL = "gpt-4o"
TRANSCRIBE_MODEL = "whisper-1"
HISTORY_LIMIT = 20
MAX_TOOL_ROUNDS = 5  # safety cap so the tool loop can never spin forever
STYLE_SAMPLE_LIMIT = 12  # how many voice examples to inject into the prompt

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


# ─── Tool definitions ────────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_items",
            "description": (
                "Get all products/services from the database. Use this when the "
                "customer asks what's available, asks for a menu/catalog, or asks "
                "general questions about products."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Filter by category (optional)",
                    },
                    "available_only": {
                        "type": "boolean",
                        "description": "If true, return only available items",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_items",
            "description": (
                "Search for specific items by name or keyword. Use when the "
                "customer asks about a specific product."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_item_details",
            "description": "Get full details of a specific item by name or ID.",
            "parameters": {
                "type": "object",
                "properties": {"item_name": {"type": "string"}},
                "required": ["item_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "Get list of all available categories.",
            "parameters": {"type": "object", "properties": {}},
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

## VOICE / STYLE EXAMPLES:
The owner provided real examples of how THEY personally talk. Mimic their
tone, phrasing, greetings, and emoji usage. These examples are for STYLE
ONLY — never reuse any product, price, fact, promise, or detail from them;
those must still come exclusively from database function calls.

{joined}
"""

    return f"""
You are an AI assistant representing {business}.
Your persona: {persona}

## CRITICAL RULES — NEVER BREAK THESE:
1. NEVER mention any product, price, or detail that didn't come from a database function call.
2. ALWAYS call the appropriate function before answering product-related questions.
3. If a product is unavailable, say so clearly — never suggest alternatives you invented.
4. If you don't know something, say "I don't have that information" — never guess.
5. If asked about something outside the business (politics, general knowledge, etc.), politely redirect.
6. Prices and availability come ONLY from the database — never estimate or assume.
7. Style examples below shape ONLY your wording — never your facts.

## BEHAVIOR:
- Be conversational and match the business persona above.
- For product questions: call get_all_items or search_items FIRST, then answer.
- For specific item questions: call get_item_details FIRST.
- Respond in the same language the customer uses.
- Keep responses concise and helpful.{style_block}
""".strip()


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


# ─── DB-backed tool implementations ──────────────────────────────────────────
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


async def execute_db_function(
    func_name: str,
    func_args: dict,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """Run the requested tool against the DB, strictly scoped to user_id."""
    try:
        if func_name == "get_all_items":
            stmt = select(Item).where(Item.user_id == user_id)
            category = func_args.get("category")
            if category:
                stmt = stmt.where(Item.category.ilike(f"%{category}%"))
            if func_args.get("available_only"):
                stmt = stmt.where(Item.available.is_(True))
            rows = (await db.execute(stmt)).scalars().all()
            if not rows:
                return {"result": "no items found"}
            return {"items": [_serialize_item(i) for i in rows]}

        if func_name == "search_items":
            query = (func_args.get("query") or "").strip()
            if not query:
                return {"result": "no query provided"}
            pattern = f"%{query}%"
            stmt = select(Item).where(
                Item.user_id == user_id,
                or_(
                    Item.name.ilike(pattern),
                    Item.description.ilike(pattern),
                    Item.category.ilike(pattern),
                ),
            )
            rows = (await db.execute(stmt)).scalars().all()
            if not rows:
                return {"result": "no items found"}
            return {"items": [_serialize_item(i) for i in rows]}

        if func_name == "get_item_details":
            name = (func_args.get("item_name") or "").strip()
            if not name:
                return {"result": "no item specified"}
            stmt = select(Item).where(
                Item.user_id == user_id, Item.name.ilike(f"%{name}%")
            )
            item = (await db.execute(stmt)).scalars().first()
            if item is None:
                return {"result": "no items found"}
            return {"item": _serialize_item(item)}

        if func_name == "get_categories":
            stmt = (
                select(Item.category)
                .where(Item.user_id == user_id, Item.category.isnot(None))
                .distinct()
            )
            cats = [c for c in (await db.execute(stmt)).scalars().all() if c]
            if not cats:
                return {"result": "no categories found"}
            return {"categories": cats}

        return {"error": f"unknown function {func_name}"}
    except Exception:
        logger.exception("execute_db_function failed: %s", func_name)
        return {"error": "could not retrieve that information"}


# ─── History / persistence ───────────────────────────────────────────────────
async def get_session_history(
    session_id: uuid.UUID, db: AsyncSession, limit: int = HISTORY_LIMIT
) -> list[dict]:
    """Return the last `limit` user/assistant turns as OpenAI message dicts."""
    stmt = (
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.role.in_(("user", "assistant")),
            Message.content.isnot(None),
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
) -> None:
    db.add(
        Message(
            session_id=session_id,
            role=role,
            content=content,
            media_type=media_type,
            media_url=media_url,
            tool_calls=tool_calls,
        )
    )
    await db.commit()


# ─── Audio ───────────────────────────────────────────────────────────────────
async def transcribe_audio(media_url: str) -> str:
    abs_path = resolve_path(media_url)
    with open(abs_path, "rb") as audio_file:
        transcript = await _get_client().audio.transcriptions.create(
            model=TRANSCRIBE_MODEL,
            file=audio_file,
            response_format="text",
        )
    # response_format="text" yields a plain string
    return transcript if isinstance(transcript, str) else getattr(transcript, "text", "")


# ─── Main chat loop ──────────────────────────────────────────────────────────
class TranscriptionError(Exception):
    pass


async def process_message(
    user_message: str,
    user: User,
    session_id: uuid.UUID,
    db: AsyncSession,
    media_type: str = "text",
    media_url: str | None = None,
) -> dict:
    """
    Returns {"reply": str, "transcription": str | None}.
    Raises TranscriptionError if audio could not be transcribed.
    """
    transcription: str | None = None

    # 1. Audio → transcribe first
    if media_type == "audio" and media_url:
        try:
            user_message = (await transcribe_audio(media_url)).strip()
            transcription = user_message
        except Exception as exc:  # noqa: BLE001
            logger.exception("transcription failed")
            raise TranscriptionError(str(exc)) from exc

    # 2. Build user content (text or image)
    if media_type == "image" and media_url:
        b64, mime = encode_image_base64(media_url)
        content: object = [
            {
                "type": "text",
                "text": user_message or "What do you see in this image?",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{b64}",
                    "detail": "high",
                },
            },
        ]
    else:
        content = user_message

    # 3. Load history + 4. assemble messages
    history = await get_session_history(session_id, db, limit=HISTORY_LIMIT)
    style_samples = await get_style_samples(user.id, db)
    messages: list[dict] = [
        {"role": "system", "content": build_system_prompt(user, style_samples)},
        *history,
        {"role": "user", "content": content},
    ]

    client = _get_client()

    try:
        # 5. First model call
        response = await client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=1000,
        )

        # 6. Resolve tool calls (bounded loop)
        rounds = 0
        executed_tool_calls: list[dict] = []
        while (
            response.choices[0].finish_reason == "tool_calls"
            and rounds < MAX_TOOL_ROUNDS
        ):
            rounds += 1
            assistant_msg = response.choices[0].message
            messages.append(assistant_msg.model_dump(exclude_none=True))

            for tool_call in assistant_msg.tool_calls or []:
                func_name = tool_call.function.name
                try:
                    func_args = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    func_args = {}

                result = await execute_db_function(
                    func_name, func_args, user.id, db
                )
                executed_tool_calls.append(
                    {"name": func_name, "arguments": func_args}
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )

            response = await client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=1000,
            )

        final_reply = (
            response.choices[0].message.content
            or "I don't have that information."
        )
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

    # 7. Persist turn
    await save_message(
        session_id,
        "user",
        user_message,
        media_type,
        media_url,
        db,
        tool_calls={"calls": executed_tool_calls} if executed_tool_calls else None,
    )
    await save_message(session_id, "assistant", final_reply, "text", None, db)

    return {"reply": final_reply, "transcription": transcription}
