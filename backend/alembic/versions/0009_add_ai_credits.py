"""add_ai_credits_and_email_verification

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-22 14:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('users', sa.Column('ai_credit_balance', sa.Integer(), server_default='1000', nullable=False))
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False))

def downgrade() -> None:
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'ai_credit_balance')
