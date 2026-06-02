"""baseline

기존 운영 DB 스키마와 동일한 초기 baseline.
운영 DB에는 이미 5개 테이블이 존재하므로 `alembic stamp 0001_baseline`으로
적용 마킹만 수행한다. 로컬 빈 DB에서는 본 마이그레이션이 실제 테이블을 생성한다.

대상 테이블:
  - players
  - game_sessions
  - player_sessions
  - player_stats_daily
  - hall_of_fame

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # players
    # ------------------------------------------------------------------
    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("pin_hash", sa.String(length=64), nullable=True),
        sa.Column("best_score", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("best_stage", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("best_combo", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("play_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column(
            "tutorial_seen",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_hall_of_famer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("motto", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nickname"),
    )
    op.create_index(
        "ix_players_nickname", "players", ["nickname"], unique=True
    )

    # ------------------------------------------------------------------
    # game_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "game_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("stage", sa.Integer(), nullable=False),
        sa.Column("combo", sa.Integer(), nullable=False),
        sa.Column("stage_scores", JSONB(), nullable=False),
        sa.Column(
            "played_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_game_sessions_nickname_played_at",
        "game_sessions",
        ["nickname", "played_at"],
    )
    op.create_index(
        "ix_game_sessions_played_at", "game_sessions", ["played_at"]
    )

    # ------------------------------------------------------------------
    # player_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "player_sessions",
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index(
        "ix_player_sessions_nickname", "player_sessions", ["nickname"]
    )
    op.create_index(
        "ix_player_sessions_expires_at", "player_sessions", ["expires_at"]
    )

    # ------------------------------------------------------------------
    # player_stats_daily
    # ------------------------------------------------------------------
    op.create_table(
        "player_stats_daily",
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "play_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "sum_score", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "max_score", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "max_stage", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "max_combo", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("nickname", "date"),
    )
    op.create_index(
        "ix_player_stats_daily_date", "player_stats_daily", ["date"]
    )

    # ------------------------------------------------------------------
    # hall_of_fame
    # ------------------------------------------------------------------
    op.create_table(
        "hall_of_fame",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("motto", sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("hall_of_fame")

    op.drop_index("ix_player_stats_daily_date", table_name="player_stats_daily")
    op.drop_table("player_stats_daily")

    op.drop_index("ix_player_sessions_expires_at", table_name="player_sessions")
    op.drop_index("ix_player_sessions_nickname", table_name="player_sessions")
    op.drop_table("player_sessions")

    op.drop_index("ix_game_sessions_played_at", table_name="game_sessions")
    op.drop_index(
        "ix_game_sessions_nickname_played_at", table_name="game_sessions"
    )
    op.drop_table("game_sessions")

    op.drop_index("ix_players_nickname", table_name="players")
    op.drop_table("players")
