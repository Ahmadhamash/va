"""client prompt versions

Revision ID: 0026
Revises: 0025
Create Date: 2026-06-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_prompt_versions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("prompt_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("test_status", sa.String(length=20), nullable=False),
        sa.Column("test_report", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("activated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_client_prompt_versions_user_id",
        "client_prompt_versions",
        ["user_id"],
    )
    op.create_index(
        "ix_client_prompt_versions_user_status",
        "client_prompt_versions",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_client_prompt_versions_user_version",
        "client_prompt_versions",
        ["user_id", "version_number"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_client_prompt_versions_user_version",
        table_name="client_prompt_versions",
    )
    op.drop_index(
        "ix_client_prompt_versions_user_status",
        table_name="client_prompt_versions",
    )
    op.drop_index(
        "ix_client_prompt_versions_user_id",
        table_name="client_prompt_versions",
    )
    op.drop_table("client_prompt_versions")
