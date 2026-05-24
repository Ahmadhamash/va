"""Widget channel adapter (embeddable web chat).

The widget is synchronous-poll based: the frontend polls for new messages
rather than receiving push notifications, so the send methods are no-ops
(the message is already in the DB for polling).
"""
from __future__ import annotations

import logging
from typing import Optional

from services.channels.base import (
    ChannelAdapter,
    DeliveryResult,
    NormalizedIncomingMessage,
)

logger = logging.getLogger("channels.widget")


class WidgetAdapter(ChannelAdapter):
    """Adapter for the embeddable web chat widget."""

    @property
    def platform_name(self) -> str:
        return "widget"

    async def verify_webhook(
        self, request_params: dict, credentials: dict
    ) -> Optional[str]:
        # Widget doesn't use webhook verification
        return None

    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        # Widget messages are handled directly by the widget endpoint
        return []

    async def download_media(
        self, media_id_or_url: str, credentials: dict
    ) -> tuple[bytes, str]:
        raise NotImplementedError("Widget does not support media download")

    async def send_text_message(
        self, recipient_id: str, text: str, credentials: dict
    ) -> DeliveryResult:
        # Widget polls for messages — no push needed. The message is already
        # saved in the DB by the time this is called.
        return DeliveryResult(success=True, status="sent")

    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        # Widget polls for messages — audio URL is served from DB
        return DeliveryResult(success=True, status="sent")
