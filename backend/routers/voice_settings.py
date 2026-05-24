"""Voice settings router.

Manages per-business voice pipeline configuration: STT/TTS providers,
voice mode, preferred voice, ElevenLabs settings, etc.
"""
import logging
import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import User, VoiceSettings

logger = logging.getLogger("voice_settings_router")
router = APIRouter(prefix="/voice-settings", tags=["voice"])

OPENAI_VOICES = [
    {"value": "nova", "label": "Nova", "dialect": "Arabic neutral", "gender": "female"},
    {"value": "alloy", "label": "Alloy", "dialect": "Arabic neutral", "gender": "neutral"},
    {"value": "shimmer", "label": "Shimmer", "dialect": "Arabic neutral", "gender": "female"},
    {"value": "echo", "label": "Echo", "dialect": "Arabic neutral", "gender": "male"},
    {"value": "onyx", "label": "Onyx", "dialect": "Arabic neutral", "gender": "male"},
    {"value": "fable", "label": "Fable", "dialect": "Arabic neutral", "gender": "male"},
]

ELEVENLABS_ARABIC_VOICES = [
    {
        "value": "el_jordanian_female",
        "label": "Lina",
        "dialect": "Jordanian / Levantine",
        "gender": "female",
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "sample_text": "مرحبا، كيف بقدر أساعدك اليوم؟",
    },
    {
        "value": "el_levantine_male",
        "label": "Omar",
        "dialect": "Palestinian / Levantine",
        "gender": "male",
        "voice_id": "ErXwobaYiN019PkySvjV",
        "sample_text": "أهلا وسهلا، احكيلي شو بدك وأنا بساعدك.",
    },
    {
        "value": "el_gulf_female",
        "label": "Noura",
        "dialect": "Gulf",
        "gender": "female",
        "voice_id": "MF3mGyEYCl7XYWbV9V6O",
        "sample_text": "حياك الله، كيف أقدر أخدمك؟",
    },
    {
        "value": "el_egyptian_female",
        "label": "Mariam",
        "dialect": "Egyptian",
        "gender": "female",
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "sample_text": "أهلا بيك، تحب أساعدك في إيه؟",
    },
    {
        "value": "el_iraqi_male",
        "label": "Yousef",
        "dialect": "Iraqi",
        "gender": "male",
        "voice_id": "yoZ06aMxZJJ28mfd3POQ",
        "sample_text": "هلا بيك، شلون أگدر أساعدك؟",
    },
    {
        "value": "el_moroccan_male",
        "label": "Adam",
        "dialect": "Moroccan",
        "gender": "male",
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "sample_text": "مرحبا، كيفاش نقدر نعاونك اليوم؟",
    },
]


ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"

DIALECT_SAMPLES = {
    "Jordanian / Levantine": "مرحبا، كيف بقدر أساعدك اليوم؟",
    "Palestinian / Levantine": "أهلا وسهلا، احكيلي شو بدك وأنا بساعدك.",
    "Syrian / Levantine": "أهلا فيك، خبرني كيف فيني ساعدك اليوم؟",
    "Lebanese / Levantine": "أهلا، كيف فيي ساعدك اليوم؟",
    "Egyptian": "أهلا بيك، تحب أساعدك في إيه؟",
    "Gulf": "حياك الله، كيف أقدر أخدمك؟",
    "Saudi / Gulf": "حياك الله، أبشر كيف أقدر أخدمك؟",
    "Iraqi": "هلا بيك، شلون أگدر أساعدك؟",
    "Moroccan": "مرحبا، كيفاش نقدر نعاونك اليوم؟",
    "Arabic": "مرحبا، كيف أقدر أساعدك اليوم؟",
}

DIALECT_RULES = [
    ("Jordanian / Levantine", ("jordan", "jordanian", "amman")),
    ("Palestinian / Levantine", ("palestin", "palestinian")),
    ("Syrian / Levantine", ("syrian", "syria")),
    ("Lebanese / Levantine", ("leban", "lebanese")),
    ("Egyptian", ("egypt", "egyptian", "masri", "cairo", "ar-eg")),
    ("Saudi / Gulf", ("saudi", "ksa", "riyadh", "ar-sa")),
    ("Gulf", ("gulf", "khaleeji", "emirati", "kuwait", "qatar", "bahrain", "ar-ae")),
    ("Iraqi", ("iraq", "iraqi", "baghdad", "ar-iq")),
    ("Moroccan", ("morocco", "moroccan", "darija", "maghrebi", "ar-ma")),
    ("Arabic", ("arabic", "arab", "msa", "ar")),
]

DIALECT_PRIORITY = {
    "Jordanian / Levantine": 0,
    "Palestinian / Levantine": 1,
    "Syrian / Levantine": 2,
    "Lebanese / Levantine": 3,
    "Egyptian": 4,
    "Saudi / Gulf": 5,
    "Gulf": 6,
    "Iraqi": 7,
    "Moroccan": 8,
    "Arabic": 9,
}


# ── Schemas ──────────────────────────────────────────────────────────────
class VoiceSettingsUpdate(BaseModel):
    voice_mode: str | None = None
    fallback_to_text: bool | None = None
    max_audio_duration_seconds: int | None = None
    preferred_voice: str | None = None
    stt_provider: str | None = None
    tts_provider: str | None = None
    audio_format: str | None = None
    speech_speed: float | None = None
    voice_personality: str | None = None
    stt_config: dict | None = None
    tts_config: dict | None = None


class VoicePreviewRequest(BaseModel):
    tts_provider: str | None = None
    preferred_voice: str | None = None
    speech_speed: float | None = None
    audio_format: str | None = None
    tts_config: dict | None = None
    text: str | None = None


class VoiceSettingsOut(BaseModel):
    voice_mode: str
    fallback_to_text: bool
    max_audio_duration_seconds: int
    preferred_voice: str
    stt_provider: str
    tts_provider: str
    audio_format: str
    speech_speed: float
    voice_personality: str
    stt_config: dict
    tts_config: dict
    stt_provider_name: str
    tts_provider_name: str

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────
@router.get("/")
async def get_voice_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get voice settings for the current business."""
    settings = await _get_or_create(current_user.id, db)

    # Determine actual provider names
    elevenlabs_available = bool(os.getenv("ELEVENLABS_API_KEY", "").strip())
    tts_provider_name = "elevenlabs" if elevenlabs_available else "openai"
    if settings.tts_provider == "openai":
        tts_provider_name = "openai"

    return {
        "voice_mode": settings.voice_mode,
        "fallback_to_text": settings.fallback_to_text,
        "max_audio_duration_seconds": settings.max_audio_duration_seconds,
        "preferred_voice": settings.preferred_voice,
        "stt_provider": settings.stt_provider,
        "tts_provider": settings.tts_provider,
        "audio_format": settings.audio_format,
        "speech_speed": settings.speech_speed,
        "voice_personality": settings.voice_personality,
        "stt_config": settings.stt_config or {},
        "tts_config": settings.tts_config or {},
        "stt_provider_name": "openai",  # Whisper is always used for STT
        "tts_provider_name": tts_provider_name,
        "elevenlabs_available": elevenlabs_available,
    }


@router.get("/voices")
async def list_voice_options(
    current_user: User = Depends(get_current_user),
):
    """List voice options for the dashboard."""
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    elevenlabs_voices, elevenlabs_meta = await _load_elevenlabs_arabic_voices(
        elevenlabs_key
    )
    return {
        "openai": OPENAI_VOICES,
        "elevenlabs": elevenlabs_voices,
        "elevenlabs_available": bool(elevenlabs_key),
        **elevenlabs_meta,
    }


@router.put("/")
async def update_voice_settings(
    body: VoiceSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update voice settings for the current business."""
    settings = await _get_or_create(current_user.id, db)

    # Validate voice_mode
    valid_modes = {"off", "voice_when_voice", "always_voice", "text_and_voice"}
    if body.voice_mode is not None:
        if body.voice_mode not in valid_modes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid voice_mode. Must be one of: {', '.join(valid_modes)}",
            )
        settings.voice_mode = body.voice_mode

    # Validate tts_provider
    valid_providers = {"openai", "elevenlabs", "azure", "google"}
    if body.tts_provider is not None:
        if body.tts_provider not in valid_providers:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tts_provider. Must be one of: {', '.join(valid_providers)}",
            )
        settings.tts_provider = body.tts_provider

    if body.fallback_to_text is not None:
        settings.fallback_to_text = body.fallback_to_text
    if body.max_audio_duration_seconds is not None:
        settings.max_audio_duration_seconds = max(10, min(300, body.max_audio_duration_seconds))
    if body.preferred_voice is not None:
        settings.preferred_voice = body.preferred_voice
    if body.stt_provider is not None:
        settings.stt_provider = body.stt_provider
    if body.audio_format is not None:
        settings.audio_format = body.audio_format
    if body.speech_speed is not None:
        settings.speech_speed = max(0.5, min(2.0, body.speech_speed))
    if body.voice_personality is not None:
        settings.voice_personality = body.voice_personality
    if body.stt_config is not None:
        settings.stt_config = body.stt_config
    if body.tts_config is not None:
        settings.tts_config = body.tts_config

    await db.commit()
    return {"status": "updated"}


@router.post("/test")
async def test_voice(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test the voice pipeline with a sample Arabic phrase."""
    from services.voice import VoiceService

    settings = await _get_or_create(current_user.id, db)

    try:
        voice_service = await VoiceService.from_db(
            db, tts_provider=settings.tts_provider
        )
        test_text = "مرحبا! كيف بقدر أساعدك اليوم؟"
        audio_url = await voice_service.synthesize_and_save(
            test_text,
            current_user.id,
            voice=settings.preferred_voice,
            speed=settings.speech_speed,
            output_format=settings.audio_format,
            voice_config=settings.tts_config,
        )
        return {
            "success": True,
            "audio_url": audio_url,
            "tts_provider": voice_service.tts_provider_name,
            "test_text": test_text,
        }
    except Exception as e:
        logger.exception("Voice test failed")
        return {
            "success": False,
            "error": str(e),
        }


# ── Helpers ──────────────────────────────────────────────────────────────
@router.post("/preview")
async def preview_voice(
    body: VoicePreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a short preview using the selected voice without saving settings."""
    from services.voice import VoiceService

    settings = await _get_or_create(current_user.id, db)
    provider = body.tts_provider or settings.tts_provider
    if provider == "elevenlabs" and not os.getenv("ELEVENLABS_API_KEY", "").strip():
        raise HTTPException(
            status_code=400,
            detail="ELEVENLABS_API_KEY is not configured on the server.",
        )

    text = (body.text or "مرحبا! كيف بقدر أساعدك اليوم؟").strip()
    if len(text) > 300:
        text = text[:300]

    try:
        voice_service = await VoiceService.from_db(db, tts_provider=provider)
        audio_url = await voice_service.synthesize_and_save(
            text,
            current_user.id,
            voice=body.preferred_voice or settings.preferred_voice,
            speed=body.speech_speed or settings.speech_speed,
            output_format=body.audio_format or settings.audio_format,
            voice_config=(
                body.tts_config if body.tts_config is not None else settings.tts_config
            ),
        )
        return {
            "success": True,
            "audio_url": audio_url,
            "tts_provider": voice_service.tts_provider_name,
            "test_text": text,
        }
    except Exception as e:
        logger.exception("Voice preview failed")
        return {
            "success": False,
            "error": str(e),
        }


async def _load_elevenlabs_arabic_voices(
    api_key: str,
) -> tuple[list[dict], dict]:
    """Load real Arabic voices from the user's ElevenLabs account/library."""
    if not api_key:
        return [], {
            "elevenlabs_dynamic": False,
            "elevenlabs_message": "ELEVENLABS_API_KEY is not configured.",
            "elevenlabs_missing_permissions": False,
        }

    headers = {"xi-api-key": api_key}
    voices: list[dict] = []
    messages: list[str] = []
    missing_permissions = False

    async with httpx.AsyncClient(timeout=25) as client:
        for source, url, params in (
            (
                "account",
                f"{ELEVENLABS_API_BASE}/voices",
                {"show_legacy": "false"},
            ),
            (
                "library",
                f"{ELEVENLABS_API_BASE}/shared-voices",
                {
                    "language": "ar",
                    "page_size": 100,
                    "sort": "usage_character_count_7d",
                },
            ),
        ):
            try:
                resp = await client.get(url, headers=headers, params=params)
            except httpx.HTTPError as exc:
                logger.warning("ElevenLabs %s voice lookup failed: %s", source, exc)
                messages.append(f"Could not reach ElevenLabs {source} voices.")
                continue

            if resp.status_code in (401, 403):
                missing_permissions = True
                messages.append(
                    "Your ElevenLabs API key is missing voices_read permission."
                )
                continue
            if resp.status_code >= 400:
                logger.warning(
                    "ElevenLabs %s voice lookup failed (%s): %s",
                    source,
                    resp.status_code,
                    resp.text[:300],
                )
                messages.append(f"ElevenLabs {source} voices returned {resp.status_code}.")
                continue

            payload = resp.json()
            for voice in payload.get("voices", []):
                mapped = _map_elevenlabs_voice(voice, source)
                if mapped is not None:
                    voices.append(mapped)

    voices = _dedupe_and_sort_voices(voices)
    if voices:
        return voices[:36], {
            "elevenlabs_dynamic": True,
            "elevenlabs_message": "; ".join(dict.fromkeys(messages)),
            "elevenlabs_missing_permissions": missing_permissions,
        }

    # Do not pretend generic premade/library voices are Arabic.
    return [], {
        "elevenlabs_dynamic": False,
        "elevenlabs_message": "; ".join(dict.fromkeys(messages))
        or "No Arabic ElevenLabs voices were found for this API key.",
        "elevenlabs_missing_permissions": missing_permissions,
    }


def _map_elevenlabs_voice(voice: dict, source: str) -> dict | None:
    if not _is_arabic_voice(voice):
        return None

    voice_id = voice.get("voice_id")
    name = voice.get("name")
    if not voice_id or not name:
        return None

    dialect = _detect_dialect(voice)
    labels = voice.get("labels") or {}
    gender = (
        voice.get("gender")
        or labels.get("gender")
        or labels.get("Gender")
        or "voice"
    )

    source_label = "Your ElevenLabs voices" if source == "account" else "ElevenLabs Library"
    free_users_allowed = voice.get("free_users_allowed")
    usable_note = ""
    if source == "library" and free_users_allowed is False:
        usable_note = "May require a paid ElevenLabs plan"

    return {
        "value": f"el_{voice_id}",
        "label": name,
        "dialect": dialect,
        "gender": str(gender).lower(),
        "voice_id": voice_id,
        "sample_text": DIALECT_SAMPLES.get(dialect, DIALECT_SAMPLES["Arabic"]),
        "preview_url": voice.get("preview_url"),
        "source": source,
        "source_label": source_label,
        "public_owner_id": voice.get("public_owner_id"),
        "free_users_allowed": free_users_allowed,
        "usable_note": usable_note,
        "score": _voice_score(voice, source, dialect),
    }


def _is_arabic_voice(voice: dict) -> bool:
    fields = _voice_search_text(voice)
    if "ar-" in fields or " arabic" in f" {fields}" or "العربية" in fields:
        return True
    if str(voice.get("language") or "").lower() == "ar":
        return True
    for lang in voice.get("verified_languages") or []:
        language = str(lang.get("language") or "").lower()
        locale = str(lang.get("locale") or "").lower()
        if language == "ar" or locale.startswith("ar-"):
            return True
    return False


def _detect_dialect(voice: dict) -> str:
    fields = _voice_search_text(voice)
    for dialect, terms in DIALECT_RULES:
        if any(term in fields for term in terms):
            return dialect
    return "Arabic"


def _voice_search_text(voice: dict) -> str:
    labels = voice.get("labels") or {}
    parts = [
        voice.get("name"),
        voice.get("accent"),
        voice.get("language"),
        voice.get("description"),
        voice.get("descriptive"),
        voice.get("use_case"),
        voice.get("category"),
        " ".join(str(v) for v in labels.values()),
    ]
    for lang in voice.get("verified_languages") or []:
        parts.extend(
            [
                lang.get("language"),
                lang.get("locale"),
                lang.get("accent"),
                lang.get("model_id"),
            ]
        )
    return " ".join(str(part or "") for part in parts).lower()


def _voice_score(voice: dict, source: str, dialect: str) -> int:
    score = 0
    if source == "account":
        score += 300
    if voice.get("category") in {"professional", "high_quality"}:
        score += 50
    if voice.get("free_users_allowed") is True:
        score += 25
    if voice.get("featured") is True:
        score += 20
    score += int(voice.get("usage_character_count_7d") or 0) // 1000
    score += max(0, 20 - DIALECT_PRIORITY.get(dialect, 20))
    return score


def _dedupe_and_sort_voices(voices: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for voice in voices:
        existing = by_id.get(voice["voice_id"])
        if existing is None or voice["score"] > existing["score"]:
            by_id[voice["voice_id"]] = voice
    return sorted(
        by_id.values(),
        key=lambda item: (
            DIALECT_PRIORITY.get(item["dialect"], 99),
            -item["score"],
            item["label"].lower(),
        ),
    )


async def _get_or_create(user_id: uuid.UUID, db: AsyncSession) -> VoiceSettings:
    """Get or create voice settings for a user."""
    result = await db.execute(
        select(VoiceSettings).where(VoiceSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = VoiceSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings
