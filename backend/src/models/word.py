"""src.models.word
단어 풀. AI 생성 JSON을 admin이 등록.
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, UniqueConstraint, Index, CheckConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    input_length: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    invalid_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    input_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    key_mapping: Mapped[list] = mapped_column(JSONB, nullable=False)
    fixed_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("difficulty_level BETWEEN 1 AND 5", name="ck_words_difficulty_range"),
        UniqueConstraint("fixed_stage", name="uq_words_fixed_stage"),
        Index("idx_words_active_diff", "is_active", "difficulty_level"),
    )
