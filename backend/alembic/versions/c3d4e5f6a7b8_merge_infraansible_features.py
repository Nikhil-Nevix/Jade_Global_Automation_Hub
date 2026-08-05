"""merge_infraansible_features

Adds the InfraAnsible (VM) features being ported onto the FastAPI base:
  * tickets table (support tickets created from jobs)
  * notification columns: event_type, read_at, channels_sent, expires_at
  * notification_preferences.browser_push_enabled
  * playbook_audit_logs diff columns: playbook_name, old_content, new_content,
    changes_description, ip_address

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-20 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── tickets ──────────────────────────────────────────────────────────────
    # Create the enum types once, then reference them with create_type=False so
    # create_table does not try to emit CREATE TYPE a second time.
    ticket_status = postgresql.ENUM('open', 'in_progress', 'resolved', 'closed', name='ticket_status')
    ticket_priority = postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticket_priority')
    ticket_status.create(op.get_bind(), checkfirst=True)
    ticket_priority.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'tickets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticket_id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', postgresql.ENUM(name='ticket_status', create_type=False), nullable=False, server_default='open'),
        sa.Column('priority', postgresql.ENUM(name='ticket_priority', create_type=False), nullable=False, server_default='medium'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_tickets_ticket_id', 'tickets', ['ticket_id'], unique=True)
    op.create_index('ix_tickets_job_id', 'tickets', ['job_id'])
    op.create_index('ix_tickets_created_by', 'tickets', ['created_by'])
    op.create_index('ix_tickets_status', 'tickets', ['status'])

    # ── notifications ────────────────────────────────────────────────────────
    op.add_column('notifications', sa.Column('event_type', sa.String(length=50), nullable=True))
    op.add_column('notifications', sa.Column('read_at', sa.DateTime(), nullable=True))
    op.add_column('notifications', sa.Column('channels_sent', sa.JSON(), nullable=True))
    op.add_column('notifications', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.create_index('ix_notifications_event_type', 'notifications', ['event_type'])

    # ── notification_preferences ─────────────────────────────────────────────
    op.add_column(
        'notification_preferences',
        sa.Column('browser_push_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # ── playbook_audit_logs ──────────────────────────────────────────────────
    op.add_column('playbook_audit_logs', sa.Column('playbook_name', sa.String(length=255), nullable=True))
    op.add_column('playbook_audit_logs', sa.Column('old_content', sa.Text(), nullable=True))
    op.add_column('playbook_audit_logs', sa.Column('new_content', sa.Text(), nullable=True))
    op.add_column('playbook_audit_logs', sa.Column('changes_description', sa.Text(), nullable=True))
    op.add_column('playbook_audit_logs', sa.Column('ip_address', sa.String(length=45), nullable=True))


def downgrade() -> None:
    op.drop_column('playbook_audit_logs', 'ip_address')
    op.drop_column('playbook_audit_logs', 'changes_description')
    op.drop_column('playbook_audit_logs', 'new_content')
    op.drop_column('playbook_audit_logs', 'old_content')
    op.drop_column('playbook_audit_logs', 'playbook_name')

    op.drop_column('notification_preferences', 'browser_push_enabled')

    op.drop_index('ix_notifications_event_type', table_name='notifications')
    op.drop_column('notifications', 'expires_at')
    op.drop_column('notifications', 'channels_sent')
    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'event_type')

    op.drop_index('ix_tickets_status', table_name='tickets')
    op.drop_index('ix_tickets_created_by', table_name='tickets')
    op.drop_index('ix_tickets_job_id', table_name='tickets')
    op.drop_index('ix_tickets_ticket_id', table_name='tickets')
    op.drop_table('tickets')

    sa.Enum(name='ticket_priority').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='ticket_status').drop(op.get_bind(), checkfirst=True)
