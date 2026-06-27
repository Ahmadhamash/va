import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ClientPromptSettings, User
from services.ai_prompts import default_intent_prompt
from services.humanizer import HUMANIZER_SYSTEM_PROMPT


PROMPT_FIELDS = (
    "sales_prompt",
    "support_prompt",
    "booking_prompt",
    "general_prompt",
    "admin_persona_prompt",
    "humanizer_prompt",
    "voice_prompt",
)


@dataclass(frozen=True)
class PromptSectionMeta:
    label: str
    description: str


PROMPT_SECTION_META = {
    "sales_prompt": PromptSectionMeta(
        "Sales and catalog",
        "Rules used when customers ask about products, prices, stock, offers, or packages.",
    ),
    "support_prompt": PromptSectionMeta(
        "Support and policies",
        "Rules used for delivery, returns, refunds, locations, complaints, and order status.",
    ),
    "booking_prompt": PromptSectionMeta(
        "Booking",
        "Rules used for reservations, appointments, available slots, and booking creation.",
    ),
    "general_prompt": PromptSectionMeta(
        "General chat",
        "Rules used for greetings, casual chat, and non-business redirection.",
    ),
    "admin_persona_prompt": PromptSectionMeta(
        "Admin account guidance",
        "Account-level guidance added by admins. It supplements the client persona but does not replace client-owned business facts.",
    ),
    "humanizer_prompt": PromptSectionMeta(
        "Humanizer",
        "Instructions for rewriting factual drafts into a natural WhatsApp-style message.",
    ),
    "voice_prompt": PromptSectionMeta(
        "Voice calls",
        "Instructions sent to the Vapi assistant for live voice calls.",
    ),
}


DEFAULT_VOICE_PROMPT = """You are a voice assistant for {business_name}.
Speak in the configured dialect using short sentences that are suitable for a phone call.

Truth rules:
- Do not mention prices unless they came from a tool.
- Do not confirm product, size, color, or quantity availability unless check_availability succeeded.
- Do not invent discounts, delivery times, policies, or store details.
- If information is missing, say that it is not visible right now and ask one clear clarifying question.

Call rules:
- Ask one question at a time.
- Repeat phone numbers, addresses, quantities, sizes, and colors back to the caller before confirming.
- Before creating an order, read the full order summary and wait for confirmation.
- Keep the answer focused on the business and the caller's request."""


async def get_or_create_prompt_settings(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ClientPromptSettings:
    result = await db.execute(
        select(ClientPromptSettings).where(ClientPromptSettings.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row

    row = ClientPromptSettings(user_id=user_id)
    db.add(row)
    await db.flush()
    return row


async def get_client_prompt_overrides(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, str]:
    result = await db.execute(
        select(ClientPromptSettings).where(ClientPromptSettings.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return {}

    out: dict[str, str] = {}
    for field in PROMPT_FIELDS:
        value = (getattr(row, field, None) or "").strip()
        if value:
            out[field] = value
    return out


def default_prompt_sections(*, human_handoff_enabled: bool = True) -> dict[str, str]:
    return {
        "sales_prompt": default_intent_prompt("sales", human_handoff_enabled),
        "support_prompt": default_intent_prompt("support", human_handoff_enabled),
        "booking_prompt": default_intent_prompt("booking", human_handoff_enabled),
        "general_prompt": default_intent_prompt("general", human_handoff_enabled),
        "admin_persona_prompt": "",
        "humanizer_prompt": HUMANIZER_SYSTEM_PROMPT.strip(),
        "voice_prompt": DEFAULT_VOICE_PROMPT.strip(),
    }


def prompt_settings_payload(
    *,
    user: User,
    row: ClientPromptSettings,
    human_handoff_enabled: bool,
) -> dict:
    defaults = default_prompt_sections(human_handoff_enabled=human_handoff_enabled)
    sections = {}
    for field in PROMPT_FIELDS:
        custom = (getattr(row, field, None) or "").strip()
        default = defaults[field]
        meta = PROMPT_SECTION_META[field]
        sections[field] = {
            "key": field,
            "label": meta.label,
            "description": meta.description,
            "default_prompt": default,
            "custom_prompt": custom,
            "effective_prompt": custom or default,
            "is_custom": bool(custom),
        }
    return {
        "client_id": str(user.id),
        "username": user.username,
        "business_name": user.business_name,
        "client_ai_persona": user.ai_persona or "",
        "admin_persona_prompt": row.admin_persona_prompt or "",
        "ai_persona": user.ai_persona or "",
        "sections": sections,
    }
