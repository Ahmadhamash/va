import io
import json
import logging
import re
import uuid
from decimal import Decimal

import httpx
from openai import APIError, AsyncOpenAI
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    Booking, BusinessPolicy, BusinessWorkflow, ChatSession, DeliveryRule, Escalation,
    Item, ItemVariant, Message, Offer, Package, PricingRule, StyleSample,
    TimeSlot, User,
)
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
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_catalog",
            "description": (
                "THE catalog lookup. Call this on EVERY product/price/"
                "availability/category/warranty/stock question, before answering. "
                "Pass `query` with the product name or keyword the customer mentioned "
                "(e.g. 'سماعة', 'headphone', 'charger'). Leave `query` empty for "
                "general questions like 'what do you have' or 'which sections'. "
                "Returns matching items (name, price, currency, availability, "
                "description, warranty info, stock status, variants/options) "
                "plus the list of categories."
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
    {
        "type": "function",
        "function": {
            "name": "get_delivery_info",
            "description": (
                "Get delivery/shipping information for this business. "
                "Call this when a customer asks about delivery, shipping, "
                "delivery fees, delivery areas, pickup, or delivery time. "
                "Returns delivery zones, fees, free-delivery thresholds, "
                "and whether pickup is available."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": (
                "Transfer the conversation to a human agent. "
                "Call this when: the customer is angry or frustrated, "
                "wants to return/cancel an order, has a payment problem, "
                "keeps repeating the same question, you are not confident "
                "in your answer, you do not understand the question, "
                "you start repeating yourself or hallucinating, "
                "or there is a complaint. "
                "Pass a short reason explaining why you are escalating."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Short reason for escalation (e.g. 'angry customer', 'return request', 'payment issue')",
                    },
                    "details": {
                        "type": "string",
                        "description": "Additional context about the situation",
                    },
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_offers",
            "description": (
                "Get current active offers, promotions, and discounts. "
                "Call this when a customer asks about discounts, deals, "
                "promotions, promo codes, or sales."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_packages",
            "description": (
                "Get available product bundles/packages. "
                "Call this when a customer asks about bundles, packages, "
                "combo deals, or grouped offerings."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_policies",
            "description": (
                "Get business policies (return, exchange, payment, etc.). "
                "Call this when a customer asks about return policy, exchange, "
                "refund, payment terms, or any business rules."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_available_slots",
            "description": (
                "Get available booking/appointment slots. "
                "Call this when a customer wants to book an appointment, "
                "reserve a time, or check availability. "
                "Pass a date (YYYY-MM-DD) or leave empty for tomorrow."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target_date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (default: tomorrow)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": (
                "Create a new booking/appointment for a customer. "
                "Call this when a customer confirms they want to book. "
                "You need: customer name, date, and time. "
                "Phone and service name are optional."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Customer's name"},
                    "customer_phone": {"type": "string", "description": "Customer's phone (optional)"},
                    "service_name": {"type": "string", "description": "Service or item to book"},
                    "booking_date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "booking_time": {"type": "string", "description": "Time in HH:MM format"},
                },
                "required": ["customer_name", "booking_date", "booking_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_methods",
            "description": (
                "Get available payment methods for this business. "
                "Call this when a customer asks how to pay, payment options, "
                "or any payment-related question."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def build_system_prompt(
    user: User, 
    style_samples: list[str] | None = None,
    workflows: list[BusinessWorkflow] | None = None,
) -> str:
    business = user.business_name or "this business"
    persona = user.ai_persona or "Friendly, professional, and helpful."

    payment_info = "Payment Methods Available:\n"
    if user.payment_methods:
        for k, v in user.payment_methods.items():
            payment_info += f"- {k}: {v}\n"
    else:
        payment_info += "No specific payment methods configured.\n"

    workflow_block = ""
    if workflows:
        workflow_block = "\n\n## AUTOMATED ACTIONS & WORKFLOWS:\n"
        workflow_block += "The business owner has configured specific actions for certain scenarios. You MUST execute these when the user's intent matches the trigger event.\n"
        for idx, wf in enumerate(workflows, start=1):
            workflow_block += f"\nRule {idx}:\n"
            workflow_block += f"- Trigger Event: When the user intent matches '{wf.trigger_event}'\n"
            workflow_block += f"- Required Action: Send a {wf.action_type} with this EXACT content: {wf.content}\n"

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
- **get_catalog**: Call it FIRST on every product, price, availability, warranty,
  stock, color, size, or category question. Put the product keyword in `query`.
  Leave `query` empty for general questions.
  Answer ONLY from the returned items/categories.
- **get_delivery_info**: Call this when the customer asks about delivery, shipping,
  delivery fees, areas, pickup, or delivery time.
- **get_offers**: Call this when the customer asks about discounts, deals,
  promotions, sales, promo codes, or special offers.
- **get_packages**: Call this when the customer asks about bundles, packages,
  combo deals, or grouped product offerings.
- **get_policies**: Call this when the customer asks about return policy, exchange,
  refund, payment terms, warranties, or any business rules.
- **get_available_slots**: Call this when the customer wants to book an appointment,
  reserve a time, or check available slots.
- **create_booking**: Call this ONLY after the customer confirms they want to book.
  You need their name, date, and time. Confirm the booking details before calling.
- **get_payment_methods**: Call this when the customer asks about payment options.
- **escalate_to_human**: Call this when:
  • The customer is angry, frustrated, or using aggressive language
  • The customer wants to return, exchange, or cancel an order
  • There is a payment or billing issue
  • The customer keeps repeating the same question (you already answered)
  • You are NOT confident in your answer, don't understand, or get confused
  • There is a complaint or a serious problem
  • The question is too complex or outside your scope
  When you escalate, reply EXACTLY with the phrase provided by the tool output.

## PRODUCT DETAILS:
When answering about products, include all relevant information returned:
- Name, price, currency, availability
- **Warranty**: duration, terms, coverage, exclusions (if available)
- **Stock**: quantity and status (if tracked)
- **Variants/Options**: available colors, sizes, flavors, models etc.
  Mention which variants are available and which are out of stock.
- **Delivery**: when asked, use get_delivery_info to provide delivery zones,
  fees, free-delivery thresholds, and pickup options.
- **Pricing rules**: if there are quantity discounts or special pricing, mention them.
- **Offers**: if there are active promotions, mention applicable ones.

## BOOKINGS:
- When a customer wants to book, first call get_available_slots to show available times.
- Confirm the customer's choice before calling create_booking.
- After booking, tell the customer the booking is confirmed with details.

## LANGUAGE & FORMATTING:
- Reply in the SAME language the customer uses.
- When replying in Arabic, keep numbers, prices, currency codes, English words,
  emails and URLs EXACTLY as returned (left-to-right, unchanged). Put Latin/
  numeric tokens on their own or wrap them so they don't get reversed, e.g.
  write: السعر 45 USD  (never reorder the digits or letters).
- The customer may split one question across several messages; treat the whole
  batch as a single question and answer once, clearly.
- Keep responses concise and helpful.
- For payment info, use this detail:
{payment_info}
{workflow_block}{style_block}
""".strip()


# ─── DB tools ────────────────────────────────────────────────────────────────
def _serialize_variant(v: ItemVariant) -> dict:
    return {
        "option_type": v.option_type,
        "option_value": v.option_value,
        "price_override": float(v.price_override) if v.price_override else None,
        "available": v.available,
        "stock_quantity": v.stock_quantity,
    }


def _serialize_item(item: Item) -> dict:
    data = {
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
    # Warranty info
    if item.warranty_duration:
        data["warranty"] = {
            "duration": item.warranty_duration,
            "terms": item.warranty_terms,
            "coverage": item.warranty_coverage,
            "exclusions": item.warranty_exclusions,
        }
    # Stock info
    data["stock"] = {
        "status": item.stock_status,
        "quantity": item.stock_quantity,
    }
    # Variants
    if item.variants:
        data["variants"] = [_serialize_variant(v) for v in item.variants]
    return data


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
    func_name: str, func_args: dict, user_id: uuid.UUID, db: AsyncSession,
    session_id: uuid.UUID | None = None,
) -> dict:
    handlers = {
        "get_catalog": lambda: _exec_get_catalog(func_args, user_id, db),
        "get_delivery_info": lambda: _exec_get_delivery_info(user_id, db),
        "escalate_to_human": lambda: _exec_escalate(func_args, user_id, session_id, db),
        "get_offers": lambda: _exec_get_offers(user_id, db),
        "get_packages": lambda: _exec_get_packages(user_id, db),
        "get_policies": lambda: _exec_get_policies(user_id, db),
        "get_available_slots": lambda: _exec_get_available_slots(func_args, user_id, db),
        "create_booking": lambda: _exec_create_booking(func_args, user_id, session_id, db),
        "get_payment_methods": lambda: _exec_get_payment_methods(user_id, db),
    }
    handler = handlers.get(func_name)
    if handler is None:
        return {"error": f"unknown function {func_name}"}
    try:
        return await handler()
    except Exception:
        logger.exception("execute_db_function failed: %s", func_name)
        return {"error": "could not retrieve that information"}


async def _exec_get_catalog(func_args: dict, user_id: uuid.UUID, db: AsyncSession) -> dict:
    base = select(Item).options(selectinload(Item.variants)).where(Item.user_id == user_id)
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
        rows = list((await db.execute(stmt)).scalars().unique().all())
        if not rows:
            rows = list((await db.execute(base)).scalars().unique().all())
            matched = False
        else:
            matched = True
    else:
        rows = list((await db.execute(base)).scalars().unique().all())
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


async def _exec_get_delivery_info(user_id: uuid.UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(DeliveryRule).where(
            DeliveryRule.user_id == user_id,
            DeliveryRule.is_active.is_(True),
        )
    )
    rules = list(result.scalars().all())
    if not rules:
        return {"delivery_zones": [], "note": "No delivery information configured for this business"}

    zones = []
    for r in rules:
        zone = {
            "zone_name": r.zone_name,
            "delivery_fee": float(r.delivery_fee),
            "currency": r.currency,
            "estimated_days": r.estimated_days,
            "pickup_available": r.pickup_available,
        }
        if r.free_above is not None:
            zone["free_delivery_above"] = float(r.free_above)
        if r.notes:
            zone["notes"] = r.notes
        zones.append(zone)
    return {"delivery_zones": zones}


async def _exec_escalate(
    func_args: dict, user_id: uuid.UUID, session_id: uuid.UUID | None, db: AsyncSession
) -> dict:
    reason = func_args.get("reason", "unspecified")
    details = func_args.get("details")

    if session_id:
        esc = Escalation(
            user_id=user_id,
            session_id=session_id,
            reason=reason,
            details=details,
            status="pending",
        )
        db.add(esc)
        # Mark session as escalated so AI stops auto-replying
        session = await db.get(ChatSession, session_id)
        if session:
            session.is_escalated = True
        await db.commit()

        # Send a notification to the business owner (placeholder for email/SMS)
        logger.warning(
            f"ESCALATION NOTIFICATION: Human agent needed for session {session_id}. Reason: {reason}"
        )

    return {
        "escalated": True,
        "reason": reason,
        "message": "The conversation has been escalated to a human agent. "
                   "Reply EXACTLY with this friendly phrase (do not add anything else): "
                   "لحظة من فضلك، رح أحولك لزميلي ليقدر يساعدك بشكل أفضل.",
    }


async def _exec_get_offers(user_id: uuid.UUID, db: AsyncSession) -> dict:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Offer).where(
            Offer.user_id == user_id,
            Offer.is_active.is_(True),
        )
    )
    offers = []
    for o in result.scalars().all():
        # Filter out expired offers
        if o.expires_at and o.expires_at < now:
            continue
        if o.starts_at and o.starts_at > now:
            continue
        offers.append({
            "title": o.title,
            "description": o.description,
            "type": o.offer_type,
            "discount_value": float(o.discount_value) if o.discount_value else None,
            "min_quantity": o.min_quantity,
            "promo_code": o.promo_code,
            "expires_at": o.expires_at.isoformat() if o.expires_at else None,
        })
    if not offers:
        return {"offers": [], "note": "No active offers at the moment"}
    return {"offers": offers}


async def _exec_get_packages(user_id: uuid.UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Package).where(
            Package.user_id == user_id,
            Package.is_active.is_(True),
        )
    )
    packages = []
    for p in result.scalars().all():
        packages.append({
            "name": p.name,
            "description": p.description,
            "price": float(p.price) if p.price else None,
            "currency": p.currency,
            "items": p.package_items,
        })
    if not packages:
        return {"packages": [], "note": "No packages available"}
    return {"packages": packages}


async def _exec_get_policies(user_id: uuid.UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(BusinessPolicy).where(
            BusinessPolicy.user_id == user_id,
            BusinessPolicy.is_active.is_(True),
        )
    )
    policies = []
    for p in result.scalars().all():
        policies.append({
            "type": p.policy_type,
            "title": p.title,
            "content": p.content,
        })
    if not policies:
        return {"policies": [], "note": "No policies configured"}
    return {"policies": policies}


async def _exec_get_available_slots(
    func_args: dict, user_id: uuid.UUID, db: AsyncSession
) -> dict:
    from datetime import date, datetime, timedelta, time as t
    target_str = func_args.get("target_date", "")
    try:
        target_date = date.fromisoformat(target_str) if target_str else date.today() + timedelta(days=1)
    except ValueError:
        target_date = date.today() + timedelta(days=1)

    DAY_NAMES = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
    day_of_week = target_date.weekday()

    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.user_id == user_id,
            TimeSlot.day_of_week == day_of_week,
            TimeSlot.is_active.is_(True),
        )
    )
    slots = list(result.scalars().all())
    if not slots:
        return {
            "date": target_date.isoformat(),
            "day": DAY_NAMES[day_of_week],
            "available_slots": [],
            "note": "No available slots on this day",
        }

    # Count existing bookings
    from sqlalchemy import func as sqlfunc
    bk_result = await db.execute(
        select(Booking.booking_time, sqlfunc.count())
        .where(
            Booking.user_id == user_id,
            Booking.booking_date == target_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
        .group_by(Booking.booking_time)
    )
    booked = dict(bk_result.all())

    available = []
    for slot in slots:
        current_time = datetime.combine(target_date, slot.start_time)
        end = datetime.combine(target_date, slot.end_time)
        while current_time + timedelta(minutes=slot.slot_duration_minutes) <= end:
            slot_time = current_time.time()
            existing = booked.get(slot_time, 0)
            if existing < slot.max_bookings_per_slot:
                available.append({
                    "time": slot_time.strftime("%H:%M"),
                    "remaining": slot.max_bookings_per_slot - existing,
                })
            current_time += timedelta(minutes=slot.slot_duration_minutes)

    return {
        "date": target_date.isoformat(),
        "day": DAY_NAMES[day_of_week],
        "available_slots": available,
    }


async def _exec_create_booking(
    func_args: dict, user_id: uuid.UUID, session_id: uuid.UUID | None, db: AsyncSession
) -> dict:
    from datetime import date, time as t
    try:
        bk_date = date.fromisoformat(func_args.get("booking_date", ""))
        parts = func_args.get("booking_time", "").split(":")
        bk_time = t(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return {"error": "Invalid date or time format. Use YYYY-MM-DD and HH:MM."}

    customer_name = func_args.get("customer_name", "")
    if not customer_name:
        return {"error": "Customer name is required."}

    booking = Booking(
        user_id=user_id,
        session_id=session_id,
        customer_name=customer_name,
        customer_phone=func_args.get("customer_phone"),
        service_name=func_args.get("service_name"),
        booking_date=bk_date,
        booking_time=bk_time,
        status="pending",
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    return {
        "booked": True,
        "booking_id": str(booking.id),
        "customer_name": customer_name,
        "date": bk_date.isoformat(),
        "time": bk_time.strftime("%H:%M"),
        "status": "pending",
        "message": "Booking created successfully. Inform the customer their booking is confirmed.",
    }


async def _exec_get_payment_methods(user_id: uuid.UUID, db: AsyncSession) -> dict:
    user = await db.get(User, user_id)
    if not user or not user.payment_methods:
        return {"payment_methods": {}, "note": "No payment methods configured"}
    return {"payment_methods": user.payment_methods}


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


# ─── External media helpers (Facebook CDN etc.) ─────────────────────────────
async def _download_bytes(url: str) -> bytes:
    """Download content from an external URL (e.g. Facebook CDN)."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def _encode_image_from_url(url: str) -> tuple[str, str]:
    """Download an image from URL and return (base64_string, mime_type)."""
    data = await _download_bytes(url)
    # Detect MIME from magic bytes
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data[:3] == b"GIF":
        mime = "image/gif"
    else:
        mime = "image/jpeg"
    return base64.b64encode(data).decode("utf-8"), mime


async def _transcribe_from_url(url: str, db: AsyncSession) -> str:
    """Download audio from URL and transcribe via Whisper."""
    data = await _download_bytes(url)
    key = await effective_openai_key(db)
    audio_file = io.BytesIO(data)
    audio_file.name = "audio.mp4"  # OpenAI SDK needs a filename with extension
    transcript = await _client_for(key).audio.transcriptions.create(
        model=TRANSCRIBE_MODEL, file=audio_file, response_format="text",
    )
    return transcript if isinstance(transcript, str) else getattr(transcript, "text", "")


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
        content: object = [
            {
                "type": "text",
                "text": combined_text or "What do you see in this image?",
            },
        ]
        for img_url in image_urls:
            try:
                b64, mime = await _encode_image_from_url(img_url)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{b64}",
                        "detail": "high",
                    },
                })
            except Exception:  # noqa: BLE001
                logger.exception("image download/encode failed")
    else:
        content = combined_text

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
    await db.commit()

    await save_message(session_id, "assistant", reply, "text", None, db)

    return {
        "reply": reply,
        "channel": session.channel,
        "external_user_id": session.external_user_id,
        "user_id": str(user.id),
    }
