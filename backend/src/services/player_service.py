"""src.services.player_service
플레이어 비즈니스 로직
"""
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.player import Player
from src.core.exceptions import NotFoundError, ConflictError

logger = logging.getLogger(__name__)


async def check_nickname(db: AsyncSession, nickname: str) -> bool:
    """닉네임 존재 여부 확인. True = 기존 플레이어"""
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    return result.scalar_one_or_none() is not None


async def create_player(db: AsyncSession, nickname: str) -> Player:
    """신규 플레이어 생성. 중복 닉네임이면 ConflictError"""
    if await check_nickname(db, nickname):
        raise ConflictError(f"'{nickname}'은 이미 존재하는 닉네임입니다")

    player = Player(nickname=nickname)
    db.add(player)
    await db.commit()
    await db.refresh(player)
    logger.info(f"신규 플레이어 생성: {nickname}")
    return player


async def get_player(db: AsyncSession, nickname: str) -> Player:
    """닉네임으로 플레이어 조회. 없으면 NotFoundError"""
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    player = result.scalar_one_or_none()
    if not player:
        raise NotFoundError(f"'{nickname}' 플레이어를 찾을 수 없습니다")
    return player


async def get_ranking(db: AsyncSession, limit: int = 10) -> list[Player]:
    """점수 기준 상위 랭킹 조회"""
    result = await db.execute(
        select(Player).order_by(Player.score.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def update_score(db: AsyncSession, nickname: str, score: int) -> Player:
    """플레이어 점수 갱신"""
    player = await get_player(db, nickname)
    player.score = max(player.score, score)  # 최고 점수만 저장
    await db.commit()
    await db.refresh(player)
    return player
