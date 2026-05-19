"""add is_escalated flag to chat_sessions

Revision ID: 0006_session_escalation
Revises: 0005_business_features
Create Date: 2026-05-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_session_escalation"
down_revision: Union[str, None] = "0005_business_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column(
            "is_escalated",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("chat_sessions", "is_escalated")
