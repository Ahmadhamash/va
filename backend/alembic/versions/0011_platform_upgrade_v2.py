"""platform_upgrade_v2: voice, handoff, verification, automation, audit

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-23 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: add updated_at column ──
    op.add_column('users', sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True))

    # ── voice_settings ──
    op.create_table(
        'voice_settings',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('voice_mode', sa.String(30), server_default='off', nullable=False),
        sa.Column('fallback_to_text', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('max_audio_duration_seconds', sa.Integer(), server_default='120', nullable=False),
        sa.Column('preferred_voice', sa.String(50), server_default='nova', nullable=False),
        sa.Column('stt_provider', sa.String(30), server_default='openai', nullable=False),
        sa.Column('tts_provider', sa.String(30), server_default='openai', nullable=False),
        sa.Column('audio_format', sa.String(10), server_default='mp3', nullable=False),
        sa.Column('speech_speed', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('voice_personality', sa.String(30), server_default='friendly', nullable=False),
        sa.Column('stt_config', JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('tts_config', JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_voice_settings_user_id', 'voice_settings', ['user_id'])

    # ── ai_persona_settings ──
    op.create_table(
        'ai_persona_settings',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('dialect', sa.String(20), server_default='jordanian', nullable=False),
        sa.Column('tone', sa.String(20), server_default='friendly', nullable=False),
        sa.Column('emoji_level', sa.String(10), server_default='low', nullable=False),
        sa.Column('banned_phrases', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('custom_safe_responses', JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('personality_name', sa.String(50), server_default='مساعد', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_ai_persona_settings_user_id', 'ai_persona_settings', ['user_id'])

    # ── ai_verification_logs ──
    op.create_table(
        'ai_verification_logs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_message', sa.Text(), nullable=False),
        sa.Column('retrieved_data', JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('draft_answer', sa.Text(), nullable=False),
        sa.Column('verifier_status', sa.String(40), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('reasons', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('flagged_claims', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('grounding_data_used', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('final_action', sa.String(30), nullable=False),
        sa.Column('final_answer', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_verification_logs_session_id', 'ai_verification_logs', ['session_id'])
    op.create_index('ix_ai_verification_logs_user_id', 'ai_verification_logs', ['user_id'])
    op.create_index('ix_ai_verification_logs_verifier_status', 'ai_verification_logs', ['verifier_status'])

    # ── message_delivery_logs ──
    op.create_table(
        'message_delivery_logs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', UUID(as_uuid=True), nullable=True),
        sa.Column('channel', sa.String(20), nullable=False),
        sa.Column('delivery_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(30), server_default='pending', nullable=False),
        sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('meta_message_id', sa.String(100), nullable=True),
        sa.Column('meta_response', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_payload', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_message_delivery_logs_message_id', 'message_delivery_logs', ['message_id'])
    op.create_index('ix_message_delivery_logs_session_id', 'message_delivery_logs', ['session_id'])
    op.create_index('ix_message_delivery_logs_status', 'message_delivery_logs', ['status'])

    # ── product_candidates ──
    op.create_table(
        'product_candidates',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('source_type', sa.String(30), nullable=False),
        sa.Column('raw_media_url', sa.Text(), nullable=True),
        sa.Column('image_analysis_result', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ocr_result', sa.Text(), nullable=True),
        sa.Column('detected_category', sa.String(100), nullable=True),
        sa.Column('detected_attributes', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('matched_item_id', UUID(as_uuid=True), nullable=True),
        sa.Column('confidence_score', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('match_type', sa.String(20), server_default='no_match', nullable=False),
        sa.Column('human_review_needed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('human_review_result', sa.String(30), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['matched_item_id'], ['items.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_candidates_session_id', 'product_candidates', ['session_id'])

    # ── social_post_mappings ──
    op.create_table(
        'social_post_mappings',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('platform', sa.String(20), nullable=False),
        sa.Column('post_id', sa.String(100), nullable=False),
        sa.Column('post_url', sa.Text(), nullable=False),
        sa.Column('mapped_item_id', UUID(as_uuid=True), nullable=True),
        sa.Column('post_metadata', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mapped_item_id'], ['items.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_social_post_mappings_user_id', 'social_post_mappings', ['user_id'])

    # ── platform_support_agents ──
    op.create_table(
        'platform_support_agents',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('is_available', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('max_concurrent_handoffs', sa.Integer(), server_default='10', nullable=False),
        sa.Column('assigned_businesses', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('skills', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_platform_support_agents_user_id', 'platform_support_agents', ['user_id'])

    # ── handoff_sessions ──
    op.create_table(
        'handoff_sessions',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(100), nullable=False),
        sa.Column('reason_details', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(10), server_default='normal', nullable=False),
        sa.Column('status', sa.String(30), server_default='unassigned', nullable=False),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('ai_suggested_reply', sa.Text(), nullable=True),
        sa.Column('verification_log_id', UUID(as_uuid=True), nullable=True),
        sa.Column('sla_deadline', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verification_log_id'], ['ai_verification_logs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_handoff_sessions_session_id', 'handoff_sessions', ['session_id'])
    op.create_index('ix_handoff_sessions_user_id', 'handoff_sessions', ['user_id'])
    op.create_index('ix_handoff_sessions_status', 'handoff_sessions', ['status'])

    # ── handoff_assignments ──
    op.create_table(
        'handoff_assignments',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('handoff_session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('assignment_method', sa.String(20), server_default='manual', nullable=False),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['handoff_session_id'], ['handoff_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['agent_id'], ['platform_support_agents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_handoff_assignments_handoff_session_id', 'handoff_assignments', ['handoff_session_id'])
    op.create_index('ix_handoff_assignments_agent_id', 'handoff_assignments', ['agent_id'])

    # ── automation_rules ──
    op.create_table(
        'automation_rules',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('trigger_config', JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('conditions', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('actions', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('variables_used', JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('priority', sa.Integer(), server_default='0', nullable=False),
        sa.Column('prevent_loops', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('max_executions_per_conversation', sa.Integer(), server_default='3', nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('template_id', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_automation_rules_user_id', 'automation_rules', ['user_id'])

    # ── automation_runs ──
    op.create_table(
        'automation_runs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('rule_id', UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', UUID(as_uuid=True), nullable=True),
        sa.Column('message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('trigger_matched', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('conditions_matched', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('conditions_evaluation', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('actions_executed', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(20), server_default='success', nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['rule_id'], ['automation_rules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_automation_runs_rule_id', 'automation_runs', ['rule_id'])

    # ── automation_logs ──
    op.create_table(
        'automation_logs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('run_id', UUID(as_uuid=True), nullable=False),
        sa.Column('step', sa.String(50), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('level', sa.String(10), server_default='info', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['automation_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_automation_logs_run_id', 'automation_logs', ['run_id'])

    # ── audit_logs ──
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=True),
        sa.Column('details', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

    # ── media_attachments ──
    op.create_table(
        'media_attachments',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('message_id', UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', UUID(as_uuid=True), nullable=True),
        sa.Column('channel', sa.String(20), nullable=False),
        sa.Column('media_type', sa.String(20), nullable=False),
        sa.Column('original_url', sa.Text(), nullable=True),
        sa.Column('stored_path', sa.Text(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('transcription', sa.Text(), nullable=True),
        sa.Column('metadata_extra', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_media_attachments_message_id', 'media_attachments', ['message_id'])


def downgrade() -> None:
    op.drop_table('media_attachments')
    op.drop_table('audit_logs')
    op.drop_table('automation_logs')
    op.drop_table('automation_runs')
    op.drop_table('automation_rules')
    op.drop_table('handoff_assignments')
    op.drop_table('handoff_sessions')
    op.drop_table('platform_support_agents')
    op.drop_table('social_post_mappings')
    op.drop_table('product_candidates')
    op.drop_table('message_delivery_logs')
    op.drop_table('ai_verification_logs')
    op.drop_table('ai_persona_settings')
    op.drop_table('voice_settings')
    op.drop_column('users', 'updated_at')
