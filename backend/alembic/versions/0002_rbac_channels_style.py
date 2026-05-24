"""rbac, channels, style samples

Revision ID: 0002_rbac_channels_style
Revises: 0001_initial
Create Date: 2026-05-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_rbac_channels_style"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users.role
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=20),
            server_default="client",
            nullable=False,
        ),
    )
    op.create_index("ix_users_role", "users", ["role"])

    # chat_sessions: channel + external_user_id
    op.add_column(
        "chat_sessions",
        sa.Column(
            "channel",
            sa.String(length=20),
            server_default="web",
            nullable=False,
        ),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("external_user_id", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_chat_sessions_channel", "chat_sessions", ["channel"])
    op.create_index(
        "ix_chat_sessions_external_user_id",
        "chat_sessions",
        ["external_user_id"],
    )

    # style_samples
    op.create_table(
        "style_samples",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="upload"),
        sa.Column("sample", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_style_samples_user_id", "style_samples", ["user_id"])

    # channel_integrations
    op.create_table(
        "channel_integrations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("public_id", sa.String(length=64), nullable=False),
        sa.Column(
            "credentials",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id"),
    )
    op.create_index(
        "ix_channel_integrations_user_id", "channel_integrations", ["user_id"]
    )
    op.create_index(
        "ix_channel_integrations_platform", "channel_integrations", ["platform"]
    )
    op.create_index(
        "ix_channel_integrations_public_id",
        "channel_integrations",
        ["public_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("channel_integrations")
    op.drop_table("style_samples")
    op.drop_index("ix_chat_sessions_external_user_id", "chat_sessions")
    op.drop_index("ix_chat_sessions_channel", "chat_sessions")
    op.drop_column("chat_sessions", "external_user_id")
    op.drop_column("chat_sessions", "channel")
    op.drop_index("ix_users_role", "users")
    op.drop_column("users", "role")
