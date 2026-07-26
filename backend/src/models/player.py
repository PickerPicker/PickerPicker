"""src.models.player
플레이어 ORM 모델 — 결과 화면에 필요한 최고 기록 저장
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, Index, func, text
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    # bcrypt 해시 저장. NULL = PIN 미설정 (레거시 플레이어, 로그인 불가)
    # 레거시 SHA-256 해시(64자 hex)는 로그인 성공 시 bcrypt로 재해싱된다.
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

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

    __table_args__ = (
        # 랭킹 정렬·백분위 계산이 full scan + sort를 타지 않도록
        Index("ix_players_best_score_desc", text("best_score DESC")),
    )
