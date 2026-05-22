"""encrypt_credentials

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-22 13:50:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alter JSONB to Text for channel_integrations.credentials to support encrypted strings
    op.execute("ALTER TABLE channel_integrations ALTER COLUMN credentials TYPE text USING credentials::text")
    
    # We rely on the fallback mechanism in crypto.py to handle existing plaintext data
    # (it tries to decrypt, and if it fails, reads as plaintext).
    # Data will be encrypted upon next save.


def downgrade() -> None:
    # Alter Text back to JSONB
    op.execute("ALTER TABLE channel_integrations ALTER COLUMN credentials TYPE jsonb USING credentials::jsonb")
