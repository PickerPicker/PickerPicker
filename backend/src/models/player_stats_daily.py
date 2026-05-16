"""src.models.player_stats_daily
일별 집계 영구 보존. (nickname, date) 복합 PK.
"""
from datetime import datetime, date
from sqlalchemy import String, Integer, BigInteger, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class PlayerStatsDaily(Base):
    __tablename__ = "player_stats_daily"

    nickname: Mapped[str] = mapped_column(String(50), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True, index=True)

    play_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sum_score: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_stage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_combo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
