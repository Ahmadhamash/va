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

import httpx
from openai import AsyncOpenAI

logger = logging.getLogger("voice.stt")


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
        import socket
        import ipaddress
        from urllib.parse import urlparse

        parsed = urlparse(url)
        if parsed.hostname:
            try:
                ip = socket.gethostbyname(parsed.hostname)
                ip_obj = ipaddress.ip_address(ip)
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_multicast
                ):
                    raise ValueError(
                        f"SSRF Protection: Blocked download from private IP {ip}"
                    )
            except (socket.gaierror, ValueError) as e:
                logger.warning("SSRF check failed for %s: %s", url, e)
                raise

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content


class OpenAISTT(STTProvider):
    """OpenAI Whisper speech-to-text."""

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(api_key=api_key)

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
