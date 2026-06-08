"""src.models.player
플레이어 ORM 모델 — 결과 화면에 필요한 최고 기록 저장
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    # SHA-256 해시 저장. NULL = PIN 미설정 (레거시 플레이어)
    pin_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)

    # 최고 기록 (결과 화면 역대 최고 기록 섹션)
    best_score: Mapped[int] = mapped_column(Integer, default=0)
    best_stage: Mapped[int] = mapped_column(Integer, default=0)   # 1~15
    best_combo: Mapped[int] = mapped_column(Integer, default=0)
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    # 튜토리얼 시청 여부 — 사용자 기준으로 관리 (브라우저 localStorage 대체)
    tutorial_seen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 명예의 전당 — 1위 경험 여부, 한마디
    is_hall_of_famer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    motto: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    # 통계 공개 여부 — 랭킹에서 다른 사람이 내 요약 통계를 볼 수 있는지. 기본 공개.
    is_stats_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
