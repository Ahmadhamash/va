import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import ClientPromptSettings, ClientPromptVersion, User
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


PROMPT_VERSION_LIMIT = 20


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


BLOCKED_PROMPT_PATTERNS = (
    "ignore previous",
    "ignore all previous",
    "ignore the previous",
    "ignore system",
    "ignore platform",
    "ignore safety",
    "bypass verifier",
    "disable verifier",
    "disable tool",
    "do not use database",
    "do not use tools",
    "invent price",
    "make up price",
    "always say available",
    "everything is available",
    "تجاهل التعليمات",
    "تجاهل قواعد",
    "تجاهل النظام",
    "لا تستخدم قاعدة",
    "لا تستخدم الأدوات",
    "لا تستخدم الادوات",
    "اخترع سعر",
    "اخترع الأسعار",
    "اخترع الاسعار",
    "كل شيء متوفر",
    "كل المنتجات متوفرة",
    "لا تحول لبشري",
    "عطل التحقق",
)


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


def _row_to_payload(row: ClientPromptSettings) -> dict[str, str]:
    return {
        field: (getattr(row, field, None) or "").strip()
        for field in PROMPT_FIELDS
    }


def _normalise_prompt_payload(payload: dict | None) -> dict[str, str]:
    payload = payload or {}
    return {
        field: str(payload.get(field) or "").strip()
        for field in PROMPT_FIELDS
    }


def _apply_payload_to_row(row: ClientPromptSettings, payload: dict) -> None:
    normalised = _normalise_prompt_payload(payload)
    for field in PROMPT_FIELDS:
        setattr(row, field, normalised[field] or None)


async def _next_version_number(user_id: uuid.UUID, db: AsyncSession) -> int:
    current = await db.scalar(
        select(func.max(ClientPromptVersion.version_number)).where(
            ClientPromptVersion.user_id == user_id
        )
    )
    return int(current or 0) + 1


async def get_active_prompt_version(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ClientPromptVersion | None:
    result = await db.execute(
        select(ClientPromptVersion)
        .where(
            ClientPromptVersion.user_id == user_id,
            ClientPromptVersion.status == "active",
        )
        .order_by(ClientPromptVersion.version_number.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_draft_prompt_version(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ClientPromptVersion | None:
    result = await db.execute(
        select(ClientPromptVersion)
        .where(
            ClientPromptVersion.user_id == user_id,
            ClientPromptVersion.status == "draft",
        )
        .order_by(ClientPromptVersion.updated_at.desc(), ClientPromptVersion.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def ensure_initial_active_prompt_version(
    *,
    user_id: uuid.UUID,
    row: ClientPromptSettings,
    db: AsyncSession,
) -> ClientPromptVersion:
    active = await get_active_prompt_version(user_id, db)
    if active is not None:
        return active

    active = ClientPromptVersion(
        user_id=user_id,
        version_number=await _next_version_number(user_id, db),
        status="active",
        title="Initial active prompt",
        prompt_payload=_row_to_payload(row),
        test_status="passed",
        test_report={
            "status": "passed",
            "checks": [
                {
                    "name": "legacy_active_import",
                    "status": "passed",
                    "message": "Imported from the currently active prompt settings.",
                }
            ],
        },
        activated_at=_utcnow_naive(),
    )
    db.add(active)
    await db.flush()
    return active


async def list_prompt_versions(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    limit: int = PROMPT_VERSION_LIMIT,
) -> list[ClientPromptVersion]:
    result = await db.execute(
        select(ClientPromptVersion)
        .where(ClientPromptVersion.user_id == user_id)
        .order_by(
            ClientPromptVersion.version_number.desc(),
            ClientPromptVersion.created_at.desc(),
        )
        .limit(limit)
    )
    return list(result.scalars().all())


async def save_prompt_draft(
    *,
    user_id: uuid.UUID,
    payload: dict,
    db: AsyncSession,
    admin_id: uuid.UUID | None = None,
    title: str | None = None,
    notes: str | None = None,
) -> ClientPromptVersion:
    draft = await get_draft_prompt_version(user_id, db)
    if draft is None:
        draft = ClientPromptVersion(
            user_id=user_id,
            created_by_id=admin_id,
            version_number=await _next_version_number(user_id, db),
            status="draft",
            title=title or "Prompt draft",
            notes=notes,
            prompt_payload=_normalise_prompt_payload(payload),
            test_status="untested",
            test_report=None,
        )
        db.add(draft)
    else:
        draft.created_by_id = admin_id or draft.created_by_id
        draft.title = title or draft.title or "Prompt draft"
        draft.notes = notes if notes is not None else draft.notes
        draft.prompt_payload = _normalise_prompt_payload(payload)
        draft.test_status = "untested"
        draft.test_report = None
    await db.flush()
    return draft


def run_prompt_draft_checks(payload: dict) -> dict:
    payload = _normalise_prompt_payload(payload)
    checks: list[dict] = []
    failed = False

    for field in PROMPT_FIELDS:
        text = payload[field]
        lower = text.casefold()
        matched = [
            pattern
            for pattern in BLOCKED_PROMPT_PATTERNS
            if pattern.casefold() in lower
        ]
        if matched:
            failed = True
            checks.append(
                {
                    "name": f"{field}_blocked_phrases",
                    "status": "failed",
                    "message": (
                        "Contains prompt-injection or safety-bypass language: "
                        + ", ".join(matched[:5])
                    ),
                }
            )
        else:
            checks.append(
                {
                    "name": f"{field}_blocked_phrases",
                    "status": "passed",
                    "message": "No blocked safety-bypass phrases found.",
                }
            )

        if len(text) > 16000:
            failed = True
            checks.append(
                {
                    "name": f"{field}_length",
                    "status": "failed",
                    "message": "Prompt section is too long.",
                }
            )

    custom_count = sum(1 for value in payload.values() if value)
    checks.append(
        {
            "name": "custom_section_count",
            "status": "passed",
            "message": f"{custom_count} custom prompt section(s) will override defaults.",
        }
    )
    checks.append(
        {
            "name": "protected_core_rules",
            "status": "passed",
            "message": "Core safety, grounding, and tool-use rules remain locked in code.",
        }
    )

    return {
        "status": "failed" if failed else "passed",
        "checks": checks,
    }


async def evaluate_prompt_draft(
    *,
    draft: ClientPromptVersion,
    db: AsyncSession,
) -> ClientPromptVersion:
    report = run_prompt_draft_checks(draft.prompt_payload)
    draft.test_status = report["status"]
    draft.test_report = report
    await db.flush()
    return draft


async def activate_prompt_draft(
    *,
    user_id: uuid.UUID,
    row: ClientPromptSettings,
    draft: ClientPromptVersion,
    db: AsyncSession,
) -> ClientPromptVersion:
    if draft.user_id != user_id or draft.status != "draft":
        raise ValueError("Draft not found")
    if draft.test_status != "passed":
        raise ValueError("Draft must pass tests before activation")

    existing = await db.execute(
        select(ClientPromptVersion).where(
            ClientPromptVersion.user_id == user_id,
            ClientPromptVersion.status == "active",
        )
    )
    for version in existing.scalars().all():
        version.status = "archived"

    draft.status = "active"
    draft.activated_at = _utcnow_naive()
    _apply_payload_to_row(row, draft.prompt_payload)
    await db.flush()
    return draft


async def rollback_to_prompt_version(
    *,
    user_id: uuid.UUID,
    row: ClientPromptSettings,
    target: ClientPromptVersion,
    db: AsyncSession,
    admin_id: uuid.UUID | None = None,
) -> ClientPromptVersion:
    if target.user_id != user_id:
        raise ValueError("Version does not belong to this client")

    existing = await db.execute(
        select(ClientPromptVersion).where(
            ClientPromptVersion.user_id == user_id,
            ClientPromptVersion.status == "active",
        )
    )
    for version in existing.scalars().all():
        version.status = "archived"

    restored = ClientPromptVersion(
        user_id=user_id,
        created_by_id=admin_id,
        version_number=await _next_version_number(user_id, db),
        status="active",
        title=f"Rollback to v{target.version_number}",
        notes=f"Restored from prompt version {target.version_number}.",
        prompt_payload=_normalise_prompt_payload(target.prompt_payload),
        test_status="passed",
        test_report={
            "status": "passed",
            "checks": [
                {
                    "name": "rollback",
                    "status": "passed",
                    "message": f"Restored from version {target.version_number}.",
                }
            ],
        },
        activated_at=_utcnow_naive(),
    )
    db.add(restored)
    _apply_payload_to_row(row, restored.prompt_payload)
    await db.flush()
    return restored


def prompt_version_payload(version: ClientPromptVersion | None) -> dict | None:
    if version is None:
        return None
    return {
        "id": str(version.id),
        "version_number": version.version_number,
        "status": version.status,
        "title": version.title or "",
        "notes": version.notes or "",
        "prompt_payload": _normalise_prompt_payload(version.prompt_payload),
        "test_status": version.test_status,
        "test_report": version.test_report or None,
        "created_at": version.created_at,
        "updated_at": version.updated_at,
        "activated_at": version.activated_at,
    }


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
    active_version: ClientPromptVersion | None = None,
    draft_version: ClientPromptVersion | None = None,
    versions: list[ClientPromptVersion] | None = None,
) -> dict:
    defaults = default_prompt_sections(human_handoff_enabled=human_handoff_enabled)
    active_payload = _row_to_payload(row)
    draft_payload = (
        _normalise_prompt_payload(draft_version.prompt_payload)
        if draft_version is not None
        else active_payload
    )
    sections = {}
    for field in PROMPT_FIELDS:
        active_custom = active_payload[field]
        draft_custom = draft_payload[field]
        default = defaults[field]
        meta = PROMPT_SECTION_META[field]
        sections[field] = {
            "key": field,
            "label": meta.label,
            "description": meta.description,
            "default_prompt": default,
            "custom_prompt": draft_custom,
            "active_custom_prompt": active_custom,
            "draft_prompt": draft_custom,
            "effective_prompt": active_custom or default,
            "draft_effective_prompt": draft_custom or default,
            "is_custom": bool(active_custom),
            "is_draft_custom": bool(draft_custom),
            "has_unpublished_changes": draft_custom != active_custom,
        }
    return {
        "client_id": str(user.id),
        "username": user.username,
        "business_name": user.business_name,
        "client_ai_persona": user.ai_persona or "",
        "admin_persona_prompt": draft_payload["admin_persona_prompt"],
        "ai_persona": user.ai_persona or "",
        "active_version": prompt_version_payload(active_version),
        "draft_version": prompt_version_payload(draft_version),
        "versions": [
            payload
            for payload in (prompt_version_payload(version) for version in (versions or []))
            if payload is not None
        ],
        "sections": sections,
    }
