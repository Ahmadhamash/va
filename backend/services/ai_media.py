import base64
import io
import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from services.settings_service import effective_openai_key
from services.file_service import resolve_path
from services.openai_client import get_openai_client

logger = logging.getLogger("ai_media")
TRANSCRIBE_MODEL = "whisper-1"
OPENAI_TIMEOUT_SECONDS = 30.0

def _client_for(api_key: str):
    return get_openai_client(api_key, timeout=OPENAI_TIMEOUT_SECONDS)

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


# ─── External media helpers (Facebook CDN etc.) ─────────────────────────────
async def _download_bytes(url: str) -> bytes:
    """Download content from an external URL (e.g. Facebook CDN)."""
    import socket
    import ipaddress
    from urllib.parse import urlparse, urljoin
    
    current_url = url
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        for _ in range(5):
            parsed = urlparse(current_url)
            if not parsed.hostname:
                raise ValueError("Invalid URL")
            try:
                ip = socket.gethostbyname(parsed.hostname)
                ip_obj = ipaddress.ip_address(ip)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast:
                    raise ValueError(f"SSRF Protection: Blocked download from private IP {ip}")
            except Exception as e:
                logger.warning("SSRF blocked download from %s: %s", current_url, e)
                raise ValueError("Download from this domain is blocked")

            netloc = parsed.netloc.replace(parsed.hostname, f"[{ip}]" if ":" in ip else ip, 1)
            replaced_url = parsed._replace(netloc=netloc).geturl()
            headers = {"Host": parsed.hostname}
            
            resp = await client.get(replaced_url, headers=headers)
            
            if 300 <= resp.status_code < 400:
                loc = resp.headers.get("Location")
                if not loc:
                    raise ValueError("Redirect without location")
                current_url = urljoin(current_url, loc)
                continue
            
            resp.raise_for_status()
            return resp.content
            
        raise ValueError("Too many redirects")


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


