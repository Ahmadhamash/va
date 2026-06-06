import logging
import re
import uuid
from difflib import SequenceMatcher
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
                "For an empty `query`, returns a short overview only "
                "(names/categories) so the assistant can answer broad questions "
                "without prices or long details. For a non-empty query, returns "
                "matching items with full details."
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
            "name": "get_business_info",
            "description": (
                "Get general business information and FAQ-like knowledge such as "
                "location, working hours, contact details, branches, and other "
                "general/custom policies configured by the business."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": (
                "Look up order or delivery status when the customer asks to "
                "track an order, asks where their order is, or provides an "
                "order number/reference. If no order tracking data exists, "
                "return that clearly and escalate instead of guessing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "order_reference": {
                        "type": "string",
                        "description": "Order number/reference mentioned by the customer, if any",
                    },
                },
            },
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

_INTENT_TOOL_NAMES = {
    "sales": {"get_catalog", "get_offers", "get_packages", "get_payment_methods"},
    "support": {"get_delivery_info", "get_policies", "get_business_info", "get_order_status"},
    "booking": {"get_available_slots", "create_booking"},
    "general": set(),
}


def get_tools_for_intents(intents: list[str] | tuple[str, ...] | set[str]) -> list[dict]:
    base = [t for t in TOOLS if t["function"]["name"] == "escalate_to_human"]
    allowed: set[str] = set()
    for intent in intents:
        allowed.update(_INTENT_TOOL_NAMES.get(intent, set()))
    return base + [t for t in TOOLS if t["function"]["name"] in allowed]


def get_tools_for_intent(intent: str) -> list[dict]:
    return get_tools_for_intents([intent])


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


_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u0640]")
_TOKEN_SPLIT_RE = re.compile(r"[\s,\u060c/\\|+\-_.:;\u061f?!()]+")

_SEARCH_STOPWORDS = {
    "\u0633\u0639\u0631", "\u0627\u0644\u0633\u0639\u0631", "\u0628\u0643\u0645",
    "\u0643\u0645", "\u0643\u0627\u0645", "\u0642\u062f\u064a\u0634",
    "\u0628\u0642\u062f\u064a\u0634", "\u062d\u0642\u0647", "\u062d\u0642\u0647\u0627",
    "\u0645\u062a\u0648\u0641\u0631", "\u0645\u062a\u0648\u0641\u0631\u0647",
    "\u0645\u0648\u062c\u0648\u062f", "\u0645\u0648\u062c\u0648\u062f\u0647",
    "\u0639\u0646\u062f\u0643\u0645", "\u0628\u062f\u064a", "\u0627\u0631\u064a\u062f",
    "\u0627\u0628\u063a\u0649", "\u0639\u0627\u064a\u0632", "\u0645\u0646\u062a\u062c",
    "\u0645\u0646\u062a\u062c\u0627\u062a",
    "price", "cost", "available", "availability", "stock", "product",
    "products", "do", "you", "have", "is", "the", "a", "an", "for",
}

_SEARCH_SYNONYM_GROUPS = (
    (
        "headphone", "headphones", "headset", "earphone", "earphones",
        "earbud", "earbuds", "airpods", "\u0647\u064a\u062f\u0641\u0648\u0646",
        "\u0633\u0645\u0627\u0639\u0647", "\u0633\u0645\u0627\u0639\u0627\u062a",
        "\u0627\u064a\u0631\u0628\u0648\u062f\u0632",
    ),
    (
        "charger", "chargers", "adapter", "adaptor", "\u0634\u0627\u062d\u0646",
        "\u0634\u0648\u0627\u062d\u0646", "\u0627\u062f\u0627\u0628\u062a\u0631",
    ),
    (
        "cable", "wire", "usb", "\u0643\u0627\u0628\u0644", "\u0648\u0635\u0644\u0647",
        "\u0633\u0644\u0643",
    ),
    (
        "case", "cover", "\u0643\u0641\u0631", "\u062c\u0631\u0627\u0628",
        "\u063a\u0637\u0627\u0621", "\u0643\u0648\u0641\u0631",
    ),
    (
        "phone", "mobile", "smartphone", "\u0647\u0627\u062a\u0641",
        "\u0645\u0648\u0628\u0627\u064a\u0644", "\u062c\u0648\u0627\u0644",
        "\u062a\u0644\u0641\u0648\u0646",
    ),
    ("watch", "smartwatch", "\u0633\u0627\u0639\u0647", "\u0633\u0627\u0639\u0627\u062a"),
    ("speaker", "speakers", "\u0633\u0628\u064a\u0643\u0631", "\u0645\u0643\u0628\u0631"),
    ("perfume", "fragrance", "\u0639\u0637\u0631", "\u0639\u0637\u0648\u0631"),
    ("bag", "purse", "\u062d\u0642\u064a\u0628\u0647", "\u0634\u0646\u0637\u0647"),
    (
        "shoe", "shoes", "sneaker", "sneakers", "\u062d\u0630\u0627\u0621",
        "\u0643\u0646\u062f\u0631\u0647", "\u062c\u0632\u0645\u0647",
    ),
    ("shirt", "tshirt", "t-shirt", "\u0642\u0645\u064a\u0635", "\u062a\u064a\u0634\u064a\u0631\u062a"),
    ("dress", "\u0641\u0633\u062a\u0627\u0646", "\u0641\u0633\u0627\u062a\u064a\u0646"),
    ("pants", "jeans", "\u0628\u0646\u0637\u0644\u0648\u0646", "\u062c\u064a\u0646\u0632"),
    ("laptop", "notebook", "\u0644\u0627\u0628\u062a\u0648\u0628", "\u0644\u0627\u0628", "\u0643\u0645\u0628\u064a\u0648\u062a\u0631"),
    ("keyboard", "\u0643\u064a\u0628\u0648\u0631\u062f", "\u0644\u0648\u062d\u0647 \u0645\u0641\u0627\u062a\u064a\u062d"),
    ("mouse", "\u0645\u0627\u0648\u0633", "\u0641\u0627\u0631\u0647"),
    ("camera", "\u0643\u0627\u0645\u064a\u0631\u0627"),
)


def _normalise_search_text(text: str | None) -> str:
    text = (text or "").strip().lower()
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    for src, dst in {
        "\u0623": "\u0627",
        "\u0625": "\u0627",
        "\u0622": "\u0627",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }.items():
        text = text.replace(src, dst)
    return text


def _strip_arabic_article(token: str) -> str:
    if token.startswith("\u0627\u0644") and len(token) > 4:
        return token[2:]
    return token


def _spelling_variants(token: str) -> set[str]:
    variants = {token}
    if token.endswith("\u0647") and len(token) > 2:
        variants.add(token[:-1] + "\u0629")
    if "\u064a" in token:
        variants.add(token.replace("\u064a", "\u0649"))
    return {v for v in variants if len(v) >= 2}


def _expand_tokens(tokens: list[str]) -> list[str]:
    expanded = set(tokens)
    token_set = {_normalise_search_text(t) for t in tokens}
    for group in _SEARCH_SYNONYM_GROUPS:
        normalised_group = {_normalise_search_text(t) for t in group}
        if token_set & normalised_group:
            expanded.update(normalised_group)

    with_variants: set[str] = set()
    for token in expanded:
        with_variants.update(_spelling_variants(token))
    return sorted(with_variants)


def _tokens(query: str) -> list[str]:
    raw = _TOKEN_SPLIT_RE.split((query or "").strip().lower())
    out: list[str] = []
    for token in raw:
        normalised = _strip_arabic_article(_normalise_search_text(token))
        if len(normalised) < 2 or normalised in _SEARCH_STOPWORDS:
            continue
        out.append(normalised)
    return _expand_tokens(out)


def _item_search_text(item: Item) -> tuple[str, str, str]:
    name = _normalise_search_text(getattr(item, "name", "") or "")
    category = _normalise_search_text(getattr(item, "category", "") or "")
    description = _normalise_search_text(getattr(item, "description", "") or "")
    metadata = getattr(item, "item_metadata", None) or {}
    if isinstance(metadata, dict):
        metadata_text = " ".join(str(v) for v in metadata.values() if v is not None)
        description = f"{description} {_normalise_search_text(metadata_text)}"
    return name, category, description


def _item_match_score(item: Item, query: str, tokens: list[str]) -> float:
    name, category, description = _item_search_text(item)
    full_text = f"{name} {category} {description}".strip()
    normalised_query = _normalise_search_text(query)
    score = 0.0

    if normalised_query and normalised_query in full_text:
        score += 3.0

    item_words = set(_TOKEN_SPLIT_RE.split(full_text))
    item_words.discard("")
    for token in tokens:
        if token in name:
            score += 4.0
        elif token in category:
            score += 3.0
        elif token in description:
            score += 1.5

        if token in item_words:
            score += 1.0
            continue

        best_ratio = max(
            (SequenceMatcher(None, token, word).ratio() for word in item_words),
            default=0.0,
        )
        if best_ratio >= 0.88:
            score += 2.0
        elif best_ratio >= 0.78:
            score += 1.0

    return score


def _rank_catalog_rows(query: str, rows: list[Item], tokens: list[str]) -> list[Item]:
    scored = [(_item_match_score(item, query, tokens), item) for item in rows]
    scored = [(score, item) for score, item in scored if score >= 2.0]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored]


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
        "get_business_info": lambda: _exec_get_business_info(user_id, db),
        "get_order_status": lambda: _exec_get_order_status(
            func_args, user_id, session_id, db
        ),
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

    if query and tokens:
        conds = []
        for tok in tokens:
            like = f"%{tok}%"
            conds.append(Item.name.ilike(like))
            conds.append(Item.description.ilike(like))
            conds.append(Item.category.ilike(like))
        stmt = base.where(or_(*conds))
        rows = list((await db.execute(stmt)).scalars().unique().all())
        if rows:
            rows = _rank_catalog_rows(query, rows, tokens)
        if not rows:
            candidates = list(
                (await db.execute(base.limit(500))).scalars().unique().all()
            )
            rows = _rank_catalog_rows(query, candidates, tokens)
        matched = bool(rows)
    elif query:
        rows = []
        matched = False
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

    if not query:
        overview_items = [
            {
                "name": item.name,
                "category": item.category,
            }
            for item in rows
        ]
        return {
            "query": query,
            "matched": matched,
            "overview_only": True,
            "count": len(rows),
            "items": overview_items,
            "categories": cats,
            "instruction": (
                "Broad catalog overview only: reply with product/category names "
                "only. Do not mention prices, descriptions, stock, warranty, "
                "availability, variants, or other details. Ask what the customer "
                "is interested in so you can explain more."
            ),
            "note": "no items in catalog" if not rows else (
                "showing top 50 names/categories" if capped else ""
            ),
        }

    return {
        "query": query,
        "matched": matched,
        "overview_only": False,
        "count": len(rows),
        "items": [_serialize_item(i) for i in rows] if rows else [],
        "categories": cats,
        "note": (
            "no item matched the query; do not mention unrelated catalog items"
            if not matched
            else ("no items in catalog" if not rows else (
                "showing top 50 matches" if capped else ""
            ))
        ),
        "instruction": (
            "No product matched this specific query. Do not answer with any "
            "other products, prices, stock, warranty, variants, or availability. "
            "Say the item was not found and ask for a clearer name/photo, or "
            "escalate if the customer needs a human."
            if not matched
            else ""
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


async def _exec_get_business_info(user_id: uuid.UUID, db: AsyncSession) -> dict:
    user = await db.get(User, user_id)
    result = await db.execute(
        select(BusinessPolicy)
        .where(
            BusinessPolicy.user_id == user_id,
            BusinessPolicy.is_active.is_(True),
            BusinessPolicy.policy_type.in_(("general", "custom")),
        )
        .order_by(BusinessPolicy.created_at.desc())
    )
    policies = list(result.scalars().all())
    return {
        "business_info": {
            "business_name": user.business_name if user else None,
            "business_type": user.business_type if user else None,
            "payment_methods_configured": bool(user and user.payment_methods),
            "general_policies": [
                {
                    "type": p.policy_type,
                    "title": p.title,
                    "content": p.content,
                }
                for p in policies
            ],
        },
        "note": (
            "No general business info policies configured"
            if not policies
            else ""
        ),
    }


async def _exec_get_order_status(
    func_args: dict,
    user_id: uuid.UUID,
    session_id: uuid.UUID | None,
    db: AsyncSession,
) -> dict:
    reference = str(func_args.get("order_reference") or "").strip()
    session = await db.get(ChatSession, session_id) if session_id else None
    metadata = session.metadata_ if session and isinstance(session.metadata_, dict) else {}
    order_sources = [
        metadata.get("orders"),
        metadata.get("order_statuses"),
        metadata.get("order_tracking"),
    ]

    for source in order_sources:
        if isinstance(source, dict):
            orders = list(source.values())
        elif isinstance(source, list):
            orders = source
        else:
            orders = []

        for order in orders:
            if not isinstance(order, dict):
                continue
            identifiers = {
                str(order.get("id") or ""),
                str(order.get("order_id") or ""),
                str(order.get("reference") or ""),
                str(order.get("tracking_number") or ""),
            }
            if reference and reference in identifiers:
                return {
                    "matched": True,
                    "order_reference": reference,
                    "order_status": order,
                    "instruction": "Answer only from this order_status object.",
                }

    return {
        "matched": False,
        "order_reference": reference,
        "order_status": None,
        "note": (
            "No order tracking integration or matching order data is configured "
            "for this conversation."
        ),
        "instruction": (
            "Do not invent an order status, delivery ETA, carrier, or tracking "
            "number. Say you cannot see the order status and escalate to a "
            "human if the customer needs follow-up."
        ),
    }


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
