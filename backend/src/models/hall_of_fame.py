"""src.models.hall_of_fame
역대 1위 기록. ended_at IS NULL = 현재 챔피언 (항상 최대 1개).
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class HallOfFame(Base):
    __tablename__ = "hall_of_fame"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    motto: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
