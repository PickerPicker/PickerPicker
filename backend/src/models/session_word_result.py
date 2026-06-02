"""src.models.session_word_result
세션별 stage별 raw 결과. 시계열 분석용.
"""
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class SessionWordResult(Base):
    __tablename__ = "session_word_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False)
    word_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("words.id"), nullable=False)
    stage_index: Mapped[int] = mapped_column(Integer, nullable=False)
    perfect_count: Mapped[int] = mapped_column(Integer, nullable=False)
    good_count: Mapped[int] = mapped_column(Integer, nullable=False)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False)
    stage_score: Mapped[int] = mapped_column(Integer, nullable=False)
    played_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_swr_word", "word_id"),
        Index("idx_swr_session", "session_id"),
    )
