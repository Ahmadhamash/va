"""app_settings + messages.processed

Revision ID: 0003_settings_processed
Revises: 0002_rbac_channels_style
Create Date: 2026-05-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_settings_processed"
down_revision: Union[str, None] = "0002_rbac_channels_style"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "processed",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.create_index("ix_messages_processed", "messages", ["processed"])

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("openai_api_key", sa.Text(), nullable=True),
        sa.Column(
            "ai_model", sa.String(length=50), server_default="gpt-4o", nullable=False
        ),
        sa.Column(
            "debounce_seconds", sa.Integer(), server_default="8", nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO app_settings (id, ai_model, debounce_seconds) "
        "VALUES (1, 'gpt-4o', 8)"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_index("ix_messages_processed", "messages")
    op.drop_column("messages", "processed")
