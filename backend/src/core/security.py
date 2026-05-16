"""src.core.security
세션 토큰 Dependency. Authorization: Bearer <token> 헤더 파싱.
"""
import logging
from datetime import datetime
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.models.player_session import PlayerSession

logger = logging.getLogger(__name__)


async def resolve_token(db: AsyncSession, token: str) -> str | None:
    """토큰 유효성 검증. 유효하면 nickname 반환, 만료/없음이면 None.
    만료 토큰은 발견 즉시 삭제.
    """
    result = await db.execute(
        select(PlayerSession).where(PlayerSession.token == token)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at < datetime.utcnow():
        await db.execute(delete(PlayerSession).where(PlayerSession.token == token))
        await db.commit()
        return None
    return row.nickname


def _parse_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


async def require_player(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> str:
    """현재 로그인한 플레이어 nickname 반환. 토큰 없거나 만료 시 401."""
    token = _parse_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다")
    nickname = await resolve_token(db, token)
    if not nickname:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않거나 만료되었습니다")
    return nickname


async def optional_player(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> str | None:
    """선택적 인증. 토큰 있으면 nickname, 없거나 무효면 None."""
    token = _parse_bearer(authorization)
    if not token:
        return None
    return await resolve_token(db, token)
