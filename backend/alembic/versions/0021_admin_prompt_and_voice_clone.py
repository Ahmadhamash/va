"""admin prompt and voice settings text

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column("master_system_prompt", sa.Text(), server_default="", nullable=False),
    )
    op.alter_column(
        "voice_settings",
        "voice_personality",
        type_=sa.Text(),
        existing_type=sa.String(length=30),
        existing_server_default="friendly",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "voice_settings",
        "voice_personality",
        type_=sa.String(length=30),
        existing_type=sa.Text(),
        existing_server_default="friendly",
        existing_nullable=False,
    )
    op.drop_column("app_settings", "master_system_prompt")
