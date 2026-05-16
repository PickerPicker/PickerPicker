"""src.core.cleanup
백그라운드 정리 작업 — 30일 초과 세션, 만료 토큰 삭제.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import delete
from src.core.database import AsyncSessionLocal
from src.models.game_session import GameSession
from src.models.player_session import PlayerSession

logger = logging.getLogger(__name__)

SESSION_RETENTION_DAYS = 30
CLEANUP_INTERVAL_SEC = 60 * 60  # 1시간마다


async def _run_once() -> None:
    cutoff_sessions = datetime.utcnow() - timedelta(days=SESSION_RETENTION_DAYS)
    now = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        try:
            res1 = await db.execute(
                delete(GameSession).where(GameSession.played_at < cutoff_sessions)
            )
            res2 = await db.execute(
                delete(PlayerSession).where(PlayerSession.expires_at < now)
            )
            await db.commit()
            logger.info(
                f"클린업: game_sessions {res1.rowcount}개, player_sessions {res2.rowcount}개 삭제"
            )
        except Exception as e:
            await db.rollback()
            logger.warning(f"클린업 실패 (다음 사이클에 재시도): {e}")


async def cleanup_loop() -> None:
    """앱 lifespan 동안 무한 루프."""
    # 시작 시 1회 즉시 실행
    await _run_once()
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SEC)
        await _run_once()
