import base64
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/ogg",
    "audio/webm",
}

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AUDIO_EXT = {".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".webm", ".opus"}

MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB

_IMAGE_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

_AUDIO_MIME_BY_EXT = {
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".opus": "audio/ogg",
}

_EXT_BY_MIME = {
    **{mime: ext for ext, mime in _IMAGE_MIME_BY_EXT.items()},
    **{mime: ext for ext, mime in _AUDIO_MIME_BY_EXT.items()},
    "audio/mp3": ".mp3",
    "audio/x-wav": ".wav",
    "audio/x-m4a": ".m4a",
    "video/mp4": ".mp4",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename or "file")
    name = _SAFE_NAME.sub("_", name)
    return name[:120] or "file"


def _classify(content_type: str, ext: str) -> str:
    """Return 'image' or 'audio', validating MIME *and* extension. Raises 400 otherwise."""
    ct = (content_type or "").lower()
    ext = ext.lower()
    if ct in ALLOWED_IMAGE_TYPES and ext in ALLOWED_IMAGE_EXT:
        return "image"
    if ct in ALLOWED_AUDIO_TYPES and ext in ALLOWED_AUDIO_EXT:
        return "audio"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported file type (content-type={content_type!r}, ext={ext!r})",
    )


async def save_upload(file: UploadFile, user_id: uuid.UUID) -> tuple[str, str]:
    """
    Persist an uploaded file under uploads/{user_id}/{timestamp}_{name}.
    Returns (relative_path, media_type) where media_type is 'image' or 'audio'.
    """
    original = _sanitize_filename(file.filename or "upload")
    ext = Path(original).suffix.lower()

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file"
        )
        
    import magic
    actual_mime = magic.from_buffer(contents, mime=True)
    media_type = _classify(actual_mime, ext)

    limit = MAX_IMAGE_SIZE if media_type == "image" else MAX_AUDIO_SIZE
    if len(contents) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {limit // (1024 * 1024)}MB limit",
        )

    user_dir = _upload_root() / str(user_id)
    import asyncio
    await asyncio.to_thread(user_dir.mkdir, parents=True, exist_ok=True)

    stored_name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}_{original}"
    abs_path = user_dir / stored_name
    
    def _write_file():
        with open(abs_path, "wb") as fh:
            fh.write(contents)
            
    await asyncio.to_thread(_write_file)

    rel_path = str(Path(str(user_id)) / stored_name).replace("\\", "/")
    return rel_path, media_type


async def save_file_bytes(content: bytes, extension: str, user_id: uuid.UUID) -> tuple[str, str]:
    """
    Persist raw bytes under uploads/{user_id}/{timestamp}{extension}.
    Returns (relative_path, media_type) where media_type is 'image' or 'audio'.
    """
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file"
        )
        
    import magic
    import asyncio
    actual_mime = await asyncio.to_thread(magic.from_buffer, content, mime=True)
    media_type = _classify(actual_mime, extension)

    return await _persist_bytes(content, extension, user_id, media_type)


async def save_external_file_bytes(
    content: bytes,
    content_type: str | None,
    user_id: uuid.UUID,
) -> tuple[str, str]:
    """Persist downloaded channel media using MIME sniffing for the extension."""
    import magic

    actual_mime = magic.from_buffer(content, mime=True)
    hint_mime = (content_type or "").split(";", 1)[0].strip().lower()
    ext = _EXT_BY_MIME.get(actual_mime) or _EXT_BY_MIME.get(hint_mime)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported external media type "
                f"(content-type={content_type!r}, actual={actual_mime!r})"
            ),
        )
    if actual_mime in ALLOWED_IMAGE_TYPES:
        media_type = "image"
    elif actual_mime in ALLOWED_AUDIO_TYPES or actual_mime == "video/mp4":
        media_type = "audio"
    elif hint_mime in ALLOWED_IMAGE_TYPES:
        media_type = "image"
    elif hint_mime in ALLOWED_AUDIO_TYPES:
        media_type = "audio"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported external media type "
                f"(content-type={content_type!r}, actual={actual_mime!r})"
            ),
        )
    return await _persist_bytes(content, ext, user_id, media_type)


async def _persist_bytes(
    content: bytes,
    extension: str,
    user_id: uuid.UUID,
    media_type: str,
) -> tuple[str, str]:
    limit = MAX_IMAGE_SIZE if media_type == "image" else MAX_AUDIO_SIZE
    if len(content) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {limit // (1024 * 1024)}MB limit",
        )

    user_dir = _upload_root() / str(user_id)
    import asyncio
    await asyncio.to_thread(user_dir.mkdir, parents=True, exist_ok=True)

    stored_name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{extension}"
    abs_path = user_dir / stored_name
    
    def _write_file():
        with open(abs_path, "wb") as fh:
            fh.write(content)
            
    await asyncio.to_thread(_write_file)

    rel_path = str(Path(str(user_id)) / stored_name).replace("\\", "/")
    return rel_path, media_type


def resolve_path(relative_path: str) -> Path:
    """Resolve a stored relative path safely inside the upload root."""
    root = _upload_root()
    abs_path = (root / relative_path).resolve()
    if root not in abs_path.parents and abs_path != root:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")
    if not abs_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return abs_path


async def encode_image_base64(relative_path: str) -> tuple[str, str]:
    """Return (base64_string, mime_type) for an image stored under uploads/."""
    abs_path = resolve_path(relative_path)
    mime = _IMAGE_MIME_BY_EXT.get(abs_path.suffix.lower(), "image/jpeg")
    
    def _read_file():
        with open(abs_path, "rb") as fh:
            return base64.b64encode(fh.read()).decode("utf-8"), mime
            
    import asyncio
    return await asyncio.to_thread(_read_file)
