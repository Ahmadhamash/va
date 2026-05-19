import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import Booking, TimeSlot, User
from schemas.booking import (
    BookingCreate, BookingOut, BookingUpdate,
    PaymentMethodsUpdate,
    TimeSlotCreate, TimeSlotOut, TimeSlotUpdate,
)

router = APIRouter(tags=["bookings"])

DAY_NAMES_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]


# ─── Time Slots ──────────────────────────────────────────────────────────────
@router.get("/time-slots", response_model=list[TimeSlotOut])
async def list_time_slots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimeSlot)
        .where(TimeSlot.user_id == current_user.id)
        .order_by(TimeSlot.day_of_week, TimeSlot.start_time)
    )
    return list(result.scalars().all())


@router.post("/time-slots", response_model=TimeSlotOut, status_code=status.HTTP_201_CREATED)
async def create_time_slot(
    payload: TimeSlotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ts = TimeSlot(user_id=current_user.id, **payload.model_dump())
    db.add(ts)
    await db.commit()
    await db.refresh(ts)
    return ts


@router.put("/time-slots/{slot_id}", response_model=TimeSlotOut)
async def update_time_slot(
    slot_id: uuid.UUID,
    payload: TimeSlotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimeSlot).where(TimeSlot.id == slot_id, TimeSlot.user_id == current_user.id)
    )
    ts = result.scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Time slot not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ts, field, value)
    await db.commit()
    await db.refresh(ts)
    return ts


@router.delete("/time-slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_slot(
    slot_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimeSlot).where(TimeSlot.id == slot_id, TimeSlot.user_id == current_user.id)
    )
    ts = result.scalar_one_or_none()
    if ts is None:
        raise HTTPException(status_code=404, detail="Time slot not found")
    await db.delete(ts)
    await db.commit()


# ─── Bookings ────────────────────────────────────────────────────────────────
@router.get("/bookings", response_model=list[BookingOut])
async def list_bookings(
    status_filter: str | None = None,
    date_from: date | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.booking_date.desc(), Booking.booking_time.desc())
    )
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter)
    if date_from:
        stmt = stmt.where(Booking.booking_date >= date_from)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bk = Booking(user_id=current_user.id, **payload.model_dump())
    db.add(bk)
    await db.commit()
    await db.refresh(bk)
    return bk


@router.patch("/bookings/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: uuid.UUID,
    payload: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id)
    )
    bk = result.scalar_one_or_none()
    if bk is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bk, field, value)
    await db.commit()
    await db.refresh(bk)
    return bk


@router.delete("/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id)
    )
    bk = result.scalar_one_or_none()
    if bk is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.delete(bk)
    await db.commit()


# ─── Available Slots (for AI) ────────────────────────────────────────────────
@router.get("/available-slots")
async def get_available_slots(
    target_date: date | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return available booking slots for a given date (defaults to tomorrow)."""
    if target_date is None:
        target_date = date.today() + timedelta(days=1)

    day_of_week = target_date.weekday()
    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.user_id == current_user.id,
            TimeSlot.day_of_week == day_of_week,
            TimeSlot.is_active.is_(True),
        )
    )
    slots = list(result.scalars().all())
    if not slots:
        return {"date": target_date.isoformat(), "day": DAY_NAMES_AR[day_of_week], "available_slots": []}

    # Count existing bookings for this date
    bk_result = await db.execute(
        select(Booking.booking_time, func.count())
        .where(
            Booking.user_id == current_user.id,
            Booking.booking_date == target_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
        .group_by(Booking.booking_time)
    )
    booked = dict(bk_result.all())

    available = []
    for slot in slots:
        # Generate individual time slots
        current_time = datetime.combine(target_date, slot.start_time)
        end = datetime.combine(target_date, slot.end_time)
        while current_time + timedelta(minutes=slot.slot_duration_minutes) <= end:
            t = current_time.time()
            existing = booked.get(t, 0)
            if existing < slot.max_bookings_per_slot:
                available.append({
                    "time": t.strftime("%H:%M"),
                    "remaining": slot.max_bookings_per_slot - existing,
                })
            current_time += timedelta(minutes=slot.slot_duration_minutes)

    return {
        "date": target_date.isoformat(),
        "day": DAY_NAMES_AR[day_of_week],
        "available_slots": available,
    }


# ─── Payment Settings ────────────────────────────────────────────────────────
@router.get("/payment-settings")
async def get_payment_settings(
    current_user: User = Depends(get_current_user),
):
    return {"payment_methods": current_user.payment_methods or {}}


@router.put("/payment-settings")
async def update_payment_settings(
    payload: PaymentMethodsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.payment_methods = payload.payment_methods
    await db.commit()
    await db.refresh(current_user)
    return {"payment_methods": current_user.payment_methods}
