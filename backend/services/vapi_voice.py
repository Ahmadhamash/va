from __future__ import annotations

import json
import logging
import re
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings as env_settings
from models import (
    BusinessPolicy,
    ChatSession,
    DeliveryRule,
    HandoffSession,
    Item,
    ItemVariant,
    User,
    VapiCallSettings,
    VoiceCall,
    VoiceCallEvent,
    VoiceLead,
    VoiceToolCall,
)
from services.handoff_service import create_handoff
from services.prompt_settings import get_client_prompt_overrides

logger = logging.getLogger("vapi_voice")

MAX_TOOL_RESULTS = 8


@dataclass
class VapiCallContext:
    settings: VapiCallSettings
    user: User
    user_id: uuid.UUID
    business_name: str | None
    payment_methods: dict
    voice_call: VoiceCall | None
    voice_call_id: uuid.UUID | None
    chat_session_id: uuid.UUID | None
    message: dict[str, Any]
    call_id: str | None
    prompt_overrides: dict[str, str]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Vapi timestamps are commonly milliseconds.
        seconds = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, timezone.utc).replace(tzinfo=None)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _normalise(text: str | None) -> str:
    text = (text or "").strip().lower()
    for src, dst in {
        "\u0623": "\u0627",
        "\u0625": "\u0627",
        "\u0622": "\u0627",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }.items():
        text = text.replace(src, dst)
    return re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)


def _safe_str(value: Any, max_len: int = 500) -> str:
    return str(value or "").strip()[:max_len]


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _call_object(message: dict[str, Any]) -> dict[str, Any]:
    call = message.get("call")
    return call if isinstance(call, dict) else {}


def _call_id_from_message(message: dict[str, Any]) -> str | None:
    call = _call_object(message)
    return call.get("id") or message.get("callId") or message.get("call_id")


def _assistant_id_from_message(message: dict[str, Any]) -> str | None:
    call = _call_object(message)
    assistant = message.get("assistant") if isinstance(message.get("assistant"), dict) else {}
    call_assistant = call.get("assistant") if isinstance(call.get("assistant"), dict) else {}
    return (
        call.get("assistantId")
        or call_assistant.get("id")
        or assistant.get("id")
        or message.get("assistantId")
    )


def _phone_number_id_from_message(message: dict[str, Any]) -> str | None:
    call = _call_object(message)
    phone_number = message.get("phoneNumber") if isinstance(message.get("phoneNumber"), dict) else {}
    call_phone_number = call.get("phoneNumber") if isinstance(call.get("phoneNumber"), dict) else {}
    return (
        call.get("phoneNumberId")
        or call_phone_number.get("id")
        or phone_number.get("id")
        or message.get("phoneNumberId")
    )


def _customer_from_message(message: dict[str, Any]) -> dict[str, Any]:
    call = _call_object(message)
    customer = message.get("customer") if isinstance(message.get("customer"), dict) else {}
    call_customer = call.get("customer") if isinstance(call.get("customer"), dict) else {}
    return {**call_customer, **customer}


def _customer_phone_from_message(message: dict[str, Any]) -> str | None:
    customer = _customer_from_message(message)
    call = _call_object(message)
    return (
        customer.get("number")
        or customer.get("phoneNumber")
        or call.get("customerNumber")
        or message.get("customerNumber")
    )


def _direction_from_message(message: dict[str, Any]) -> str:
    call = _call_object(message)
    call_type = str(call.get("type") or message.get("type") or "").lower()
    if "outbound" in call_type:
        return "outbound"
    if "web" in call_type:
        return "web"
    return "inbound"


def _tool_calls_from_message(message: dict[str, Any]) -> list[dict[str, Any]]:
    calls = message.get("toolCallList") or message.get("toolCalls") or []
    if not isinstance(calls, list):
        return []
    parsed: list[dict[str, Any]] = []
    for call in calls:
        if not isinstance(call, dict):
            continue
        function = call.get("function") if isinstance(call.get("function"), dict) else {}
        parsed.append(
            {
                "id": call.get("id") or call.get("toolCallId") or function.get("id"),
                "name": call.get("name") or function.get("name"),
                "arguments": call.get("arguments") or function.get("arguments") or function.get("parameters") or {},
            }
        )
    return parsed


async def get_or_create_call_settings(user_id: uuid.UUID, db: AsyncSession) -> VapiCallSettings:
    result = await db.execute(
        select(VapiCallSettings).where(VapiCallSettings.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row

    row = VapiCallSettings(
        user_id=user_id,
        public_id=secrets.token_urlsafe(24),
        assistant_id=env_settings.VAPI_DEFAULT_ASSISTANT_ID or None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def resolve_call_context(
    public_id: str,
    payload: dict[str, Any],
    db: AsyncSession,
) -> VapiCallContext:
    message = payload.get("message") if isinstance(payload.get("message"), dict) else payload
    if not isinstance(message, dict):
        message = {}

    settings_result = await db.execute(
        select(VapiCallSettings).where(VapiCallSettings.public_id == public_id)
    )
    call_settings = settings_result.scalar_one_or_none()
    if call_settings is None:
        raise LookupError("Vapi voice settings not found")

    user = await db.get(User, call_settings.user_id)
    if user is None or not user.is_active:
        raise LookupError("Vapi voice settings owner is unavailable")

    call_id = _call_id_from_message(message)
    voice_call = await ensure_voice_call(
        call_settings=call_settings,
        user=user,
        message=message,
        db=db,
    )
    return VapiCallContext(
        settings=call_settings,
        user=user,
        user_id=user.id,
        business_name=user.business_name,
        payment_methods=user.payment_methods or {},
        voice_call=voice_call,
        voice_call_id=voice_call.id if voice_call else None,
        chat_session_id=voice_call.chat_session_id if voice_call else None,
        message=message,
        call_id=call_id,
        prompt_overrides=await get_client_prompt_overrides(user.id, db),
    )


async def ensure_voice_call(
    *,
    call_settings: VapiCallSettings,
    user: User,
    message: dict[str, Any],
    db: AsyncSession,
) -> VoiceCall | None:
    call_id = _call_id_from_message(message)
    if not call_id:
        return None

    result = await db.execute(select(VoiceCall).where(VoiceCall.vapi_call_id == call_id))
    voice_call = result.scalar_one_or_none()
    if voice_call is not None:
        return voice_call

    customer_phone = _customer_phone_from_message(message)
    customer = _customer_from_message(message)
    title = customer.get("name") or customer_phone or f"Voice call {call_id[:8]}"
    chat_session = ChatSession(
        user_id=user.id,
        channel="voice",
        external_user_id=call_id,
        title=title,
        metadata_={
            "vapi_call_id": call_id,
            "customer_phone": customer_phone,
        },
    )
    db.add(chat_session)
    await db.flush()

    call = _call_object(message)
    started_at = (
        _parse_datetime(call.get("startedAt"))
        or _parse_datetime(call.get("createdAt"))
        or _parse_datetime(message.get("timestamp"))
        or _utcnow()
    )
    voice_call = VoiceCall(
        user_id=user.id,
        call_setting_id=call_settings.id,
        chat_session_id=chat_session.id,
        vapi_call_id=call_id,
        assistant_id=_assistant_id_from_message(message) or call_settings.assistant_id,
        phone_number_id=_phone_number_id_from_message(message) or call_settings.phone_number_id,
        direction=_direction_from_message(message),
        status=str(message.get("status") or call.get("status") or "received"),
        customer_phone=customer_phone,
        customer_name=customer.get("name"),
        started_at=started_at,
    )
    db.add(voice_call)
    await db.flush()
    return voice_call


async def record_vapi_event(
    ctx: VapiCallContext,
    payload: dict[str, Any],
    db: AsyncSession,
) -> None:
    event = VoiceCallEvent(
        voice_call_id=ctx.voice_call_id,
        user_id=ctx.user_id,
        vapi_call_id=ctx.call_id,
        event_type=str(ctx.message.get("type") or "unknown"),
        payload=payload,
    )
    db.add(event)
    await db.flush()


def build_vapi_system_prompt(
    user: User,
    call_settings: VapiCallSettings,
    prompt_override: str | None = None,
) -> str:
    business_name = user.business_name or "المتجر"
    dialect = call_settings.dialect or "أردنية بسيطة"
    if prompt_override and prompt_override.strip():
        return (
            prompt_override.strip()
            .replace("{business_name}", business_name)
            .replace("{dialect}", dialect)
        )
    return f"""أنت مساعد صوتي لمتجر {business_name}.
تحدث بلهجة {dialect} وبجمل قصيرة مناسبة للمكالمة.

قواعد الحقيقة:
- لا تذكر أي سعر إلا إذا رجع من أداة.
- لا تقل إن المنتج أو المقاس أو اللون متوفر إلا بعد check_availability.
- لا تخترع خصومات أو عروض أو مدة توصيل أو سياسة.
- إذا المعلومة غير موجودة قل: "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق".
- إذا ظهر أكثر من منتج محتمل، اسأل سؤالا توضيحيا واحدا.

قواعد المكالمة:
- اسأل سؤالا واحدا كل مرة.
- عند أخذ رقم هاتف أو عنوان أو كمية أو مقاس أو لون، أعده على العميل واطلب التأكيد.
- قبل إنشاء الطلب، اقرأ ملخص الطلب كاملا وانتظر تأكيد العميل.
- عند الغضب أو الشكوى أو طلب موظف أو عدم فهم العميل مرتين، استدع request_human_handoff.

لا تقل إنك ذكاء اصطناعي إلا إذا سئلت مباشرة. عندها قل:
"أنا مساعد صوتي للمتجر، وبقدر أساعدك بالأسعار والطلبات".
"""


def build_vapi_tools() -> list[dict[str, Any]]:
    tenant_field = {
        "type": "string",
        "description": "Optional dynamic tenant_id for observability only. Server ignores it for authorization.",
    }
    return [
        {
            "type": "function",
            "function": {
                "name": "search_products",
                "description": "Search tenant catalog by name, category, color, size, or similar keywords. Do not use this alone to confirm final availability.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "query": {"type": "string"},
                        "category": {"type": "string"},
                        "color": {"type": "string"},
                        "size": {"type": "string"},
                        "max_results": {"type": "integer", "minimum": 1, "maximum": MAX_TOOL_RESULTS},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_product_details",
                "description": "Get exact details for one product from the tenant catalog.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "product_id": {"type": "string"},
                        "product_name": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "check_availability",
                "description": "Confirm product, size, color, and quantity availability before saying it is available.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "product_id": {"type": "string"},
                        "product_name": {"type": "string"},
                        "size": {"type": "string"},
                        "color": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_business_policy",
                "description": "Get tenant policy: delivery, return, exchange, payment, working_hours, or location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "policy_type": {
                            "type": "string",
                            "enum": ["delivery", "return", "exchange", "payment", "working_hours", "location", "general"],
                        },
                    },
                    "required": ["policy_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_order_or_lead",
                "description": "Create a lead/order only after the caller has confirmed the full order summary.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "customer_name": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "product_id": {"type": "string"},
                        "product_name": {"type": "string"},
                        "size": {"type": "string"},
                        "color": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1},
                        "address": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                    "required": ["phone_number"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "request_human_handoff",
                "description": "Escalate to a human for angry customers, complaints, unclear information, or explicit human requests.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "call_id": {"type": "string"},
                        "reason": {"type": "string"},
                        "customer_phone": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                    "required": ["reason"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "save_call_summary",
                "description": "Fallback summary saver. Prefer end-of-call-report when available.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tenant_id": tenant_field,
                        "call_id": {"type": "string"},
                        "customer_phone": {"type": "string"},
                        "transcript": {"type": "string"},
                        "summary": {"type": "string"},
                        "intent": {"type": "string"},
                        "products_discussed": {"type": "array", "items": {"type": "string"}},
                        "order_status": {"type": "string"},
                        "sentiment": {"type": "string"},
                        "needs_followup": {"type": "boolean"},
                    },
                },
            },
        },
    ]


def build_assistant_response(ctx: VapiCallContext) -> dict[str, Any]:
    if not ctx.settings.enabled:
        return {"error": "Voice calls are not enabled for this business."}

    voice_prompt = build_vapi_system_prompt(
        ctx.user,
        ctx.settings,
        ctx.prompt_overrides.get("voice_prompt"),
    )
    variable_values = {
        "business_name": ctx.business_name or "المتجر",
        "tenant_id": str(ctx.user_id),
        "language": ctx.settings.language,
        "dialect": ctx.settings.dialect,
        "handoff_phone": ctx.settings.handoff_phone or "",
        "business_hours": ctx.settings.business_hours or "",
        "voice_prompt": voice_prompt,
    }
    if ctx.settings.assistant_id:
        return {
            "assistantId": ctx.settings.assistant_id,
            "assistantOverrides": {
                "variableValues": variable_values,
            },
        }

    return {
            "assistant": {
            "name": f"{ctx.business_name or 'Business'} Voice Assistant",
            "firstMessage": f"مرحبا، معك مساعد {ctx.business_name or 'المتجر'}. كيف بقدر أساعدك؟",
            "model": {
                "provider": ctx.settings.model_provider,
                "model": ctx.settings.model_name,
                "temperature": 0.2,
                "messages": [
                    {
                        "role": "system",
                        "content": voice_prompt,
                    }
                ],
                "tools": build_vapi_tools(),
            },
        }
    }


async def handle_vapi_webhook(
    public_id: str,
    payload: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    ctx = await resolve_call_context(public_id, payload, db)
    await record_vapi_event(ctx, payload, db)

    message_type = str(ctx.message.get("type") or "")
    if message_type == "assistant-request":
        response = build_assistant_response(ctx)
        await db.commit()
        return response
    if message_type == "tool-calls":
        return await handle_tool_calls(ctx, db)
    if message_type == "end-of-call-report":
        await apply_end_of_call_report(ctx, db)
        return {"ok": True}
    if message_type == "status-update":
        await apply_status_update(ctx, db)
        return {"ok": True}
    if message_type.startswith("transcript"):
        await apply_transcript_update(ctx, db)
        return {"ok": True}
    await db.commit()
    return {"ok": True}


async def handle_tool_calls(ctx: VapiCallContext, db: AsyncSession) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for tool_call in _tool_calls_from_message(ctx.message):
        tool_call_id = _safe_str(tool_call.get("id"), 120)
        tool_name = _safe_str(tool_call.get("name"), 80)
        args = tool_call.get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}
        if not isinstance(args, dict):
            args = {}

        if not tool_call_id or not tool_name:
            continue

        existing = await db.execute(
            select(VoiceToolCall).where(VoiceToolCall.tool_call_id == tool_call_id)
        )
        existing_call = existing.scalar_one_or_none()
        if existing_call is not None:
            results.append({"toolCallId": tool_call_id, "result": existing_call.result or {}})
            continue

        started = time.monotonic()
        success = True
        try:
            result = await execute_voice_tool(tool_name, args, ctx, db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Vapi voice tool failed: %s", tool_name)
            success = False
            result = {
                "success": False,
                "error": "tool_failed",
                "message_to_customer": "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق.",
            }
            if env_settings.APP_ENV != "production":
                result["debug"] = str(exc)

        latency_ms = int((time.monotonic() - started) * 1000)
        audit = VoiceToolCall(
            voice_call_id=ctx.voice_call_id,
            user_id=ctx.user_id,
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            arguments=args,
            result=_jsonable(result),
            success=success,
            latency_ms=latency_ms,
        )
        db.add(audit)
        await db.commit()
        results.append({"toolCallId": tool_call_id, "result": _jsonable(result)})
    return {"results": results}


async def execute_voice_tool(
    tool_name: str,
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    handlers = {
        "search_products": _tool_search_products,
        "get_product_details": _tool_get_product_details,
        "check_availability": _tool_check_availability,
        "get_business_policy": _tool_get_business_policy,
        "create_order_or_lead": _tool_create_order_or_lead,
        "request_human_handoff": _tool_request_human_handoff,
        "save_call_summary": _tool_save_call_summary,
    }
    handler = handlers.get(tool_name)
    if handler is None:
        return {
            "success": False,
            "error": "unknown_tool",
            "message_to_customer": "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق.",
        }
    return await handler(args, ctx, db)


def _variant_matches(variant: ItemVariant, option_type: str, value: str | None) -> bool:
    if not value:
        return True
    option = _normalise(variant.option_type)
    option_value = _normalise(variant.option_value)
    wanted = _normalise(value)
    aliases = {
        "size": {"size", "sizes", "مقاس", "قياس"},
        "color": {"color", "colour", "لون", "اللون"},
    }
    return option in aliases[option_type] and wanted in option_value


def _variant_values(item: Item, option_type: str) -> list[str]:
    aliases = {
        "size": {"size", "sizes", "مقاس", "قياس"},
        "color": {"color", "colour", "لون", "اللون"},
    }
    values: list[str] = []
    for variant in item.variants or []:
        if _normalise(variant.option_type) in aliases[option_type]:
            values.append(variant.option_value)
    return sorted(set(values))


def _product_payload(item: Item, *, include_description: bool = False) -> dict[str, Any]:
    data = {
        "product_id": str(item.id),
        "product_name": item.name,
        "price": float(item.price) if item.price is not None else None,
        "currency": item.currency,
        "availability": (
            "not_available"
            if not item.available or item.stock_status == "out_of_stock" or (item.stock_quantity is not None and item.stock_quantity <= 0)
            else "requires_check"
        ),
        "available_sizes": _variant_values(item, "size"),
        "available_colors": _variant_values(item, "color"),
        "short_description": (item.description or "")[:280],
        "instruction": "Call check_availability before saying a product/variant is available.",
    }
    if include_description:
        data.update(
            {
                "description": item.description,
                "category": item.category,
                "stock_status": item.stock_status,
                "stock_quantity": item.stock_quantity,
                "image_url": item.image_url,
                "warranty": {
                    "duration": item.warranty_duration,
                    "terms": item.warranty_terms,
                    "coverage": item.warranty_coverage,
                    "exclusions": item.warranty_exclusions,
                }
                if item.warranty_duration or item.warranty_terms
                else None,
            }
        )
    return _jsonable(data)


def _item_score(item: Item, query: str, category: str | None) -> int:
    haystack = _normalise(
        " ".join(
            [
                item.name or "",
                item.category or "",
                item.description or "",
                json.dumps(item.item_metadata or {}, ensure_ascii=False),
            ]
        )
    )
    score = 0
    query_norm = _normalise(query)
    if query_norm and query_norm in haystack:
        score += 10
    for token in re.split(r"[\s,،/\\|+\-_.:;!?؟()]+", query_norm):
        if len(token) >= 2 and token in haystack:
            score += 2
    if category and _normalise(category) in _normalise(item.category):
        score += 4
    return score


async def _catalog_rows(user_id: uuid.UUID, db: AsyncSession) -> list[Item]:
    result = await db.execute(
        select(Item)
        .options(selectinload(Item.variants))
        .where(Item.user_id == user_id)
        .order_by(Item.created_at.desc())
    )
    return list(result.scalars().all())


async def _find_product(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    product_id: str | None = None,
    product_name: str | None = None,
) -> tuple[Item | None, list[Item]]:
    if product_id:
        try:
            product_uuid = uuid.UUID(str(product_id))
        except (TypeError, ValueError):
            return None, []
        result = await db.execute(
            select(Item)
            .options(selectinload(Item.variants))
            .where(Item.id == product_uuid, Item.user_id == user_id)
        )
        return result.scalar_one_or_none(), []

    name = _safe_str(product_name)
    if not name:
        return None, []
    rows = await _catalog_rows(user_id, db)
    matches = [item for item in rows if _normalise(name) in _normalise(item.name)]
    if len(matches) == 1:
        return matches[0], []
    if len(matches) > 1:
        return None, matches[:MAX_TOOL_RESULTS]

    scored = [(_item_score(item, name, None), item) for item in rows]
    scored = [(score, item) for score, item in scored if score > 0]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    if len(scored) == 1:
        return scored[0][1], []
    return None, [item for _, item in scored[:MAX_TOOL_RESULTS]]


async def _tool_search_products(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    query = _safe_str(args.get("query"), 200)
    category = _safe_str(args.get("category"), 100)
    color = _safe_str(args.get("color"), 80)
    size = _safe_str(args.get("size"), 80)
    max_results = int(args.get("max_results") or 5)
    max_results = max(1, min(MAX_TOOL_RESULTS, max_results))

    rows = await _catalog_rows(ctx.user_id, db)
    filtered: list[Item] = []
    for item in rows:
        if color and not any(_variant_matches(v, "color", color) for v in item.variants or []):
            continue
        if size and not any(_variant_matches(v, "size", size) for v in item.variants or []):
            continue
        score = _item_score(item, query, category)
        if query or category:
            if score <= 0:
                continue
        filtered.append(item)

    if query or category:
        filtered.sort(key=lambda item: _item_score(item, query, category), reverse=True)

    items = [_product_payload(item) for item in filtered[:max_results]]
    return {
        "success": True,
        "matched": bool(items),
        "count": len(items),
        "items": items,
        "instruction": (
            "If no items are returned, do not invent products. "
            "If multiple items are returned, ask a clarifying question. "
            "Call check_availability before confirming availability."
        ),
    }


async def _tool_get_product_details(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    item, alternatives = await _find_product(
        ctx.user_id,
        db,
        product_id=args.get("product_id"),
        product_name=args.get("product_name"),
    )
    if alternatives:
        return {
            "success": True,
            "ambiguous": True,
            "matches": [_product_payload(item) for item in alternatives],
            "instruction": "Ask one clarifying question. Do not guess which product the caller means.",
        }
    if item is None:
        return {
            "success": True,
            "matched": False,
            "product": None,
            "message_to_customer": "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق.",
        }
    return {
        "success": True,
        "matched": True,
        "product": _product_payload(item, include_description=True),
    }


async def _tool_check_availability(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    item, alternatives = await _find_product(
        ctx.user_id,
        db,
        product_id=args.get("product_id"),
        product_name=args.get("product_name"),
    )
    if item is None:
        return {
            "success": True,
            "available": False,
            "available_quantity": 0,
            "alternatives": [_product_payload(alt) for alt in alternatives],
            "reason": "product_not_found" if not alternatives else "ambiguous_product",
        }

    quantity = max(1, int(args.get("quantity") or 1))
    size = _safe_str(args.get("size"), 80)
    color = _safe_str(args.get("color"), 80)
    reasons: list[str] = []

    if not item.available or item.stock_status == "out_of_stock":
        reasons.append("product_not_available")
    if item.stock_quantity is not None and item.stock_quantity < quantity:
        reasons.append("insufficient_product_quantity")

    matched_variants: list[ItemVariant] = []
    if size:
        size_variants = [v for v in item.variants or [] if _variant_matches(v, "size", size)]
        matched_variants.extend(size_variants)
        if not size_variants:
            reasons.append("size_not_found")
        elif not any(v.available and (v.stock_quantity is None or v.stock_quantity >= quantity) for v in size_variants):
            reasons.append("size_not_available")
    if color:
        color_variants = [v for v in item.variants or [] if _variant_matches(v, "color", color)]
        matched_variants.extend(color_variants)
        if not color_variants:
            reasons.append("color_not_found")
        elif not any(v.available and (v.stock_quantity is None or v.stock_quantity >= quantity) for v in color_variants):
            reasons.append("color_not_available")

    available = not reasons
    quantities = [v.stock_quantity for v in matched_variants if v.stock_quantity is not None]
    if item.stock_quantity is not None:
        quantities.append(item.stock_quantity)
    available_quantity = min(quantities) if quantities else (quantity if available else 0)

    return {
        "success": True,
        "product_id": str(item.id),
        "product_name": item.name,
        "available": available,
        "available_quantity": max(0, available_quantity),
        "price": float(item.price) if item.price is not None else None,
        "currency": item.currency,
        "reasons": reasons,
        "alternatives": [],
        "instruction": "Only say the item is available if available is true.",
    }


async def _tool_get_business_policy(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    policy_type = _normalise(args.get("policy_type") or "general")
    mapped = {
        "delivery": "shipping",
        "working_hours": "general",
        "location": "general",
    }.get(policy_type, policy_type)

    if policy_type == "delivery":
        delivery_result = await db.execute(
            select(DeliveryRule).where(
                DeliveryRule.user_id == ctx.user_id,
                DeliveryRule.is_active.is_(True),
            )
        )
        zones = [
            {
                "zone_name": rule.zone_name,
                "delivery_fee": float(rule.delivery_fee),
                "currency": rule.currency,
                "free_above": float(rule.free_above) if rule.free_above is not None else None,
                "estimated_days": rule.estimated_days,
                "pickup_available": rule.pickup_available,
                "notes": rule.notes,
            }
            for rule in delivery_result.scalars().all()
        ]
        if zones:
            return {"success": True, "policy_type": "delivery", "delivery_zones": zones}

    result = await db.execute(
        select(BusinessPolicy)
        .where(
            BusinessPolicy.user_id == ctx.user_id,
            BusinessPolicy.is_active.is_(True),
            or_(
                BusinessPolicy.policy_type == mapped,
                BusinessPolicy.policy_type == policy_type,
                BusinessPolicy.policy_type.in_(["general", "custom"]) if policy_type in {"working_hours", "location"} else False,
            ),
        )
        .order_by(BusinessPolicy.created_at.desc())
    )
    policies = [
        {
            "policy_type": policy.policy_type,
            "title": policy.title,
            "policy_text": policy.content,
            "last_updated": policy.created_at.isoformat() if policy.created_at else None,
        }
        for policy in result.scalars().all()
    ]
    return {
        "success": True,
        "matched": bool(policies),
        "policy_type": policy_type,
        "policies": policies,
        "business_name": ctx.business_name,
        "payment_methods": ctx.payment_methods if policy_type == "payment" else None,
        "message_to_customer": "" if policies else "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق.",
    }


async def _tool_create_order_or_lead(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    phone = _safe_str(args.get("phone_number"), 40)
    if not phone:
        return {
            "success": False,
            "error": "phone_number_required",
            "message_to_customer": "ممكن تعطيني رقم الهاتف وأعيده عليك للتأكيد؟",
        }

    item, alternatives = await _find_product(
        ctx.user_id,
        db,
        product_id=args.get("product_id"),
        product_name=args.get("product_name"),
    )
    if item is None and alternatives:
        return {
            "success": False,
            "error": "ambiguous_product",
            "matches": [_product_payload(alt) for alt in alternatives],
            "message_to_customer": "في أكثر من منتج مشابه. ممكن تحدد أي واحد تقصد؟",
        }

    quantity = max(1, int(args.get("quantity") or 1))
    lead = VoiceLead(
        user_id=ctx.user_id,
        voice_call_id=ctx.voice_call_id,
        product_id=item.id if item else None,
        customer_name=_safe_str(args.get("customer_name"), 120) or None,
        phone_number=phone,
        size=_safe_str(args.get("size"), 80) or None,
        color=_safe_str(args.get("color"), 80) or None,
        quantity=quantity,
        address=_safe_str(args.get("address"), 1000) or None,
        notes=_safe_str(args.get("notes"), 1000) or None,
        product_snapshot=_product_payload(item, include_description=True) if item else {},
    )
    db.add(lead)
    if ctx.voice_call:
        ctx.voice_call.order_status = "lead_created"
    await db.commit()
    await db.refresh(lead)

    confirmation = f"تم تسجيل طلبك، رقم المتابعة {str(lead.id)[:8]}. الفريق رح يتواصل معك للتأكيد."
    lead.confirmation_message = confirmation
    await db.commit()
    return {
        "success": True,
        "lead_id": str(lead.id),
        "order_id": None,
        "confirmation_message": confirmation,
    }


async def _tool_request_human_handoff(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    if ctx.voice_call is None or ctx.chat_session_id is None:
        return {
            "handoff_status": "queued_without_session",
            "message_to_customer": "لحظة من فضلك، رح أحولك لزميلي ليقدر يساعدك بشكل أفضل.",
        }

    reason = _safe_str(args.get("reason") or "voice call handoff", 100)
    summary = _safe_str(args.get("summary"), 2000)
    handoff = await create_handoff(
        ctx.chat_session_id,
        ctx.user_id,
        reason,
        db,
        reason_details=summary,
        priority="high" if "غاض" in reason or "angry" in reason.lower() else "normal",
        ai_summary=summary,
    )
    return {
        "handoff_status": "created",
        "handoff_id": str(handoff.id),
        "message_to_customer": "لحظة من فضلك، رح أحولك لزميلي ليقدر يساعدك بشكل أفضل.",
        "handoff_phone": ctx.settings.handoff_phone,
    }


async def _tool_save_call_summary(
    args: dict[str, Any],
    ctx: VapiCallContext,
    db: AsyncSession,
) -> dict[str, Any]:
    if ctx.voice_call is None:
        return {"success": False, "error": "call_not_found"}
    ctx.voice_call.customer_phone = _safe_str(args.get("customer_phone"), 40) or ctx.voice_call.customer_phone
    ctx.voice_call.transcript = _safe_str(args.get("transcript"), 50_000) or ctx.voice_call.transcript
    ctx.voice_call.summary = _safe_str(args.get("summary"), 5000) or ctx.voice_call.summary
    ctx.voice_call.intent = _safe_str(args.get("intent"), 80) or ctx.voice_call.intent
    ctx.voice_call.order_status = _safe_str(args.get("order_status"), 80) or ctx.voice_call.order_status
    ctx.voice_call.sentiment = _safe_str(args.get("sentiment"), 40) or ctx.voice_call.sentiment
    if args.get("needs_followup") is not None:
        ctx.voice_call.needs_followup = bool(args.get("needs_followup"))
    structured = dict(ctx.voice_call.structured_data or {})
    if args.get("products_discussed"):
        structured["products_discussed"] = args.get("products_discussed")
    ctx.voice_call.structured_data = structured
    await db.commit()
    return {"success": True}


async def apply_end_of_call_report(ctx: VapiCallContext, db: AsyncSession) -> None:
    if ctx.voice_call is None:
        return
    message = ctx.message
    call = _call_object(message)
    artifact = message.get("artifact") if isinstance(message.get("artifact"), dict) else {}
    recording = artifact.get("recording") if isinstance(artifact.get("recording"), dict) else {}
    analysis = (
        message.get("analysis")
        if isinstance(message.get("analysis"), dict)
        else call.get("analysis")
        if isinstance(call.get("analysis"), dict)
        else {}
    )

    ctx.voice_call.status = "ended"
    ctx.voice_call.ended_at = _parse_datetime(call.get("endedAt")) or _utcnow()
    ctx.voice_call.ended_reason = _safe_str(message.get("endedReason") or call.get("endedReason"), 100) or None
    ctx.voice_call.duration_seconds = call.get("durationSeconds") or call.get("duration")
    ctx.voice_call.transcript = artifact.get("transcript") or message.get("transcript") or ctx.voice_call.transcript
    ctx.voice_call.recording_url = (
        recording.get("url")
        or recording.get("stereoUrl")
        or recording.get("monoUrl")
        or artifact.get("recordingUrl")
        or ctx.voice_call.recording_url
    )
    ctx.voice_call.summary = (
        analysis.get("summary")
        or message.get("summary")
        or ctx.voice_call.summary
    )
    structured = analysis.get("structuredData")
    if isinstance(structured, dict):
        ctx.voice_call.structured_data = structured
        ctx.voice_call.intent = structured.get("intent") or ctx.voice_call.intent
        ctx.voice_call.sentiment = structured.get("sentiment") or ctx.voice_call.sentiment
        if structured.get("needs_followup") is not None:
            ctx.voice_call.needs_followup = bool(structured.get("needs_followup"))
    ctx.voice_call.artifact = artifact
    await db.commit()


async def apply_status_update(ctx: VapiCallContext, db: AsyncSession) -> None:
    if ctx.voice_call is None:
        return
    status = _safe_str(ctx.message.get("status"), 30)
    if status:
        ctx.voice_call.status = status
    if status == "in-progress" and ctx.voice_call.started_at is None:
        ctx.voice_call.started_at = _utcnow()
    if status == "ended":
        ctx.voice_call.ended_at = ctx.voice_call.ended_at or _utcnow()
    await db.commit()


async def apply_transcript_update(ctx: VapiCallContext, db: AsyncSession) -> None:
    if ctx.voice_call is None:
        return
    transcript = _safe_str(ctx.message.get("transcript"), 5000)
    role = _safe_str(ctx.message.get("role"), 30) or "unknown"
    transcript_type = _safe_str(ctx.message.get("transcriptType"), 30)
    if transcript and transcript_type == "final":
        prefix = "User" if role == "user" else "Assistant"
        existing = ctx.voice_call.transcript or ""
        ctx.voice_call.transcript = f"{existing}\n{prefix}: {transcript}".strip()
        await db.commit()


async def list_voice_calls(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[VoiceCall]:
    result = await db.execute(
        select(VoiceCall)
        .where(VoiceCall.user_id == user_id)
        .order_by(VoiceCall.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_voice_call_for_user(
    call_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> VoiceCall | None:
    stmt = select(VoiceCall).where(VoiceCall.id == call_id)
    if user.role != "admin":
        stmt = stmt.where(VoiceCall.user_id == user.id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
