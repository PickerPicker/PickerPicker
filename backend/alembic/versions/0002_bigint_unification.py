"""bigint unification

Revision ID: 0002_bigint_unification
Revises: 0001_baseline
Create Date: 2026-06-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_bigint_unification"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # players.id : Integer -> BigInteger
    op.execute("ALTER TABLE players ALTER COLUMN id TYPE BIGINT USING id::bigint")
    op.execute("ALTER SEQUENCE players_id_seq AS BIGINT")

    # hall_of_fame.id : Integer -> BigInteger
    op.execute("ALTER TABLE hall_of_fame ALTER COLUMN id TYPE BIGINT USING id::bigint")
    op.execute("ALTER SEQUENCE hall_of_fame_id_seq AS BIGINT")


def downgrade() -> None:
    op.execute("ALTER TABLE hall_of_fame ALTER COLUMN id TYPE INTEGER USING id::integer")
    op.execute("ALTER SEQUENCE hall_of_fame_id_seq AS INTEGER")
    op.execute("ALTER TABLE players ALTER COLUMN id TYPE INTEGER USING id::integer")
    op.execute("ALTER SEQUENCE players_id_seq AS INTEGER")
