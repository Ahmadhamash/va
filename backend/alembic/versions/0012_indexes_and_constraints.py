"""add indexes and constraints

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-23 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add CHECK constraints
    op.create_check_constraint('check_item_price_positive', 'items', 'price >= 0')
    op.create_check_constraint('check_offer_discount_positive', 'offers', 'discount_value >= 0')
    op.create_check_constraint('check_package_price_positive', 'packages', 'price >= 0')
    op.create_check_constraint('check_user_credit_positive', 'users', 'ai_credit_balance >= 0')

    # 2. Add Composite Indexes
    op.create_index('idx_chat_session_user_channel', 'chat_sessions', ['user_id', 'channel'])
    op.create_index('idx_message_session_created', 'messages', ['session_id', 'created_at'])
    op.create_index('idx_ai_verification_log_session_status', 'ai_verification_logs', ['session_id', 'verifier_status'])

    # 3. Add individual foreign key indexes missing in some tables
    op.create_index(op.f('ix_ai_verification_logs_message_id'), 'ai_verification_logs', ['message_id'], unique=False)

    op.create_index(op.f('ix_automation_runs_session_id'), 'automation_runs', ['session_id'], unique=False)
    op.create_index(op.f('ix_automation_runs_message_id'), 'automation_runs', ['message_id'], unique=False)
    op.create_index(op.f('ix_bookings_session_id'), 'bookings', ['session_id'], unique=False)
    op.create_index(op.f('ix_message_delivery_logs_session_id'), 'message_delivery_logs', ['session_id'], unique=False)
    op.create_index(op.f('ix_message_delivery_logs_message_id'), 'message_delivery_logs', ['message_id'], unique=False)
    op.create_index(op.f('ix_escalations_session_id'), 'escalations', ['session_id'], unique=False)
    op.create_index(op.f('ix_handoff_sessions_session_id'), 'handoff_sessions', ['session_id'], unique=False)
    op.create_index(op.f('ix_handoff_assignments_handoff_session_id'), 'handoff_assignments', ['handoff_session_id'], unique=False)
    op.create_index(op.f('ix_product_candidates_session_id'), 'product_candidates', ['session_id'], unique=False)
    op.create_index(op.f('ix_product_candidates_message_id'), 'product_candidates', ['message_id'], unique=False)

def downgrade() -> None:
    # 3. Drop individual foreign key indexes
    op.drop_index(op.f('ix_product_candidates_message_id'), table_name='product_candidates')
    op.drop_index(op.f('ix_product_candidates_session_id'), table_name='product_candidates')
    op.drop_index(op.f('ix_handoff_assignments_handoff_session_id'), table_name='handoff_assignments')
    op.drop_index(op.f('ix_handoff_sessions_session_id'), table_name='handoff_sessions')
    op.drop_index(op.f('ix_escalations_session_id'), table_name='escalations')
    op.drop_index(op.f('ix_message_delivery_logs_message_id'), table_name='message_delivery_logs')
    op.drop_index(op.f('ix_message_delivery_logs_session_id'), table_name='message_delivery_logs')
    op.drop_index(op.f('ix_bookings_session_id'), table_name='bookings')
    op.drop_index(op.f('ix_automation_runs_message_id'), table_name='automation_runs')
    op.drop_index(op.f('ix_automation_runs_session_id'), table_name='automation_runs')

    op.drop_index(op.f('ix_ai_verification_logs_message_id'), table_name='ai_verification_logs')

    # 2. Drop Composite Indexes
    op.drop_index('idx_ai_verification_log_session_status', table_name='ai_verification_logs')
    op.drop_index('idx_message_session_created', table_name='messages')
    op.drop_index('idx_chat_session_user_channel', table_name='chat_sessions')

    # 1. Drop CHECK constraints
    op.drop_constraint('check_user_credit_positive', 'users', type_='check')
    op.drop_constraint('check_package_price_positive', 'packages', type_='check')
    op.drop_constraint('check_offer_discount_positive', 'offers', type_='check')
    op.drop_constraint('check_item_price_positive', 'items', type_='check')
