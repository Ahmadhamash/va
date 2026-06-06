"""chat session metadata and external identity index

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    first_value(id) OVER (
                        PARTITION BY user_id, channel, external_user_id
                        ORDER BY created_at ASC, id ASC
                    ) AS keep_id,
                    row_number() OVER (
                        PARTITION BY user_id, channel, external_user_id
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM chat_sessions
                WHERE external_user_id IS NOT NULL
            ),
            dupes AS (
                SELECT id, keep_id
                FROM ranked
                WHERE rn > 1
            )
            UPDATE messages AS m
            SET session_id = dupes.keep_id
            FROM dupes
            WHERE m.session_id = dupes.id
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    row_number() OVER (
                        PARTITION BY user_id, channel, external_user_id
                        ORDER BY created_at ASC, id ASC
                    ) AS rn
                FROM chat_sessions
                WHERE external_user_id IS NOT NULL
            )
            DELETE FROM chat_sessions AS c
            USING ranked
            WHERE c.id = ranked.id
              AND ranked.rn > 1
            """
        )
    )
    op.create_index(
        "uq_chat_session_external_identity",
        "chat_sessions",
        ["user_id", "channel", "external_user_id"],
        unique=True,
        postgresql_where=sa.text("external_user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_chat_session_external_identity", table_name="chat_sessions")
    op.drop_column("chat_sessions", "metadata")
