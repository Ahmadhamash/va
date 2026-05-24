"""Channel abstraction layer — unified interface for all messaging channels."""
from services.channels.base import (
    ChannelAdapter,
    NormalizedIncomingMessage,
    NormalizedOutgoingMessage,
    DeliveryResult,
    ChannelError,
    MessageStatus,
)
from services.channels.factory import get_adapter

__all__ = [
    "ChannelAdapter",
    "NormalizedIncomingMessage",
    "NormalizedOutgoingMessage",
    "DeliveryResult",
    "ChannelError",
    "MessageStatus",
    "get_adapter",
]
