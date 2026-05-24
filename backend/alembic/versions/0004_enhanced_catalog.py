"""variants, delivery, warranty, stock, escalations

Revision ID: 0004_enhanced_catalog
Revises: 0003_settings_processed
Create Date: 2026-05-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_enhanced_catalog"
down_revision: Union[str, None] = "0003_settings_processed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Item: warranty + stock columns ───────────────────────────────────
    op.add_column(
        "items",
        sa.Column("warranty_duration", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("warranty_terms", sa.Text(), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("warranty_coverage", sa.Text(), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("warranty_exclusions", sa.Text(), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("stock_quantity", sa.Integer(), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column(
            "stock_status",
            sa.String(length=30),
            server_default="in_stock",
            nullable=False,
        ),
    )

    # ─── item_variants table ──────────────────────────────────────────────
    op.create_table(
        "item_variants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("option_type", sa.String(length=50), nullable=False),
        sa.Column("option_value", sa.String(length=100), nullable=False),
        sa.Column("price_override", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "available",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("stock_quantity", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_item_variants_item_id", "item_variants", ["item_id"])

    # ─── delivery_rules table ─────────────────────────────────────────────
    op.create_table(
        "delivery_rules",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("zone_name", sa.String(length=100), nullable=False),
        sa.Column(
            "delivery_fee", sa.Numeric(precision=10, scale=2), nullable=False
        ),
        sa.Column(
            "currency",
            sa.String(length=10),
            server_default="JOD",
            nullable=False,
        ),
        sa.Column(
            "free_above", sa.Numeric(precision=10, scale=2), nullable=True
        ),
        sa.Column("estimated_days", sa.String(length=50), nullable=True),
        sa.Column(
            "pickup_available",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_delivery_rules_user_id", "delivery_rules", ["user_id"])

    # ─── escalations table ────────────────────────────────────────────────
    op.create_table(
        "escalations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("handled_at", sa.DateTime(), nullable=True),
        sa.Column("handler_notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["chat_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_escalations_user_id", "escalations", ["user_id"])
    op.create_index("ix_escalations_session_id", "escalations", ["session_id"])
    op.create_index("ix_escalations_status", "escalations", ["status"])


def downgrade() -> None:
    op.drop_table("escalations")
    op.drop_table("delivery_rules")
    op.drop_table("item_variants")
    op.drop_column("items", "stock_status")
    op.drop_column("items", "stock_quantity")
    op.drop_column("items", "warranty_exclusions")
    op.drop_column("items", "warranty_coverage")
    op.drop_column("items", "warranty_terms")
    op.drop_column("items", "warranty_duration")
