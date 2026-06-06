"""add ai_trace to verification logs

Revision ID: 0016_add_ai_trace_to_verification_logs
Revises: 0015_remove_chatwoot_fields
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0016_add_ai_trace_to_verification_logs"
down_revision = "0015_remove_chatwoot_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_verification_logs",
        sa.Column(
            "ai_trace",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("ai_verification_logs", "ai_trace")
