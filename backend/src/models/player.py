"""src.models.player
플레이어 ORM 모델 — 결과 화면에 필요한 최고 기록 저장
"""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # 최고 기록 (결과 화면 역대 최고 기록 섹션)
    best_score: Mapped[int] = mapped_column(Integer, default=0)
    best_stage: Mapped[int] = mapped_column(Integer, default=0)   # 1~15
    best_combo: Mapped[int] = mapped_column(Integer, default=0)
    play_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
