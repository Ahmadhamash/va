"""VoiceService — orchestrator for the full voice pipeline.

Handles:
- Provider selection (ElevenLabs primary, OpenAI fallback)
- STT (transcription)
- TTS (synthesis) with auto-fallback
- Voice settings from database
- File saving for generated audio
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.voice.stt import OpenAISTT, STTProvider
from services.voice.tts import ElevenLabsTTS, OpenAITTS, TTSProvider

logger = logging.getLogger("voice.service")


class VoiceService:
    """Orchestrates speech-to-text and text-to-speech for the platform.

    Provider selection::

        TTS:
          - if ELEVENLABS_API_KEY → ElevenLabs (primary, for Arabic)
          - else → OpenAI TTS (fallback)

        STT:
          - OpenAI Whisper (always — best Arabic transcription)
    """

    def __init__(
        self,
        openai_key: str,
        elevenlabs_key: str | None = None,
        *,
        tts_provider: str = "auto",
    ):
        self._openai_key = openai_key
        self._elevenlabs_key = elevenlabs_key
        self._tts_provider = tts_provider or "auto"

        # STT: always OpenAI Whisper
        self._stt: STTProvider = OpenAISTT(api_key=openai_key)

        # TTS: ElevenLabs primary, OpenAI fallback
        self._tts_primary: TTSProvider | None = None
        self._tts_fallback: TTSProvider = OpenAITTS(api_key=openai_key)
        self._last_tts_provider_name: str = self._tts_fallback.provider_name

        use_elevenlabs = bool(elevenlabs_key) and self._tts_provider in (
            "auto",
            "elevenlabs",
        )

        if use_elevenlabs:
            self._tts_primary = ElevenLabsTTS(api_key=elevenlabs_key)
            self._last_tts_provider_name = self._tts_primary.provider_name
            logger.info("Voice pipeline: ElevenLabs (primary) + OpenAI (fallback)")
        else:
            logger.info(
                "Voice pipeline: OpenAI only (set ELEVENLABS_API_KEY and choose ElevenLabs for premium Arabic voices)"
            )

    @property
    def stt_provider_name(self) -> str:
        return self._stt.provider_name

    @property
    def tts_provider_name(self) -> str:
        return self._last_tts_provider_name

    # ── Transcription (STT) ──────────────────────────────────────────────
    async def transcribe(
        self,
        audio_data: bytes,
        *,
        language: str = "ar",
        filename: str = "audio.mp4",
    ) -> str:
        """Transcribe audio bytes to text."""
        return await self._stt.transcribe(
            audio_data, language=language, filename=filename
        )

    async def transcribe_from_url(
        self,
        url: str,
        *,
        language: str = "ar",
        filename: str = "audio.mp4",
    ) -> str:
        """Download audio from URL and transcribe."""
        return await self._stt.transcribe_from_url(
            url, language=language, filename=filename
        )

    async def transcribe_from_file(
        self,
        file_path: str,
        *,
        language: str = "ar",
    ) -> str:
        """Transcribe a local audio file."""
        from services.file_service import resolve_path

        abs_path = resolve_path(file_path)
        with open(abs_path, "rb") as fh:
            data = fh.read()
        filename = abs_path.name
        return await self.transcribe(data, language=language, filename=filename)

    # ── Synthesis (TTS) ──────────────────────────────────────────────────
    async def synthesize(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        output_format: str = "mp3",
        voice_config: dict | None = None,
    ) -> bytes:
        """Convert text to audio bytes with automatic fallback.

        Tries ElevenLabs first (if configured), falls back to OpenAI.
        """
        # Update ElevenLabs config if provided
        if voice_config and self._tts_primary and isinstance(self._tts_primary, ElevenLabsTTS):
            self._tts_primary._voice_config = voice_config

        if self._tts_primary:
            try:
                audio = await self._tts_primary.synthesize(
                    text, voice=voice, speed=speed, output_format=output_format
                )
                self._last_tts_provider_name = self._tts_primary.provider_name
                return audio
            except Exception:
                logger.warning(
                    "ElevenLabs TTS failed, falling back to OpenAI",
                    exc_info=True,
                )

        audio = await self._tts_fallback.synthesize(
            text, voice=voice, speed=speed, output_format=output_format
        )
        self._last_tts_provider_name = self._tts_fallback.provider_name
        return audio

    async def synthesize_and_save(
        self,
        text: str,
        user_id: uuid.UUID,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        output_format: str = "mp3",
        voice_config: dict | None = None,
    ) -> str:
        """Synthesize and save to file. Returns the media URL path."""
        from services.file_service import save_file_bytes

        audio_bytes = await self.synthesize(
            text,
            voice=voice,
            speed=speed,
            output_format=output_format,
            voice_config=voice_config,
        )
        ext = f".{output_format}" if not output_format.startswith(".") else output_format
        if self.tts_provider_name == "elevenlabs" and output_format not in ("opus", "pcm"):
            ext = ".mp3"
        media_url, _ = await save_file_bytes(audio_bytes, ext, user_id)
        return media_url

    # ── Factory ──────────────────────────────────────────────────────────
    @classmethod
    def from_env(cls, openai_key: str, *, tts_provider: str = "auto") -> "VoiceService":
        """Create VoiceService from environment variables."""
        elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip() or None
        return cls(
            openai_key=openai_key,
            elevenlabs_key=elevenlabs_key,
            tts_provider=tts_provider,
        )

    @classmethod
    async def from_db(
        cls, db: AsyncSession, *, tts_provider: str = "auto"
    ) -> "VoiceService":
        """Create VoiceService using the effective API key from DB."""
        from services.settings_service import effective_openai_key

        openai_key = await effective_openai_key(db)
        return cls.from_env(openai_key, tts_provider=tts_provider)
