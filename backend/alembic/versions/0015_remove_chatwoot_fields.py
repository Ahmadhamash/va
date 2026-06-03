"""remove chatwoot fields

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-04 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "chatwoot_user_token")
    op.drop_column("users", "chatwoot_account_id")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("chatwoot_account_id", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("chatwoot_user_token", sa.String(length=255), nullable=True),
    )
