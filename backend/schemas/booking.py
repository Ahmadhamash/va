import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


# ─── TimeSlot ────────────────────────────────────────────────────────────────
class TimeSlotCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    slot_duration_minutes: int = Field(default=30, ge=5, le=480)
    max_bookings_per_slot: int = Field(default=1, ge=1)
    is_active: bool = True


class TimeSlotUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    slot_duration_minutes: int | None = Field(default=None, ge=5, le=480)
    max_bookings_per_slot: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class TimeSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration_minutes: int
    max_bookings_per_slot: int
    is_active: bool
    created_at: datetime


# ─── Booking ─────────────────────────────────────────────────────────────────
class BookingCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=255)
    customer_phone: str | None = Field(default=None, max_length=50)
    service_name: str | None = Field(default=None, max_length=255)
    booking_date: date
    booking_time: time
    notes: str | None = None


class BookingUpdate(BaseModel):
    customer_name: str | None = Field(default=None, min_length=1, max_length=255)
    customer_phone: str | None = None
    service_name: str | None = None
    booking_date: date | None = None
    booking_time: time | None = None
    status: str | None = Field(default=None, pattern=r"^(pending|confirmed|cancelled|rescheduled|completed)$")
    notes: str | None = None


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID | None
    customer_name: str
    customer_phone: str | None
    service_name: str | None
    booking_date: date
    booking_time: time
    status: str
    notes: str | None
    created_at: datetime


# ─── Payment Settings ────────────────────────────────────────────────────────
class PaymentMethodsUpdate(BaseModel):
    payment_methods: dict
