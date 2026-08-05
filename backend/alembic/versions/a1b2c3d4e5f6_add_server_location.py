"""add_server_location

Revision ID: a1b2c3d4e5f6
Revises: 86b13a6cc72e
Create Date: 2026-07-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '86b13a6cc72e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('servers', sa.Column('location', sa.String(length=100), nullable=True))
    op.create_index('ix_servers_location', 'servers', ['location'])


def downgrade() -> None:
    op.drop_index('ix_servers_location', table_name='servers')
    op.drop_column('servers', 'location')
