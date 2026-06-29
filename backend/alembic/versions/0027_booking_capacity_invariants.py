"""booking capacity invariants

Revision ID: 0027
Revises: 0026
Create Date: 2026-06-29
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "check_time_slots_day_of_week",
        "time_slots",
        "day_of_week >= 0 AND day_of_week <= 6",
    )
    op.create_check_constraint(
        "check_time_slots_time_range",
        "time_slots",
        "end_time > start_time",
    )
    op.create_check_constraint(
        "check_time_slots_duration_positive",
        "time_slots",
        "slot_duration_minutes > 0",
    )
    op.create_check_constraint(
        "check_time_slots_capacity_positive",
        "time_slots",
        "max_bookings_per_slot > 0",
    )
    op.create_index(
        "idx_time_slots_user_day_active",
        "time_slots",
        ["user_id", "day_of_week", "is_active"],
    )

    op.create_check_constraint(
        "check_bookings_status",
        "bookings",
        "status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed')",
    )
    op.create_index(
        "idx_bookings_user_date_time_status",
        "bookings",
        ["user_id", "booking_date", "booking_time", "status"],
    )


def downgrade() -> None:
    op.drop_index("idx_bookings_user_date_time_status", table_name="bookings")
    op.drop_constraint("check_bookings_status", "bookings", type_="check")

    op.drop_index("idx_time_slots_user_day_active", table_name="time_slots")
    op.drop_constraint("check_time_slots_capacity_positive", "time_slots", type_="check")
    op.drop_constraint("check_time_slots_duration_positive", "time_slots", type_="check")
    op.drop_constraint("check_time_slots_time_range", "time_slots", type_="check")
    op.drop_constraint("check_time_slots_day_of_week", "time_slots", type_="check")
