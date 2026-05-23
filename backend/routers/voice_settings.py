"""Voice settings router.

Manages per-business voice pipeline configuration: STT/TTS providers,
voice mode, preferred voice, ElevenLabs settings, etc.
"""
import logging
import os
import uuid

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
    return {
        "openai": OPENAI_VOICES,
        "elevenlabs": ELEVENLABS_ARABIC_VOICES,
        "elevenlabs_available": bool(os.getenv("ELEVENLABS_API_KEY", "").strip()),
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
