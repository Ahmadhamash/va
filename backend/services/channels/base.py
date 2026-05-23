"""Abstract base class and shared data structures for all channel adapters."""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class NormalizedIncomingMessage:
    """Channel-agnostic representation of an inbound message."""

    id: str
    business_id: Optional[uuid.UUID]
    channel: str  # messenger | instagram | whatsapp | widget | webhook
    external_conversation_id: str
    external_user_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    message_type: str = "text"  # text | audio | image | video | file | link | unsupported
    text: Optional[str] = None
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    mime_type: Optional[str] = None
    url: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    raw_payload: dict = field(default_factory=dict)


@dataclass
class NormalizedOutgoingMessage:
    """Channel-agnostic representation of an outbound message."""

    conversation_id: Optional[uuid.UUID] = None
    business_id: Optional[uuid.UUID] = None
    channel: str = ""
    type: str = "text"  # text | audio | image
    text: Optional[str] = None
    audio_url: Optional[str] = None
    media_url: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class DeliveryResult:
    """Result of sending a message through a channel."""

    success: bool
    channel_message_id: Optional[str] = None
    status: str = "pending"  # pending | sent | delivered | failed
    raw_response: Optional[dict] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retryable: bool = False


@dataclass
class MessageStatus:
    """Status update for a previously sent message."""

    channel_message_id: str
    status: str  # sent | delivered | read | failed
    timestamp: datetime = field(default_factory=datetime.utcnow)
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_payload: dict = field(default_factory=dict)


@dataclass
class ChannelError:
    """Normalized error from a channel API."""

    code: str
    message: str
    retryable: bool = False
    raw_error: Optional[dict] = None


class ChannelAdapter(ABC):
    """Abstract base class for messaging channel adapters.

    Every supported channel (Messenger, Instagram, WhatsApp, Widget, Webhook)
    must implement this interface so the rest of the platform can treat them
    uniformly.
    """

    @property
    @abstractmethod
    def platform_name(self) -> str:
        """Return the platform identifier string."""
        ...

    @abstractmethod
    async def verify_webhook(
        self, request_params: dict, credentials: dict
    ) -> Optional[str]:
        """Verify a webhook subscription request.

        Returns the challenge string if verification succeeds, None otherwise.
        """
        ...

    @abstractmethod
    def parse_incoming_webhook(
        self, payload: dict, credentials: dict
    ) -> list[NormalizedIncomingMessage]:
        """Parse raw webhook payload into normalized incoming messages."""
        ...

    @abstractmethod
    async def download_media(
        self, media_id_or_url: str, credentials: dict
    ) -> tuple[bytes, str]:
        """Download media file. Returns (data_bytes, mime_type)."""
        ...

    @abstractmethod
    async def send_text_message(
        self, recipient_id: str, text: str, credentials: dict
    ) -> DeliveryResult:
        """Send a text message to a recipient."""
        ...

    @abstractmethod
    async def send_audio_message(
        self, recipient_id: str, audio_url: str, credentials: dict
    ) -> DeliveryResult:
        """Send an audio message to a recipient."""
        ...

    async def send_image_message(
        self, recipient_id: str, image_url: str, credentials: dict
    ) -> DeliveryResult:
        """Send an image message. Optional — default returns unsupported."""
        return DeliveryResult(
            success=False, error_message="Image sending not supported on this channel"
        )

    async def send_typing_indicator(
        self, recipient_id: str, credentials: dict
    ) -> None:
        """Send a typing indicator. Optional — default is no-op."""
        pass

    def handle_message_status(self, payload: dict) -> list[MessageStatus]:
        """Parse message status updates from webhook. Default returns empty."""
        return []

    def normalize_error(self, error: Any) -> ChannelError:
        """Normalize a channel-specific error into a ChannelError."""
        return ChannelError(code="unknown", message=str(error))
