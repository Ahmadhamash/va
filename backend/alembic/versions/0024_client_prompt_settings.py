"""client prompt settings

Revision ID: 0024
Revises: 0023
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_prompt_settings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sales_prompt", sa.Text(), nullable=True),
        sa.Column("support_prompt", sa.Text(), nullable=True),
        sa.Column("booking_prompt", sa.Text(), nullable=True),
        sa.Column("general_prompt", sa.Text(), nullable=True),
        sa.Column("humanizer_prompt", sa.Text(), nullable=True),
        sa.Column("voice_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_client_prompt_settings_user_id",
        "client_prompt_settings",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_client_prompt_settings_user_id", table_name="client_prompt_settings")
    op.drop_table("client_prompt_settings")
