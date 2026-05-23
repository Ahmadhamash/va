import base64
import io
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI
from services.settings_service import effective_openai_key
from services.file_service import resolve_path, save_file_bytes
import uuid

logger = logging.getLogger("ai_media")
TRANSCRIBE_MODEL = "whisper-1"

# We need the shared AsyncOpenAI client getter, maybe just define a private one here or move it.
# Actually, let's keep it here or import it from ai_chat. But ai_chat imports ai_media.
# Let's put _client_for in a shared place or just duplicate the openai client fetch here.

_clients: dict[str, AsyncOpenAI] = {}
def _client_for(api_key: str) -> AsyncOpenAI:
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = _clients.get(api_key)
    if client is None:
        client = AsyncOpenAI(api_key=api_key)
        _clients[api_key] = client
    return client

# ─── Audio ───────────────────────────────────────────────────────────────────
class TranscriptionError(Exception):
    pass


async def transcribe_audio(media_url: str, db: AsyncSession) -> str:
    key = await effective_openai_key(db)
    abs_path = resolve_path(media_url)
    with open(abs_path, "rb") as fh:
        transcript = await _client_for(key).audio.transcriptions.create(
            model=TRANSCRIBE_MODEL, file=fh, response_format="text"
        )
    return transcript if isinstance(transcript, str) else getattr(
        transcript, "text", ""
    )


async def generate_tts(text: str, voice: str, user_id: uuid.UUID, db: AsyncSession) -> str:
    key = await effective_openai_key(db)
    client = _client_for(key)
    
    # Generate speech audio
    response = await client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text
    )
    
    # response is an HttpxBinaryResponseContent, we can get bytes using read()
    audio_bytes = response.read()
    
    # Save using the new save_file_bytes
    # OpenAI tts-1 defaults to mp3
    media_url, _ = await save_file_bytes(audio_bytes, ".mp3", user_id)
    return media_url


# ─── External media helpers (Facebook CDN etc.) ─────────────────────────────
async def _download_bytes(url: str) -> bytes:
    """Download content from an external URL (e.g. Facebook CDN)."""
    import socket
    import ipaddress
    from urllib.parse import urlparse
    
    try:
        parsed = urlparse(url)
        if parsed.hostname:
            ip = socket.gethostbyname(parsed.hostname)
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast:
                raise ValueError(f"SSRF Protection: Blocked download from private IP {ip}")
    except Exception as e:
        logger.warning("SSRF blocked download from %s: %s", url, e)
        raise ValueError("Download from this domain is blocked")

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def _encode_image_from_url(url: str) -> tuple[str, str]:
    """Download an image from URL and return (base64_string, mime_type)."""
    data = await _download_bytes(url)
    # Detect MIME from magic bytes
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data[:3] == b"GIF":
        mime = "image/gif"
    else:
        mime = "image/jpeg"
    return base64.b64encode(data).decode("utf-8"), mime


async def _transcribe_from_url(url: str, db: AsyncSession) -> str:
    """Download audio from URL and transcribe via Whisper."""
    data = await _download_bytes(url)
    key = await effective_openai_key(db)
    audio_file = io.BytesIO(data)
    audio_file.name = "audio.mp4"  # OpenAI SDK needs a filename with extension
    transcript = await _client_for(key).audio.transcriptions.create(
        model=TRANSCRIBE_MODEL, file=audio_file, response_format="text",
    )
    return transcript if isinstance(transcript, str) else getattr(transcript, "text", "")


