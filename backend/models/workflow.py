import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class BusinessWorkflow(Base):
    __tablename__ = "business_workflows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The condition/trigger. Free-text or presets like 'digital_product_purchase'
    trigger_event: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # E.g., 'send_link', 'send_form', 'send_text'
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # The actual content to send (URL or text message)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
