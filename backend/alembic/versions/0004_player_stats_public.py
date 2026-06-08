"""player is_stats_public

Revision ID: 0004_player_stats_public
Revises: 0003_word_pool_admin_stats
Create Date: 2026-06-08
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004_player_stats_public"
down_revision: Union[str, None] = "0003_word_pool_admin_stats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 통계 공개 여부 컬럼. 기존 플레이어는 전원 공개(TRUE)로 시작.
    # IF NOT EXISTS — 재실행/수동 추가 환경에서도 안전.
    op.execute(
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS is_stats_public "
        "BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE players DROP COLUMN IF EXISTS is_stats_public")
