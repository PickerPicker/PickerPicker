"""src.models.game_session
플레이 1회당 1행. 30일 보존.
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    combo: Mapped[int] = mapped_column(Integer, nullable=False)
    # {"1": 1200, "2": 950, ...} — 스테이지별 점수
    stage_scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    played_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_game_sessions_nickname_played_at", "nickname", "played_at"),
        Index("ix_game_sessions_played_at", "played_at"),
    )
