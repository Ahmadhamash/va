"""user ai auto reply enabled

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "ai_auto_reply_enabled",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "ai_auto_reply_enabled")
