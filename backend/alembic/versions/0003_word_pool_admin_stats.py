"""word pool admin stats tables

Revision ID: 0003_word_pool_admin_stats
Revises: 0002_bigint_unification
Create Date: 2026-06-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0003_word_pool_admin_stats"
down_revision: Union[str, None] = "0002_bigint_unification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) words
    op.create_table(
        "words",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("word", sa.String(20), nullable=False),
        sa.Column("difficulty_level", sa.Integer(), nullable=False),
        sa.Column("bpm", sa.Integer(), nullable=False),
        sa.Column("input_length", sa.Integer(), nullable=False),
        sa.Column("valid_syllables", JSONB(), nullable=False),
        sa.Column("invalid_syllables", JSONB(), nullable=False),
        sa.Column("input_syllables", JSONB(), nullable=False),
        sa.Column("key_mapping", JSONB(), nullable=False),
        sa.Column("fixed_stage", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("difficulty_level BETWEEN 1 AND 5", name="ck_words_difficulty_range"),
        sa.UniqueConstraint("word"),
        sa.UniqueConstraint("fixed_stage", name="uq_words_fixed_stage"),
    )
    op.create_index("idx_words_active_diff", "words", ["is_active", "difficulty_level"])

    # 2) admins (self-FK)
    op.create_table(
        "admins",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(32), nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "created_by",
            sa.BigInteger(),
            sa.ForeignKey("admins.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint("username"),
    )

    # 3) admin_sessions -> admins
    op.create_table(
        "admin_sessions",
        sa.Column("token", sa.String(64), primary_key=True),
        sa.Column(
            "admin_id",
            sa.BigInteger(),
            sa.ForeignKey("admins.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_admin_sessions_expires", "admin_sessions", ["expires_at"])

    # 4) word_stats -> players, words
    op.create_table(
        "word_stats",
        sa.Column(
            "player_id",
            sa.BigInteger(),
            sa.ForeignKey("players.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "word_id",
            sa.BigInteger(),
            sa.ForeignKey("words.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("exposure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("perfect_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("good_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("miss_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_played_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_word_stats_word", "word_stats", ["word_id"])

    # 5) session_word_results -> game_sessions, words
    op.create_table(
        "session_word_results",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.BigInteger(),
            sa.ForeignKey("game_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "word_id",
            sa.BigInteger(),
            sa.ForeignKey("words.id"),
            nullable=False,
        ),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("perfect_count", sa.Integer(), nullable=False),
        sa.Column("good_count", sa.Integer(), nullable=False),
        sa.Column("miss_count", sa.Integer(), nullable=False),
        sa.Column("stage_score", sa.Integer(), nullable=False),
        sa.Column("played_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_swr_word", "session_word_results", ["word_id"])
    op.create_index("idx_swr_session", "session_word_results", ["session_id"])


def downgrade() -> None:
    op.drop_index("idx_swr_session", table_name="session_word_results")
    op.drop_index("idx_swr_word", table_name="session_word_results")
    op.drop_table("session_word_results")

    op.drop_index("idx_word_stats_word", table_name="word_stats")
    op.drop_table("word_stats")

    op.drop_index("idx_admin_sessions_expires", table_name="admin_sessions")
    op.drop_table("admin_sessions")

    op.drop_table("admins")

    op.drop_index("idx_words_active_diff", table_name="words")
    op.drop_table("words")
