"""WhatsApp Cloud API channel adapter.

Full implementation of the WhatsApp Business Cloud API via Meta Graph API.
Configurable and disabled by default until credentials are added.

Supports:
- Webhook verification (hub challenge)
- Receiving text, audio, image, video, document, sticker, location messages
- Sending text messages
- Sending audio messages (upload then send)
- Sending image messages
- Message status updates (sent/delivered/read/failed)
- 24-hour customer service window awareness
- Template message support (placeholder for messages outside 24h window)
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
from datetime import datetime
from typing import Any, Optional

import httpx

from services.channels.base import (
    ChannelAdapter,
    ChannelError,
    DeliveryResult,
    MessageStatus,
    NormalizedIncomingMessage,
)

logger = logging.getLogger("channels.whatsapp")

GRAPH_API = "https://graph.facebook.com/v21.0"
MAX_RETRIES = 3
_RETRYABLE_ERROR_CODES = {1, 2, 4, 130429, 131048, 131053}  # WhatsApp-specific retryable codes


class WhatsAppAdapter(ChannelAdapter):
    """WhatsApp Cloud API adapter."""

    @property
    def platform_name(self) -> str:
        return "whatsapp"

    # ── Webhook verification ─────────────────────────────────────────────
    async def verify_webhook(
        self, request_params: dict, credentials: dict
    ) -> Optional[str]:
        """Verify WhatsApp webhook subscription (same Meta hub challenge)."""
        mode = request_params.get("hub.mode")
        token = request_params.get("hub.verify_token")
        challenge = request_params.get("hub.challenge")
        expected = credentials.get("verify_token")
        if mode == "subscribe" and token and token == expected:
            logger.info("WhatsApp webhook verified successfully")
            return challenge or ""
        logger.warning("WhatsApp webhook verification failed")
        return None

    # ── Parse inbound ────────────────────────────────────────────────────
    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        """Parse WhatsApp Cloud API webhook payload.

        WhatsApp payload structure::

            {
                "object": "whatsapp_business_account",
                "entry": [{
                    "id": "WABA_ID",
                    "changes": [{
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "...",
                                "phone_number_id": "..."
                            },
                            "contacts": [{"profile": {"name": "..."}, "wa_id": "..."}],
                            "messages": [...],
                            "statuses": [...]
                        },
                        "field": "messages"
                    }]
                }]
            }
        """
        results: list[NormalizedIncomingMessage] = []

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                if change.get("field") != "messages":
                    continue

                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id", "")
                contacts = {
                    c.get("wa_id", ""): c.get("profile", {}).get("name")
                    for c in value.get("contacts", [])
                }

                for wa_msg in value.get("messages", []):
                    msg = self._parse_whatsapp_message(
                        wa_msg, contacts, phone_number_id
                    )
                    if msg is not None:
                        results.append(msg)

        return results

    def _parse_whatsapp_message(
        self,
        wa_msg: dict,
        contacts: dict[str, str | None],
        phone_number_id: str,
    ) -> NormalizedIncomingMessage | None:
        """Parse a single WhatsApp message object."""
        msg_type_raw = wa_msg.get("type", "")
        from_number = wa_msg.get("from", "")
        wa_id = wa_msg.get("id", "")
        ts_str = wa_msg.get("timestamp", "")

        try:
            ts = datetime.utcfromtimestamp(int(ts_str)) if ts_str else datetime.utcnow()
        except (ValueError, OSError):
            ts = datetime.utcnow()

        customer_name = contacts.get(from_number)
        text: str | None = None
        media_url: str | None = None
        media_id: str | None = None
        mime_type: str | None = None
        msg_type = "text"

        if msg_type_raw == "text":
            text = (wa_msg.get("text") or {}).get("body")
            msg_type = "text"

        elif msg_type_raw == "audio":
            audio = wa_msg.get("audio") or {}
            media_id = audio.get("id")
            mime_type = audio.get("mime_type")
            msg_type = "audio"

        elif msg_type_raw == "image":
            image = wa_msg.get("image") or {}
            media_id = image.get("id")
            mime_type = image.get("mime_type")
            text = image.get("caption")
            msg_type = "image"

        elif msg_type_raw == "video":
            video = wa_msg.get("video") or {}
            media_id = video.get("id")
            mime_type = video.get("mime_type")
            text = video.get("caption")
            msg_type = "video"

        elif msg_type_raw == "document":
            doc = wa_msg.get("document") or {}
            media_id = doc.get("id")
            mime_type = doc.get("mime_type")
            text = doc.get("caption") or doc.get("filename")
            msg_type = "file"

        elif msg_type_raw == "sticker":
            sticker = wa_msg.get("sticker") or {}
            media_id = sticker.get("id")
            mime_type = sticker.get("mime_type")
            msg_type = "image"

        elif msg_type_raw == "location":
            loc = wa_msg.get("location") or {}
            text = f"📍 Location: {loc.get('latitude')}, {loc.get('longitude')}"
            if loc.get("name"):
                text += f" ({loc['name']})"
            msg_type = "text"

        elif msg_type_raw == "contacts":
            # Flatten contact info into text
            wa_contacts = wa_msg.get("contacts", [])
            parts = []
            for c in wa_contacts:
                name = (c.get("name") or {}).get("formatted_name", "Unknown")
                phones = [p.get("phone", "") for p in c.get("phones", [])]
                parts.append(f"{name}: {', '.join(phones)}")
            text = "Shared contacts: " + "; ".join(parts)
            msg_type = "text"

        elif msg_type_raw == "reaction":
            # Reactions are informational; skip as a regular message
            return None

        else:
            msg_type = "unsupported"
            text = f"[Unsupported message type: {msg_type_raw}]"

        if not text and not media_id:
            return None

        return NormalizedIncomingMessage(
            id=wa_id,
            business_id=None,  # set by caller
            channel="whatsapp",
            external_conversation_id=from_number,
            external_user_id=from_number,
            customer_name=customer_name,
            customer_phone=from_number,
            message_type=msg_type,
            text=text,
            media_url=media_url,
            media_id=media_id,
            mime_type=mime_type,
            timestamp=ts,
            raw_payload=wa_msg,
        )

    # ── Message status updates ───────────────────────────────────────────
    def handle_message_status(self, payload: dict) -> list[MessageStatus]:
        """Parse WhatsApp status updates (sent/delivered/read/failed)."""
        statuses: list[MessageStatus] = []
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for status in value.get("statuses", []):
                    wa_status = status.get("status", "")
                    ts_str = status.get("timestamp", "")
                    try:
                        ts = (
                            datetime.utcfromtimestamp(int(ts_str))
                            if ts_str
                            else datetime.utcnow()
                        )
                    except (ValueError, OSError):
                        ts = datetime.utcnow()

                    errors = status.get("errors", [])
                    error_code = errors[0].get("code") if errors else None
                    error_msg = errors[0].get("title") if errors else None

                    statuses.append(
                        MessageStatus(
                            channel_message_id=status.get("id", ""),
                            status=wa_status,
                            timestamp=ts,
                            error_code=str(error_code) if error_code else None,
                            error_message=error_msg,
                            raw_payload=status,
                        )
                    )
        return statuses

    # ── Media download ───────────────────────────────────────────────────
    async def download_media(
        self, media_id_or_url: str, credentials: dict
    ) -> tuple[bytes, str]:
        """Download WhatsApp media. Two-step:
        1. GET /v21.0/{media_id} → returns {url: "...", mime_type: "..."}
        2. GET that URL with Bearer token → binary data
        """
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        if not token:
            raise ValueError("No access_token in WhatsApp credentials")

        # Step 1: get the download URL
        async with httpx.AsyncClient(timeout=30) as client:
            meta_resp = await client.get(
                f"{GRAPH_API}/{media_id_or_url}",
                headers={"Authorization": f"Bearer {token}"},
            )
            meta_resp.raise_for_status()
            meta_data = meta_resp.json()
            download_url = meta_data.get("url")
            mime_type = meta_data.get("mime_type", "application/octet-stream")

            if not download_url:
                raise ValueError(f"No download URL returned for media {media_id_or_url}")

            # Step 2: download the binary
            data_resp = await client.get(
                download_url,
                headers={"Authorization": f"Bearer {token}"},
            )
            data_resp.raise_for_status()
            return data_resp.content, mime_type

    # ── Outbound: text ───────────────────────────────────────────────────
    async def send_text_message(
        self, recipient_id: str, text: str, credentials: dict
    ) -> DeliveryResult:
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        phone_number_id = credentials.get("phone_number_id", "")
        if not token or not phone_number_id:
            return DeliveryResult(
                success=False,
                error_message="WhatsApp credentials incomplete (need access_token + phone_number_id)",
            )

        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_id,
            "type": "text",
            "text": {"body": text[:4096]},  # WhatsApp text limit
        }
        return await self._send_with_retry(phone_number_id, payload, token)

    # ── Outbound: audio ──────────────────────────────────────────────────
    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        """Send audio to WhatsApp. Upload the file first, then send by media ID."""
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        phone_number_id = credentials.get("phone_number_id", "")
        if not token or not phone_number_id:
            return DeliveryResult(
                success=False,
                error_message="WhatsApp credentials incomplete",
            )

        # Upload the audio file to WhatsApp media API
        media_id = await self._upload_media(
            phone_number_id, audio_url, "audio/mpeg", token
        )
        if not media_id:
            return DeliveryResult(
                success=False,
                error_message="Failed to upload audio to WhatsApp media API",
            )

        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_id,
            "type": "audio",
            "audio": {"id": media_id},
        }
        return await self._send_with_retry(phone_number_id, payload, token)

    # ── Outbound: image ──────────────────────────────────────────────────
    async def send_image_message(
        self, recipient_id: str, image_url: str, credentials: dict
    ) -> DeliveryResult:
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        phone_number_id = credentials.get("phone_number_id", "")
        if not token or not phone_number_id:
            return DeliveryResult(
                success=False,
                error_message="WhatsApp credentials incomplete",
            )

        # For WhatsApp, we can send images by URL if public
        public_url = self._make_public_url(image_url)
        if public_url:
            payload = {
                "messaging_product": "whatsapp",
                "to": recipient_id,
                "type": "image",
                "image": {"link": public_url},
            }
        else:
            # Upload first
            media_id = await self._upload_media(
                phone_number_id, image_url, "image/jpeg", token
            )
            if not media_id:
                return DeliveryResult(
                    success=False,
                    error_message="Failed to upload image to WhatsApp media API",
                )
            payload = {
                "messaging_product": "whatsapp",
                "to": recipient_id,
                "type": "image",
                "image": {"id": media_id},
            }

        return await self._send_with_retry(phone_number_id, payload, token)

    # ── Template messages (for outside 24h window) ───────────────────────
    async def send_template_message(
        self,
        recipient_id: str,
        template_name: str,
        language_code: str,
        components: list[dict],
        credentials: dict,
    ) -> DeliveryResult:
        """Send a pre-approved template message (for outside 24h window)."""
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        phone_number_id = credentials.get("phone_number_id", "")
        if not token or not phone_number_id:
            return DeliveryResult(
                success=False,
                error_message="WhatsApp credentials incomplete",
            )

        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_id,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components,
            },
        }
        return await self._send_with_retry(phone_number_id, payload, token)

    # ── Typing indicator (not supported by WhatsApp) ─────────────────────
    async def send_typing_indicator(
        self, recipient_id: str, credentials: dict
    ) -> None:
        pass  # WhatsApp Cloud API doesn't support typing indicators

    # ── Error normalisation ──────────────────────────────────────────────
    def normalize_error(self, error: Any) -> ChannelError:
        if isinstance(error, dict):
            err = error.get("error", error)
            code = err.get("code", "unknown")
            return ChannelError(
                code=str(code),
                message=err.get("message", str(error)),
                retryable=code in _RETRYABLE_ERROR_CODES
                if isinstance(code, int)
                else False,
                raw_error=error,
            )
        return ChannelError(code="unknown", message=str(error))

    # ── Internal helpers ─────────────────────────────────────────────────
    def _make_public_url(self, url_or_path: str) -> str | None:
        """Convert a local path to a public HTTPS URL."""
        if not url_or_path:
            return None
        if url_or_path.startswith("https://"):
            return url_or_path
        if url_or_path.startswith("http://"):
            return url_or_path.replace("http://", "https://", 1)

        domain = os.getenv("DOMAIN", "").strip()
        if not domain:
            return None

        clean = url_or_path.lstrip("/")
        if not clean.startswith("api/"):
            if clean.startswith("uploads/"):
                clean = f"api/{clean}"
            else:
                clean = f"api/uploads/{clean}"
        return f"https://{domain}/{clean}"

    async def download_media(self, media_id: str, credentials: dict) -> tuple[bytes, str]:
        """Download media bytes and return (bytes, mime_type)."""
        token = credentials.get("access_token") or credentials.get(
            "page_access_token", ""
        )
        if not token:
            raise ValueError("No access token for WhatsApp")

        async with httpx.AsyncClient(timeout=30) as client:
            # 1. Get media URL
            resp = await client.get(
                f"{GRAPH_API}/{media_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            url = data.get("url")
            mime = data.get("mime_type", "")
            if not url:
                raise ValueError(f"Could not retrieve URL for media_id {media_id}")

            # 2. Download bytes
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            return resp.content, mime

    async def _upload_media(
        self,
        phone_number_id: str,
        file_path_or_url: str,
        mime_type: str,
        token: str,
    ) -> str | None:
        """Upload a media file to WhatsApp's media API. Returns media ID."""
        try:
            # Read the file
            if file_path_or_url.startswith("http"):
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(file_path_or_url)
                    resp.raise_for_status()
                    data = resp.content
            else:
                from services.file_service import resolve_path

                path = resolve_path(file_path_or_url)
                data = path.read_bytes()

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{GRAPH_API}/{phone_number_id}/media",
                    headers={"Authorization": f"Bearer {token}"},
                    data={"messaging_product": "whatsapp", "type": mime_type},
                    files={"file": ("media", io.BytesIO(data), mime_type)},
                )
                resp.raise_for_status()
                return resp.json().get("id")
        except Exception:
            logger.exception("WhatsApp media upload failed")
            return None

    async def _send_with_retry(
        self, phone_number_id: str, payload: dict, token: str
    ) -> DeliveryResult:
        """POST to WhatsApp Cloud API with retry."""
        last_error: ChannelError | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{GRAPH_API}/{phone_number_id}/messages",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    resp_data = resp.json() if resp.status_code < 500 else {}

                    if resp.status_code in (200, 201):
                        messages = resp_data.get("messages", [])
                        msg_id = messages[0].get("id") if messages else None
                        logger.info("WhatsApp send success: message_id=%s", msg_id)
                        return DeliveryResult(
                            success=True,
                            channel_message_id=msg_id,
                            status="sent",
                            raw_response=resp_data,
                        )

                    error = self.normalize_error(resp_data)
                    logger.warning(
                        "WhatsApp send failed (attempt %d/%d, status=%d): %s",
                        attempt,
                        MAX_RETRIES,
                        resp.status_code,
                        error.message,
                    )
                    last_error = error

                    if not error.retryable and resp.status_code < 500:
                        return DeliveryResult(
                            success=False,
                            status="failed",
                            raw_response=resp_data,
                            error_code=error.code,
                            error_message=error.message,
                        )

            except httpx.TimeoutException as exc:
                logger.warning(
                    "WhatsApp send timeout (attempt %d/%d): %s",
                    attempt,
                    MAX_RETRIES,
                    exc,
                )
                last_error = ChannelError(
                    code="timeout", message=str(exc), retryable=True
                )
            except Exception as exc:
                logger.exception(
                    "WhatsApp send error (attempt %d/%d)", attempt, MAX_RETRIES
                )
                last_error = ChannelError(
                    code="exception", message=str(exc), retryable=False
                )
                break

            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 ** attempt)

        return DeliveryResult(
            success=False,
            status="failed",
            error_code=last_error.code if last_error else "unknown",
            error_message=last_error.message if last_error else "Unknown error",
        )
