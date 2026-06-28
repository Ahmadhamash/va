import json
import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import AIPersonaSettings, User

PERSONA_CONFIG_RE = re.compile(r"<!--\s*({.*?})\s*-->", re.DOTALL)

VALID_DIALECTS = {"jordanian", "syrian", "saudi", "egyptian", "msa"}
VALID_TONES = {"friendly", "professional", "salesy"}
VALID_EMOJI_LEVELS = {"none", "low", "medium", "high"}
VALID_PROMPT_MODES = {"default", "custom_settings", "samples", "full_prompt"}
VALID_STRICTNESS = {"strict", "balanced", "guided"}


def _clean_text(value: Any, *, max_len: int = 500) -> str | None:
    if not isinstance(value, str):
        return None
    clean = re.sub(r"\s+", " ", value).strip()
    if not clean:
        return None
    return clean[:max_len]


def _clean_phrases(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    phrases: list[str] = []
    for item in value:
        clean = _clean_text(item, max_len=120)
        if clean and clean not in phrases:
            phrases.append(clean)
    return phrases[:50]


def parse_persona_payload(persona: str | None) -> tuple[str, dict[str, Any]]:
    """Return persona text without the hidden config block plus parsed config."""
    raw = persona or ""
    match = PERSONA_CONFIG_RE.search(raw)
    config: dict[str, Any] = {}
    if match:
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, dict):
                config = parsed
        except json.JSONDecodeError:
            config = {}
        raw = PERSONA_CONFIG_RE.sub("", raw, count=1).strip()
    return raw.strip(), config


def normalize_persona_config(config: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(config, dict):
        return {}

    normalized: dict[str, Any] = {}
    prompt_mode = config.get("prompt_mode")
    voice_mode = config.get("voice_mode")
    if prompt_mode in VALID_PROMPT_MODES:
        normalized["prompt_mode"] = prompt_mode
    elif voice_mode == "custom":
        normalized["prompt_mode"] = "custom_settings"
    elif voice_mode == "samples":
        normalized["prompt_mode"] = "samples"

    dialect = config.get("dialect")
    if dialect in VALID_DIALECTS:
        normalized["dialect"] = dialect

    tone = config.get("tone")
    if tone in VALID_TONES:
        normalized["tone"] = tone

    emoji = config.get("emoji") or config.get("emoji_level")
    if emoji in VALID_EMOJI_LEVELS:
        normalized["emoji"] = emoji

    strictness = config.get("strictness")
    if strictness in VALID_STRICTNESS:
        normalized["strictness"] = strictness

    for key, max_len in (
        ("agent_name", 80),
        ("working_hours", 160),
        ("fallback_message", 500),
    ):
        clean = _clean_text(config.get(key), max_len=max_len)
        if clean:
            normalized[key] = clean

    for key in ("handoff_angry", "handoff_refund", "handoff_sensitive"):
        if isinstance(config.get(key), bool):
            normalized[key] = config[key]

    phrases = _clean_phrases(config.get("banned_phrases"))
    if phrases:
        normalized["banned_phrases"] = phrases

    if (
        "prompt_mode" not in normalized
        and any(key in normalized for key in ("dialect", "tone", "emoji", "strictness"))
    ):
        normalized["prompt_mode"] = "custom_settings"

    return normalized


def config_from_settings_row(row: AIPersonaSettings | None) -> dict[str, Any]:
    if row is None:
        return {}
    return normalize_persona_config(
        {
            "prompt_mode": "custom_settings",
            "dialect": row.dialect,
            "tone": row.tone,
            "emoji": row.emoji_level,
            "banned_phrases": row.banned_phrases,
            "agent_name": row.personality_name,
        }
    )


def merge_persona_config(
    persona_config: dict[str, Any] | None,
    settings_config: dict[str, Any] | None,
) -> dict[str, Any]:
    merged = normalize_persona_config(persona_config)
    settings = normalize_persona_config(settings_config)
    if not settings:
        return merged

    for key in (
        "dialect",
        "tone",
        "emoji",
        "banned_phrases",
        "agent_name",
        "working_hours",
        "strictness",
        "fallback_message",
        "handoff_angry",
        "handoff_refund",
        "handoff_sensitive",
    ):
        if key in settings:
            merged[key] = settings[key]

    if merged.get("prompt_mode") in (None, "default"):
        merged["prompt_mode"] = settings.get("prompt_mode", "custom_settings")
    return merged


async def get_persona_settings_config(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    row = (
        await db.execute(
            select(AIPersonaSettings).where(AIPersonaSettings.user_id == user_id)
        )
    ).scalar_one_or_none()
    return config_from_settings_row(row)


async def get_effective_persona_config(
    user_id: uuid.UUID,
    db: AsyncSession,
    persona: str | None,
) -> dict[str, Any]:
    _, persona_config = parse_persona_payload(persona)
    settings_config = await get_persona_settings_config(user_id, db)
    return merge_persona_config(persona_config, settings_config)


async def sync_persona_settings_from_text(
    user: User,
    db: AsyncSession,
) -> AIPersonaSettings | None:
    """Mirror the /agent hidden JSON config into ai_persona_settings."""
    _, raw_config = parse_persona_payload(user.ai_persona)
    config = normalize_persona_config(raw_config)
    if not config:
        return None

    row = (
        await db.execute(
            select(AIPersonaSettings).where(AIPersonaSettings.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = AIPersonaSettings(user_id=user.id)
        db.add(row)

    if "dialect" in config:
        row.dialect = config["dialect"]
    if "tone" in config:
        row.tone = config["tone"]
    if "emoji" in config:
        row.emoji_level = config["emoji"]
    if "banned_phrases" in config:
        row.banned_phrases = config["banned_phrases"]
    if "agent_name" in config:
        row.personality_name = config["agent_name"][:50]

    await db.flush()
    return row


def assistant_profile_data(
    persona: str | None,
    effective_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    _, persona_config = parse_persona_payload(persona)
    config = merge_persona_config(persona_config, effective_config)
    profile: dict[str, Any] = {
        "source": "client_ai_persona_settings",
        "priority": "Use only when it does not conflict with catalog, knowledge base, policies, or other database/tool results.",
    }
    for key in (
        "agent_name",
        "working_hours",
        "strictness",
        "fallback_message",
        "dialect",
        "tone",
        "emoji",
    ):
        value = config.get(key)
        if value not in (None, "", []):
            profile[key] = value
    if config.get("banned_phrases"):
        profile["banned_phrases"] = config["banned_phrases"]
    return profile if len(profile) > 2 else {}


def assistant_settings_prompt_block(config: dict[str, Any] | None) -> str:
    config = normalize_persona_config(config)
    if not config:
        return ""

    lines: list[str] = []
    labels = {
        "agent_name": "Agent display name",
        "working_hours": "Working hours",
        "strictness": "Grounding strictness",
        "fallback_message": "Human handoff fallback message",
    }
    for key in ("agent_name", "working_hours", "strictness", "fallback_message"):
        if config.get(key):
            lines.append(f"- {labels[key]}: {config[key]}")
    if config.get("banned_phrases"):
        lines.append(
            "- Business-specific banned phrases: "
            + ", ".join(config["banned_phrases"])
        )
    if not lines:
        return ""

    return (
        "\n\n## CLIENT ASSISTANT SETTINGS\n"
        "These are client-configured assistant details. You may use them as "
        "business-facing facts only when they do not conflict with catalog, "
        "knowledge base, policy, delivery, booking, or other database/tool "
        "results.\n"
        + "\n".join(lines)
        + "\n"
    )
