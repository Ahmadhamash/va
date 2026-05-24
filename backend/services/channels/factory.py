"""Factory for obtaining the correct channel adapter by platform name."""
from __future__ import annotations

import logging

from services.channels.base import ChannelAdapter

logger = logging.getLogger("channels.factory")

_adapters: dict[str, ChannelAdapter] = {}


def get_adapter(platform: str) -> ChannelAdapter:
    """Return the singleton channel adapter for *platform*.

    Adapters are lazily imported so the application does not pay the cost of
    importing all adapters up-front (useful if some have heavy optional deps).
    """
    if platform not in _adapters:
        if platform == "messenger":
            from services.channels.messenger_adapter import MessengerAdapter
            _adapters[platform] = MessengerAdapter()
        elif platform == "instagram":
            from services.channels.instagram_adapter import InstagramAdapter
            _adapters[platform] = InstagramAdapter()
        elif platform == "whatsapp":
            from services.channels.whatsapp_adapter import WhatsAppAdapter
            _adapters[platform] = WhatsAppAdapter()
        elif platform == "widget":
            from services.channels.widget_adapter import WidgetAdapter
            _adapters[platform] = WidgetAdapter()
        elif platform == "webhook":
            from services.channels.webhook_adapter import WebhookAdapter
            _adapters[platform] = WebhookAdapter()
        else:
            raise ValueError(f"Unknown platform: {platform}")
    return _adapters[platform]
