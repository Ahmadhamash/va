import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ProductCandidate(Base):
    """A product candidate identified from multimodal analysis.

    Created when the AI analyses an image, screenshot, or link sent by a
    customer and tries to match it to the business's catalog.
    """

    __tablename__ = "product_candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    # same_page_post | external_reference | screenshot | product_image | link
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    raw_media_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    image_analysis_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ocr_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # color, shape, brand hints, visible price text
    detected_attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    matched_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    confidence_score: Mapped[float] = mapped_column(
        Float, default=0.0, server_default="0.0"
    )
    # exact | strong_similar | weak | no_match
    match_type: Mapped[str] = mapped_column(
        String(20), default="no_match", server_default="no_match"
    )
    human_review_needed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    human_review_result: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    session: Mapped["ChatSession"] = relationship()  # noqa: F821
    matched_item: Mapped["Item"] = relationship()  # noqa: F821


class SocialPostMapping(Base):
    """Maps a social media post to a catalog item.

    When a customer sends an Instagram/Facebook post link, the system checks
    this table to see if it's been mapped to a known product.
    """

    __tablename__ = "social_post_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # instagram | facebook
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    post_id: Mapped[str] = mapped_column(String(100), nullable=False)
    post_url: Mapped[str] = mapped_column(Text, nullable=False)
    mapped_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    post_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    mapped_item: Mapped["Item"] = relationship()  # noqa: F821
