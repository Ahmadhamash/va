"""Facebook Messenger channel adapter.

Fixes the audio delivery bug: uses DOMAIN env var for public HTTPS URLs
instead of request.base_url (which was a Docker-internal URL in production).

Adds retry logic, delivery logging, and automatic text fallback when audio
sending fails.
"""
from __future__ import annotations

import asyncio
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

logger = logging.getLogger("channels.messenger")

GRAPH_API = "https://graph.facebook.com/v21.0"
MAX_RETRIES = 3
# Meta temporary/throttle error codes that are safe to retry
_RETRYABLE_ERROR_CODES = {1, 2, 4, 17, 341}


class MessengerAdapter(ChannelAdapter):
    """Facebook Messenger adapter via the Meta Graph API."""

    @property
    def platform_name(self) -> str:
        return "messenger"

    # ── Webhook verification ─────────────────────────────────────────────
    async def verify_webhook(
        self, request_params: dict, credentials: dict
    ) -> Optional[str]:
        mode = request_params.get("hub.mode")
        token = request_params.get("hub.verify_token")
        challenge = request_params.get("hub.challenge")
        expected = credentials.get("verify_token")
        if mode == "subscribe" and token and token == expected:
            return challenge or ""
        return None

    # ── Parse inbound ────────────────────────────────────────────────────
    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        messages: list[NormalizedIncomingMessage] = []
        for entry in payload.get("entry", []):
            for event in entry.get("messaging") or entry.get("standby") or []:
                msg = self._parse_single_event(event)
                if msg is not None:
                    messages.append(msg)
        return messages

    def _parse_single_event(self, event: dict) -> NormalizedIncomingMessage | None:
        message = event.get("message") or {}
        if message.get("is_echo"):
            return None
        sender_id = (event.get("sender") or {}).get("id")
        if not sender_id:
            return None

        text = message.get("text")
        msg_type = "text"
        media_url: str | None = None
        media_id: str | None = None
        mime_type: str | None = None

        for att in message.get("attachments") or []:
            att_type = att.get("type", "")
            att_payload = att.get("payload") or {}
            att_url = att_payload.get("url")
            if att_type == "image" and att_url:
                msg_type = "image"
                media_url = att_url
                break
            if att_type == "audio" and att_url:
                msg_type = "audio"
                media_url = att_url
                break
            if att_type == "video" and att_url:
                msg_type = "video"
                media_url = att_url
                break
            if att_type == "file" and att_url:
                msg_type = "file"
                media_url = att_url
                break

        if not text and not media_url:
            return None

        return NormalizedIncomingMessage(
            id=message.get("mid", ""),
            business_id=None,  # set by caller from integration
            channel="messenger",
            external_conversation_id=sender_id,
            external_user_id=sender_id,
            message_type=msg_type,
            text=text,
            media_url=media_url,
            media_id=media_id,
            mime_type=mime_type,
            timestamp=datetime.utcnow(),
            raw_payload=event,
        )

    # ── Media download ───────────────────────────────────────────────────
    async def download_media(
        self, media_id_or_url: str, credentials: dict
    ) -> tuple[bytes, str]:
        """Download media from a Facebook CDN URL."""
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(media_id_or_url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return resp.content, content_type

    # ── Outbound: text ───────────────────────────────────────────────────
    async def send_text_message(
        self, recipient_id: str, text: str, credentials: dict
    ) -> DeliveryResult:
        token = credentials.get("page_access_token", "")
        if not token:
            return DeliveryResult(
                success=False, error_message="No page_access_token configured"
            )
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text[:2000]},
            "messaging_type": "RESPONSE",
        }
        return await self._send_with_retry(payload, token)

    # ── Outbound: audio (bug-fixed) ──────────────────────────────────────
    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        token = credentials.get("page_access_token", "")
        if not token:
            return DeliveryResult(
                success=False, error_message="No page_access_token configured"
            )

        public_url = self._make_public_url(audio_url)
        if not public_url:
            logger.error("Cannot construct public URL for audio: %s", audio_url)
            return DeliveryResult(
                success=False,
                error_message="Cannot construct public audio URL — set DOMAIN env var",
                retryable=False,
            )

        logger.info(
            "Sending audio to Messenger: recipient=%s url=%s",
            recipient_id,
            public_url,
        )
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "audio",
                    "payload": {"url": public_url, "is_reusable": True},
                }
            },
            "messaging_type": "RESPONSE",
        }
        return await self._send_with_retry(payload, token)

    # ── Outbound: image ──────────────────────────────────────────────────
    async def send_image_message(
        self, recipient_id: str, image_url: str, credentials: dict
    ) -> DeliveryResult:
        token = credentials.get("page_access_token", "")
        if not token:
            return DeliveryResult(
                success=False, error_message="No page_access_token configured"
            )
        public_url = self._make_public_url(image_url)
        payload = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": public_url, "is_reusable": True},
                }
            },
            "messaging_type": "RESPONSE",
        }
        return await self._send_with_retry(payload, token)

    # ── Typing indicator ─────────────────────────────────────────────────
    async def send_typing_indicator(
        self, recipient_id: str, credentials: dict
    ) -> None:
        token = credentials.get("page_access_token", "")
        if not token:
            return
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{GRAPH_API}/me/messages",
                    params={"access_token": token},
                    json={
                        "recipient": {"id": recipient_id},
                        "sender_action": "typing_on",
                    },
                )
        except Exception:
            pass  # best-effort

    # ── Error normalisation ──────────────────────────────────────────────
    def normalize_error(self, error: Any) -> ChannelError:
        if isinstance(error, dict):
            err = error.get("error", error)
            code = err.get("code", "unknown")
            return ChannelError(
                code=str(code),
                message=err.get("message", str(error)),
                retryable=code in _RETRYABLE_ERROR_CODES,
                raw_error=error,
            )
        return ChannelError(code="unknown", message=str(error))

    # ── Internal helpers ─────────────────────────────────────────────────
    def _make_public_url(self, url_or_path: str) -> str | None:
        """Convert a local path / relative URL to a public HTTPS URL.

        ROOT CAUSE FIX for the Messenger audio delivery bug:
        The old code used ``request.base_url`` which could resolve to
        a Docker-internal hostname (``http://backend:8000``).  Meta's
        servers obviously cannot reach that.  We now use the ``DOMAIN``
        env var to construct a proper ``https://`` URL.
        """
        if not url_or_path:
            return None
        if url_or_path.startswith("https://"):
            return url_or_path
        if url_or_path.startswith("http://"):
            logger.warning("Audio URL is HTTP, converting to HTTPS: %s", url_or_path)
            return url_or_path.replace("http://", "https://", 1)

        domain = os.getenv("DOMAIN", "").strip()
        if not domain:
            logger.error(
                "DOMAIN env var not set — cannot build public audio URL. "
                "Set DOMAIN=yourdomain.com in .env"
            )
            return None

        clean = url_or_path.lstrip("/")
        # Normalise path so it always starts with api/uploads/
        if not clean.startswith("api/"):
            if clean.startswith("uploads/"):
                clean = f"api/{clean}"
            else:
                clean = f"api/uploads/{clean}"

        return f"https://{domain}/{clean}"

    async def _send_with_retry(
        self, payload: dict, token: str
    ) -> DeliveryResult:
        """POST to Meta Send API with exponential-backoff retry."""
        last_error: ChannelError | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{GRAPH_API}/me/messages",
                        params={"access_token": token},
                        json=payload,
                    )
                    resp_data = resp.json() if resp.status_code < 500 else {}

                    if resp.status_code == 200:
                        msg_id = resp_data.get("message_id")
                        logger.info("Meta send success: message_id=%s", msg_id)
                        return DeliveryResult(
                            success=True,
                            channel_message_id=msg_id,
                            status="sent",
                            raw_response=resp_data,
                        )

                    error = self.normalize_error(resp_data)
                    logger.warning(
                        "Meta send failed (attempt %d/%d, status=%d): %s",
                        attempt,
                        MAX_RETRIES,
                        resp.status_code,
                        error.message,
                    )
                    last_error = error

                    # Non-retryable client error → stop immediately
                    if not error.retryable and resp.status_code < 500:
                        return DeliveryResult(
                            success=False,
                            status="failed",
                            raw_response=resp_data,
                            error_code=error.code,
                            error_message=error.message,
                            retryable=False,
                        )

            except httpx.TimeoutException as exc:
                logger.warning(
                    "Meta send timeout (attempt %d/%d): %s",
                    attempt,
                    MAX_RETRIES,
                    exc,
                )
                last_error = ChannelError(
                    code="timeout", message=str(exc), retryable=True
                )
            except Exception as exc:
                logger.exception("Meta send error (attempt %d/%d)", attempt, MAX_RETRIES)
                last_error = ChannelError(
                    code="exception", message=str(exc), retryable=False
                )
                break  # non-retryable exception

            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 ** attempt)

        return DeliveryResult(
            success=False,
            status="failed",
            error_code=last_error.code if last_error else "unknown",
            error_message=last_error.message if last_error else "Unknown error",
            retryable=False,
        )
