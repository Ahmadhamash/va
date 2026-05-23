"""Instagram DM channel adapter.

Reuses the same Meta Graph API as Messenger but with Instagram-specific
limitations (e.g. no audio DM send via the API).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

import httpx

from services.channels.base import (
    ChannelAdapter,
    ChannelError,
    DeliveryResult,
    NormalizedIncomingMessage,
)
from services.channels.messenger_adapter import MessengerAdapter

logger = logging.getLogger("channels.instagram")


class InstagramAdapter(MessengerAdapter):
    """Instagram DM adapter — inherits from Messenger since both use the
    Meta Graph API, but overrides behaviour where Instagram differs."""

    @property
    def platform_name(self) -> str:
        return "instagram"

    # ── Parse inbound ────────────────────────────────────────────────────
    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        """Parse Instagram webhook — same structure as Messenger but channel
        is tagged 'instagram'."""
        messages = super().parse_incoming_webhook(payload, credentials)
        for msg in messages:
            msg.channel = "instagram"
        return messages

    # ── Audio sending not supported on Instagram DM API ──────────────────
    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        logger.info(
            "Instagram DM does not support audio messages — falling back to text"
        )
        return DeliveryResult(
            success=False,
            error_message="Instagram DM API does not support sending audio messages",
            retryable=False,
        )

    # ── Typing indicator not supported on Instagram ──────────────────────
    async def send_typing_indicator(
        self, recipient_id: str, credentials: dict
    ) -> None:
        pass  # Instagram DM API does not support typing indicators
