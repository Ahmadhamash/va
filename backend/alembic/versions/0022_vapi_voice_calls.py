"""vapi voice calls

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vapi_call_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("public_id", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="draft", nullable=False),
        sa.Column("assistant_strategy", sa.String(length=30), server_default="shared", nullable=False),
        sa.Column("assistant_id", sa.String(length=100), nullable=True),
        sa.Column("phone_number_id", sa.String(length=100), nullable=True),
        sa.Column("phone_number", sa.String(length=40), nullable=True),
        sa.Column("webhook_credential_id", sa.String(length=100), nullable=True),
        sa.Column("language", sa.String(length=20), server_default="ar", nullable=False),
        sa.Column("dialect", sa.String(length=80), server_default="Jordanian / Levantine", nullable=False),
        sa.Column("handoff_phone", sa.String(length=40), nullable=True),
        sa.Column("business_hours", sa.Text(), nullable=True),
        sa.Column("model_provider", sa.String(length=40), server_default="openai", nullable=False),
        sa.Column("model_name", sa.String(length=80), server_default="gpt-4o", nullable=False),
        sa.Column("voice_provider", sa.String(length=40), server_default="vapi", nullable=False),
        sa.Column("voice_id", sa.String(length=120), nullable=True),
        sa.Column("recording_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("config", sa.Text(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_vapi_call_settings_assistant_id", "vapi_call_settings", ["assistant_id"])
    op.create_index("ix_vapi_call_settings_phone_number_id", "vapi_call_settings", ["phone_number_id"])

    op.create_table(
        "voice_calls",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("call_setting_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("chat_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("vapi_call_id", sa.String(length=100), nullable=False),
        sa.Column("assistant_id", sa.String(length=100), nullable=True),
        sa.Column("phone_number_id", sa.String(length=100), nullable=True),
        sa.Column("direction", sa.String(length=20), server_default="inbound", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="received", nullable=False),
        sa.Column("customer_phone", sa.String(length=40), nullable=True),
        sa.Column("customer_name", sa.String(length=120), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("ended_reason", sa.String(length=100), nullable=True),
        sa.Column("recording_url", sa.String(length=1000), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("intent", sa.String(length=80), nullable=True),
        sa.Column("sentiment", sa.String(length=40), nullable=True),
        sa.Column("needs_followup", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("order_status", sa.String(length=80), nullable=True),
        sa.Column("structured_data", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("artifact", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["call_setting_id"], ["vapi_call_settings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["chat_session_id"], ["chat_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vapi_call_id"),
    )
    op.create_index("ix_voice_calls_assistant_id", "voice_calls", ["assistant_id"])
    op.create_index("ix_voice_calls_customer_phone", "voice_calls", ["customer_phone"])
    op.create_index("ix_voice_calls_phone_number_id", "voice_calls", ["phone_number_id"])
    op.create_index("ix_voice_calls_status", "voice_calls", ["status"])
    op.create_index("ix_voice_calls_user_created", "voice_calls", ["user_id", "created_at"])

    op.create_table(
        "voice_call_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("voice_call_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("vapi_call_id", sa.String(length=100), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("payload", sa.Text(), server_default="{}", nullable=False),
        sa.Column("received_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["voice_call_id"], ["voice_calls.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voice_call_events_event_type", "voice_call_events", ["event_type"])
    op.create_index("ix_voice_call_events_user_id", "voice_call_events", ["user_id"])
    op.create_index("ix_voice_call_events_vapi_call_id", "voice_call_events", ["vapi_call_id"])

    op.create_table(
        "voice_tool_calls",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("voice_call_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_call_id", sa.String(length=120), nullable=False),
        sa.Column("tool_name", sa.String(length=80), nullable=False),
        sa.Column("arguments", sa.Text(), server_default="{}", nullable=False),
        sa.Column("result", sa.Text(), server_default="{}", nullable=False),
        sa.Column("success", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voice_call_id"], ["voice_calls.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tool_call_id"),
    )
    op.create_index("ix_voice_tool_calls_tool_name", "voice_tool_calls", ["tool_name"])
    op.create_index("ix_voice_tool_calls_user_id", "voice_tool_calls", ["user_id"])

    op.create_table(
        "voice_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("voice_call_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_name", sa.String(length=120), nullable=True),
        sa.Column("phone_number", sa.String(length=40), nullable=False),
        sa.Column("size", sa.String(length=80), nullable=True),
        sa.Column("color", sa.String(length=80), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="new", nullable=False),
        sa.Column("product_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("confirmation_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voice_call_id"], ["voice_calls.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_voice_leads_phone_number", "voice_leads", ["phone_number"])
    op.create_index("ix_voice_leads_status", "voice_leads", ["status"])
    op.create_index("ix_voice_leads_user_created", "voice_leads", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_voice_leads_user_created", table_name="voice_leads")
    op.drop_index("ix_voice_leads_status", table_name="voice_leads")
    op.drop_index("ix_voice_leads_phone_number", table_name="voice_leads")
    op.drop_table("voice_leads")

    op.drop_index("ix_voice_tool_calls_user_id", table_name="voice_tool_calls")
    op.drop_index("ix_voice_tool_calls_tool_name", table_name="voice_tool_calls")
    op.drop_table("voice_tool_calls")

    op.drop_index("ix_voice_call_events_vapi_call_id", table_name="voice_call_events")
    op.drop_index("ix_voice_call_events_user_id", table_name="voice_call_events")
    op.drop_index("ix_voice_call_events_event_type", table_name="voice_call_events")
    op.drop_table("voice_call_events")

    op.drop_index("ix_voice_calls_user_created", table_name="voice_calls")
    op.drop_index("ix_voice_calls_status", table_name="voice_calls")
    op.drop_index("ix_voice_calls_phone_number_id", table_name="voice_calls")
    op.drop_index("ix_voice_calls_customer_phone", table_name="voice_calls")
    op.drop_index("ix_voice_calls_assistant_id", table_name="voice_calls")
    op.drop_table("voice_calls")

    op.drop_index("ix_vapi_call_settings_phone_number_id", table_name="vapi_call_settings")
    op.drop_index("ix_vapi_call_settings_assistant_id", table_name="vapi_call_settings")
    op.drop_table("vapi_call_settings")
