"""add_tag_category

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # category groups auto-derived tags: 'environment' | 'role' | 'location' (NULL = manual/ad-hoc tag)
    op.add_column('tags', sa.Column('category', sa.String(length=50), nullable=True))
    op.create_index('ix_tags_category', 'tags', ['category'])


def downgrade() -> None:
    op.drop_index('ix_tags_category', table_name='tags')
    op.drop_column('tags', 'category')
