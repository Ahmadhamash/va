"""encrypt voice settings configs

Revision ID: 0019_encrypt_voice_settings_configs
Revises: 0018_user_ai_auto_reply_enabled
Create Date: 2026-06-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0019_encrypt_voice_settings_configs"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "voice_settings",
        "stt_config",
        type_=sa.Text(),
        existing_type=postgresql.JSONB(),
        postgresql_using="stt_config::text",
        existing_server_default=sa.text("'{}'::jsonb"),
    )
    op.alter_column(
        "voice_settings",
        "tts_config",
        type_=sa.Text(),
        existing_type=postgresql.JSONB(),
        postgresql_using="tts_config::text",
        existing_server_default=sa.text("'{}'::jsonb"),
    )
    op.alter_column("voice_settings", "stt_config", server_default="{}")
    op.alter_column("voice_settings", "tts_config", server_default="{}")


def downgrade() -> None:
    op.alter_column(
        "voice_settings",
        "stt_config",
        type_=postgresql.JSONB(),
        existing_type=sa.Text(),
        postgresql_using="'{}'::jsonb",
        server_default=sa.text("'{}'::jsonb"),
    )
    op.alter_column(
        "voice_settings",
        "tts_config",
        type_=postgresql.JSONB(),
        existing_type=sa.Text(),
        postgresql_using="'{}'::jsonb",
        server_default=sa.text("'{}'::jsonb"),
    )
