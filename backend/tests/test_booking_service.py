import uuid
from datetime import date, time

import pytest
from sqlalchemy import select

from models import Booking, TimeSlot, User
from services.ai_tools import _exec_create_booking
from services.booking_service import (
    ACTIVE_BOOKING_STATUSES,
    BookingSlotFull,
    BookingSlotUnavailable,
    create_booking_atomic,
    list_available_booking_slots,
    update_booking_atomic,
)


async def _create_user(db_session, name: str = "booking_user") -> User:
    user = User(
        id=uuid.uuid4(),
        username=f"{name}_{uuid.uuid4().hex}",
        email=f"{name}_{uuid.uuid4().hex}@example.com",
        hashed_password="x",
        business_name="Booking Test",
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _create_slot(
    db_session,
    user_id: uuid.UUID,
    target_date: date,
    *,
    start_time: time = time(9, 0),
    end_time: time = time(10, 0),
    duration: int = 30,
    capacity: int = 1,
) -> TimeSlot:
    slot = TimeSlot(
        user_id=user_id,
        day_of_week=target_date.weekday(),
        start_time=start_time,
        end_time=end_time,
        slot_duration_minutes=duration,
        max_bookings_per_slot=capacity,
        is_active=True,
    )
    db_session.add(slot)
    await db_session.commit()
    return slot


async def _active_bookings_for_slot(db_session, user_id, target_date, target_time):
    result = await db_session.execute(
        select(Booking).where(
            Booking.user_id == user_id,
            Booking.booking_date == target_date,
            Booking.booking_time == target_time,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        )
    )
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_create_booking_atomic_prevents_overbooking(db_session):
    user = await _create_user(db_session)
    user_id = user.id
    target_date = date(2026, 7, 6)
    target_time = time(9, 0)
    await _create_slot(db_session, user_id, target_date, capacity=1)

    booking = await create_booking_atomic(
        db_session,
        user_id=user_id,
        customer_name="First Customer",
        booking_date=target_date,
        booking_time=target_time,
    )
    booking_id = booking.id

    with pytest.raises(BookingSlotFull):
        await create_booking_atomic(
            db_session,
            user_id=user_id,
            customer_name="Second Customer",
            booking_date=target_date,
            booking_time=target_time,
        )

    active_bookings = await _active_bookings_for_slot(
        db_session, user_id, target_date, target_time
    )
    assert [row.id for row in active_bookings] == [booking_id]


@pytest.mark.asyncio
async def test_create_booking_atomic_rejects_unaligned_slot_time(db_session):
    user = await _create_user(db_session)
    user_id = user.id
    target_date = date(2026, 7, 6)
    await _create_slot(db_session, user_id, target_date, duration=30)

    with pytest.raises(BookingSlotUnavailable):
        await create_booking_atomic(
            db_session,
            user_id=user_id,
            customer_name="Unaligned Customer",
            booking_date=target_date,
            booking_time=time(9, 15),
        )

    assert await _active_bookings_for_slot(db_session, user_id, target_date, time(9, 15)) == []


@pytest.mark.asyncio
async def test_overlapping_schedules_are_aggregated_for_capacity(db_session):
    user = await _create_user(db_session)
    user_id = user.id
    target_date = date(2026, 7, 6)
    target_time = time(9, 0)
    await _create_slot(db_session, user_id, target_date, capacity=1)
    await _create_slot(db_session, user_id, target_date, capacity=1)

    available = await list_available_booking_slots(db_session, user_id, target_date)
    nine_am_slots = [slot for slot in available if slot.time == target_time]
    assert len(nine_am_slots) == 1
    assert nine_am_slots[0].remaining == 2

    await create_booking_atomic(
        db_session,
        user_id=user_id,
        customer_name="First Customer",
        booking_date=target_date,
        booking_time=target_time,
    )
    await create_booking_atomic(
        db_session,
        user_id=user_id,
        customer_name="Second Customer",
        booking_date=target_date,
        booking_time=target_time,
    )

    with pytest.raises(BookingSlotFull):
        await create_booking_atomic(
            db_session,
            user_id=user_id,
            customer_name="Third Customer",
            booking_date=target_date,
            booking_time=target_time,
        )


@pytest.mark.asyncio
async def test_update_booking_atomic_rejects_reschedule_into_full_slot(db_session):
    user = await _create_user(db_session)
    user_id = user.id
    target_date = date(2026, 7, 6)
    await _create_slot(db_session, user_id, target_date, capacity=1)

    booking = await create_booking_atomic(
        db_session,
        user_id=user_id,
        customer_name="First Customer",
        booking_date=target_date,
        booking_time=time(9, 0),
    )
    booking_id = booking.id
    await create_booking_atomic(
        db_session,
        user_id=user_id,
        customer_name="Second Customer",
        booking_date=target_date,
        booking_time=time(9, 30),
    )

    with pytest.raises(BookingSlotFull):
        await update_booking_atomic(
            db_session,
            user_id=user_id,
            booking_id=booking_id,
            updates={"booking_time": time(9, 30)},
        )

    refreshed = await db_session.get(Booking, booking_id)
    assert refreshed.booking_time == time(9, 0)


@pytest.mark.asyncio
async def test_ai_create_booking_tool_uses_atomic_capacity(db_session):
    user = await _create_user(db_session)
    user_id = user.id
    target_date = date(2026, 7, 6)
    target_time = time(9, 0)
    await _create_slot(db_session, user_id, target_date, capacity=1)

    first_result = await _exec_create_booking(
        {
            "customer_name": "First Customer",
            "booking_date": target_date.isoformat(),
            "booking_time": target_time.strftime("%H:%M"),
        },
        user_id,
        None,
        db_session,
    )
    second_result = await _exec_create_booking(
        {
            "customer_name": "Second Customer",
            "booking_date": target_date.isoformat(),
            "booking_time": target_time.strftime("%H:%M"),
        },
        user_id,
        None,
        db_session,
    )

    assert first_result["booked"] is True
    assert second_result == {
        "error": "Sorry, this time slot is already fully booked. Please choose another time."
    }
