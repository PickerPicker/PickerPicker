"""players.best_score 인덱스 추가

Revision ID: 0006_players_best_score_index
Revises: 0005_pin_hash_bcrypt
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006_players_best_score_index"
down_revision: Union[str, None] = "0005_pin_hash_bcrypt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 랭킹 조회(ORDER BY best_score DESC LIMIT)와 백분위 계산(WHERE best_score < X)이
    # 매번 full scan + sort를 유발했다. 내림차순 인덱스로 정렬 자체를 없앤다.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_players_best_score_desc "
        "ON players (best_score DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_players_best_score_desc")
