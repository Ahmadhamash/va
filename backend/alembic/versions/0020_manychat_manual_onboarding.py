"""manychat manual onboarding

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "manychat_setup_status",
            sa.String(length=30),
            server_default="not_started",
            nullable=False,
        ),
    )
    op.add_column("users", sa.Column("fb_page_link", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("ig_username", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("wa_number", sa.String(length=40), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "manychat_admin_confirmed",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("manychat_setup_submitted_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("manychat_setup_completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_users_manychat_setup_status",
        "users",
        ["manychat_setup_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_manychat_setup_status", table_name="users")
    op.drop_column("users", "manychat_setup_completed_at")
    op.drop_column("users", "manychat_setup_submitted_at")
    op.drop_column("users", "manychat_admin_confirmed")
    op.drop_column("users", "wa_number")
    op.drop_column("users", "ig_username")
    op.drop_column("users", "fb_page_link")
    op.drop_column("users", "manychat_setup_status")
