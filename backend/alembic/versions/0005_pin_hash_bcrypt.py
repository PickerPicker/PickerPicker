"""pin_hash 컬럼 확장 (bcrypt 대응)

Revision ID: 0005_pin_hash_bcrypt
Revises: 0004_player_stats_public
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005_pin_hash_bcrypt"
down_revision: Union[str, None] = "0004_player_stats_public"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SHA-256 hex(64자) 기준으로 잡혀 있던 폭을 넓힌다.
    # bcrypt 해시는 60자라 당장은 들어가지만, 알고리즘/파라미터가 바뀌면 넘칠 수 있다.
    # 기존 SHA-256 해시는 로그인 성공 시점에 bcrypt로 재해싱된다 (player_service.verify_pin).
    op.execute("ALTER TABLE players ALTER COLUMN pin_hash TYPE VARCHAR(255)")


def downgrade() -> None:
    # bcrypt 해시(60자)는 64자에 들어가므로 축소해도 데이터 손실은 없다.
    op.execute("ALTER TABLE players ALTER COLUMN pin_hash TYPE VARCHAR(64)")
