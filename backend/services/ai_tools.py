import logging
import re
import uuid
from decimal import Decimal
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    Booking, DeliveryRule, Escalation, Item, ItemVariant,
    Offer, Package, BusinessPolicy, TimeSlot, ChatSession, User
)

logger = logging.getLogger("ai_tools")

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
    
    # Cap to max 50 items
    if len(rows) > 50:
        rows = rows[:50]
        capped = True
    else:
        capped = False

    return {
        "query": query,
        "matched": matched,
        "count": len(rows),
        "items": [_serialize_item(i) for i in rows] if rows else [],
        "categories": cats,
        "note": (
            "no item matched the query; showing full catalog (capped at 50)"
            if not matched
            else ("no items in catalog" if not rows else (
                "showing top 50 matches" if capped else ""
            ))
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
    reason = (func_args.get("reason", "unspecified") or "unspecified").strip()
    details = func_args.get("details")
    full_reason = None
    if len(reason) > 100:
        full_reason = reason
        reason = reason[:97].rstrip() + "..."
        details = f"Full reason: {full_reason}\n\n{details}" if details else f"Full reason: {full_reason}"

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
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            raise

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
    from datetime import date, datetime, timedelta
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

    # SSRF & Overbooking fix: validate slot capacity
    day_of_week = bk_date.weekday()
    from sqlalchemy import select, func as sqlfunc
    
    # 1. Verify slot exists
    slot_stmt = select(TimeSlot).where(
        TimeSlot.user_id == user_id,
        TimeSlot.day_of_week == day_of_week,
        TimeSlot.start_time <= bk_time,
        TimeSlot.end_time >= bk_time,
        TimeSlot.is_active.is_(True)
    )
    slot = (await db.execute(slot_stmt)).scalars().first()
    if not slot:
        return {"error": "The requested time is outside available business hours."}
        
    # 2. Check capacity
    count_stmt = select(sqlfunc.count()).where(
        Booking.user_id == user_id,
        Booking.booking_date == bk_date,
        Booking.booking_time == bk_time,
        Booking.status.in_(["pending", "confirmed"])
    )
    existing_count = (await db.execute(count_stmt)).scalar() or 0
    if existing_count >= slot.max_bookings_per_slot:
        return {"error": "Sorry, this time slot is already fully booked. Please choose another time."}

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
