"""Speech-to-Text provider abstraction.

Currently supports:
- OpenAI Whisper (default)
- Extensible for Azure, Google, etc.
"""
from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod
from typing import Optional

from openai import AsyncOpenAI

logger = logging.getLogger("voice.stt")
OPENAI_TIMEOUT_SECONDS = 30.0


class STTProvider(ABC):
    """Abstract base for speech-to-text providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @abstractmethod
    async def transcribe(
        self,
        audio_data: bytes,
        *,
        language: str = "ar",
        filename: str = "audio.mp4",
    ) -> str:
        """Transcribe audio bytes to text."""
        ...

    async def transcribe_from_url(
        self,
        url: str,
        *,
        language: str = "ar",
        filename: str = "audio.mp4",
    ) -> str:
        """Download audio from URL and transcribe."""
        data = await self._download(url)
        return await self.transcribe(data, language=language, filename=filename)

    async def _download(self, url: str) -> bytes:
        """Download from URL with SSRF protection."""
        from services.ai_media import _download_bytes

        return await _download_bytes(url)


class OpenAISTT(STTProvider):
    """OpenAI Whisper speech-to-text."""

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)

    @property
    def provider_name(self) -> str:
        return "openai"

    async def transcribe(
        self,
        audio_data: bytes,
        *,
        language: str = "ar",
        filename: str = "audio.mp4",
    ) -> str:
        audio_file = io.BytesIO(audio_data)
        audio_file.name = filename

        transcript = await self._client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text",
            language=language if language != "auto" else None,
        )
        return transcript if isinstance(transcript, str) else getattr(
            transcript, "text", ""
        )
