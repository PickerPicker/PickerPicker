"""src.models.word_stats
player × word 단위 누적 통계. UPSERT 대상.
"""
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class WordStats(Base):
    __tablename__ = "word_stats"

    player_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    word_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
    exposure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    perfect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    good_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_played_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_word_stats_word", "word_id"),
    )
