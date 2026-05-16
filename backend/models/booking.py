import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class TimeSlot(Base):
    """Available time slots for a business (for booking/appointments).

    Defines the weekly schedule: which days, what hours, slot duration,
    and max bookings per slot.
    """

    __tablename__ = "time_slots"

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
    # 0=Monday ... 6=Sunday
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(
        Integer, default=30, server_default="30"
    )
    max_bookings_per_slot: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="time_slots")  # noqa: F821


class Booking(Base):
    """A customer booking/appointment."""

    __tablename__ = "bookings"

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
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    service_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)
    booking_time: Mapped[time] = mapped_column(Time, nullable=False)
    # 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed'
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="bookings")  # noqa: F821
