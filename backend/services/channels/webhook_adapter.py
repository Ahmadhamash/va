"""Generic webhook channel adapter.

Synchronous request/response — the reply is returned in the HTTP response
body rather than being pushed asynchronously.
"""
from __future__ import annotations

import logging
from typing import Optional

from services.channels.base import (
    ChannelAdapter,
    DeliveryResult,
    NormalizedIncomingMessage,
)

logger = logging.getLogger("channels.webhook")


class WebhookAdapter(ChannelAdapter):
    """Adapter for the generic (synchronous) webhook API."""

    @property
    def platform_name(self) -> str:
        return "webhook"

    async def verify_webhook(
        self, request_params: dict, credentials: dict
    ) -> Optional[str]:
        # Generic webhook uses header-based secret, not hub challenge
        return None

    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        text = (payload.get("message") or payload.get("text") or "").strip()
        sender = str(payload.get("sender_id") or payload.get("from") or "anonymous")
        if not text:
            return []
        return [
            NormalizedIncomingMessage(
                id="",
                business_id=None,
                channel="webhook",
                external_conversation_id=sender,
                external_user_id=sender,
                message_type="text",
                text=text,
                raw_payload=payload,
            )
        ]

    async def download_media(
        self, media_id_or_url: str, credentials: dict
    ) -> tuple[bytes, str]:
        raise NotImplementedError("Generic webhook does not support media download")

    async def send_text_message(
        self, recipient_id: str, text: str, credentials: dict
    ) -> DeliveryResult:
        # Reply is returned synchronously in the HTTP response
        return DeliveryResult(success=True, status="sent")

    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        # Webhook is text-only in the synchronous response
        return DeliveryResult(
            success=False,
            error_message="Generic webhook does not support audio messages",
        )
