"""add chatwoot fields

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-28 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('chatwoot_account_id', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('chatwoot_user_token', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'chatwoot_account_id')
    op.drop_column('users', 'chatwoot_user_token')
