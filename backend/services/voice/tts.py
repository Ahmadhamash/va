"""Text-to-Speech provider abstraction.

Priority:
1. ElevenLabs (primary for Arabic — natural Jordanian voice)
2. OpenAI TTS (fallback if ElevenLabs API key missing)

Provider selection logic:
  if ELEVENLABS_API_KEY exists → ElevenLabs (primary)
  else → OpenAI TTS (fallback, always available)
"""
from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Optional

import httpx
from openai import AsyncOpenAI

logger = logging.getLogger("voice.tts")


class TTSProvider(ABC):
    """Abstract base for text-to-speech providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        output_format: str = "mp3",
    ) -> bytes:
        """Convert text to audio bytes."""
        ...


class ElevenLabsTTS(TTSProvider):
    """ElevenLabs TTS — premium Arabic voice quality.

    Uses the ElevenLabs v1 API with the multilingual_v2 model for
    natural Jordanian Arabic speech.
    """

    API_BASE = "https://api.elevenlabs.io/v1"
    DEFAULT_MODEL = "eleven_multilingual_v2"

    # Default ElevenLabs voice IDs (can be overridden via tts_config)
    # These are ElevenLabs built-in voices good for Arabic
    DEFAULT_VOICE_MAP = {
        "nova": "EXAVITQu4vr4xnSDxMaL",      # Sarah
        "alloy": "21m00Tcm4TlvDq8ikWAM",       # Rachel
        "shimmer": "MF3mGyEYCl7XYWbV9V6O",     # Elli
        "echo": "yoZ06aMxZJJ28mfd3POQ",         # Sam
        "onyx": "ErXwobaYiN019PkySvjV",         # Antoni
        "fable": "pNInz6obpgDQGcFmaJgB",        # Adam
        "el_jordanian_female": "EXAVITQu4vr4xnSDxMaL",
        "el_levantine_male": "ErXwobaYiN019PkySvjV",
        "el_gulf_female": "MF3mGyEYCl7XYWbV9V6O",
        "el_egyptian_female": "21m00Tcm4TlvDq8ikWAM",
        "el_iraqi_male": "yoZ06aMxZJJ28mfd3POQ",
        "el_moroccan_male": "pNInz6obpgDQGcFmaJgB",
    }

    def __init__(self, api_key: str, voice_config: dict | None = None):
        self._api_key = api_key
        self._voice_config = voice_config or {}

    @property
    def provider_name(self) -> str:
        return "elevenlabs"

    async def synthesize(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        output_format: str = "mp3",
    ) -> bytes:
        # Resolve voice ID
        voice_id = self._voice_config.get(
            "voice_id",
            self.DEFAULT_VOICE_MAP.get(voice, self.DEFAULT_VOICE_MAP["nova"]),
        )
        model_id = self._voice_config.get("model_id", self.DEFAULT_MODEL)
        stability = self._voice_config.get("stability", 0.5)
        similarity_boost = self._voice_config.get("similarity_boost", 0.75)
        style = self._voice_config.get("style", 0.4)

        url = f"{self.API_BASE}/text-to-speech/{voice_id}"

        # ElevenLabs output format mapping
        el_format = "mp3_44100_128"
        if output_format == "opus":
            el_format = "opus_48000_64"
        elif output_format == "pcm":
            el_format = "pcm_24000"

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": True,
            },
        }

        logger.info(
            "ElevenLabs TTS: voice_id=%s model=%s text_len=%d",
            voice_id,
            model_id,
            len(text),
        )

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                    params={"output_format": el_format},
                )
                resp.raise_for_status()
                logger.info(
                    "ElevenLabs TTS success: %d bytes", len(resp.content)
                )
                return resp.content
        except httpx.HTTPStatusError as e:
            logger.error(
                "ElevenLabs TTS failed (status %d): %s",
                e.response.status_code,
                e.response.text[:500],
            )
            raise
        except Exception:
            logger.exception("ElevenLabs TTS error")
            raise


class OpenAITTS(TTSProvider):
    """OpenAI TTS — reliable fallback for development."""

    # OpenAI voices good for Arabic: alloy, nova, shimmer
    VOICE_MAP = {
        "nova": "nova",
        "alloy": "alloy",
        "shimmer": "shimmer",
        "echo": "echo",
        "onyx": "onyx",
        "fable": "fable",
    }

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    async def synthesize(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        output_format: str = "mp3",
    ) -> bytes:
        mapped_voice = self.VOICE_MAP.get(voice, "nova")

        # OpenAI supports: mp3, opus, aac, flac, wav, pcm
        tts_format = output_format if output_format in (
            "mp3", "opus", "aac", "flac", "wav", "pcm"
        ) else "mp3"

        logger.info(
            "OpenAI TTS: voice=%s speed=%.1f format=%s text_len=%d",
            mapped_voice,
            speed,
            tts_format,
            len(text),
        )

        response = await self._client.audio.speech.create(
            model="tts-1",
            voice=mapped_voice,
            input=text,
            speed=speed,
            response_format=tts_format,
        )
        audio_bytes = response.read()
        logger.info("OpenAI TTS success: %d bytes", len(audio_bytes))
        return audio_bytes
