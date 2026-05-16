"""src.services.auth_service
PIN 검증 후 세션 토큰 발급/회수.
"""
import logging
import secrets
from datetime import datetime, timedelta
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.player_session import PlayerSession
from src.services import player_service
from src.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

TOKEN_TTL = timedelta(hours=24)


async def login(db: AsyncSession, nickname: str, pin: str) -> tuple[str, datetime] | None:
    """PIN 검증 후 토큰 발급. 성공 시 (token, expires_at), 실패 시 None."""
    try:
        ok = await player_service.verify_pin(db, nickname, pin)
    except NotFoundError:
        return None
    if not ok:
        return None
    token = secrets.token_urlsafe(48)[:64]
    expires_at = datetime.utcnow() + TOKEN_TTL
    session = PlayerSession(token=token, nickname=nickname, expires_at=expires_at)
    db.add(session)
    await db.commit()
    logger.info(f"로그인 토큰 발급: {nickname}")
    return token, expires_at


async def logout(db: AsyncSession, token: str) -> None:
    """토큰 폐기. 존재하지 않아도 조용히 통과."""
    await db.execute(delete(PlayerSession).where(PlayerSession.token == token))
    await db.commit()
