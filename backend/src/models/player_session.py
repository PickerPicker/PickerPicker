"""src.models.player_session
인증 세션 토큰. 24h TTL.
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class PlayerSession(Base):
    __tablename__ = "player_sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_player_sessions_nickname", "nickname"),
        Index("ix_player_sessions_expires_at", "expires_at"),
    )
