"""src.services.player_service
플레이어 비즈니스 로직
"""
import hashlib
import logging
from datetime import datetime, date
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.player import Player
from src.models.game_session import GameSession
from src.models.player_stats_daily import PlayerStatsDaily
from src.core.exceptions import NotFoundError, ConflictError

logger = logging.getLogger(__name__)


async def check_nickname(db: AsyncSession, nickname: str) -> bool:
    """닉네임 존재 여부. True = 기존 플레이어"""
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    return result.scalar_one_or_none() is not None


def _hash_pin(pin: str) -> str:
    """4자리 PIN을 SHA-256 해시로 변환"""
    return hashlib.sha256(pin.encode()).hexdigest()


async def create_player(db: AsyncSession, nickname: str, pin: str) -> Player:
    """신규 플레이어 생성 (PIN 포함). 중복이면 ConflictError"""
    if await check_nickname(db, nickname):
        raise ConflictError(f"'{nickname}'은 이미 존재하는 닉네임입니다")
    player = Player(nickname=nickname, pin_hash=_hash_pin(pin))
    db.add(player)
    await db.commit()
    await db.refresh(player)
    logger.info(f"신규 플레이어 생성: {nickname}")
    return player


async def verify_pin(db: AsyncSession, nickname: str, pin: str) -> bool:
    """PIN 검증. 닉네임 없으면 NotFoundError. PIN 불일치 시 False"""
    player = await get_player(db, nickname)
    if player.pin_hash is None:
        # 레거시 플레이어 — PIN 미설정 상태, 입력한 PIN으로 자동 설정
        player.pin_hash = _hash_pin(pin)
        await db.commit()
        return True
    return player.pin_hash == _hash_pin(pin)


async def get_player(db: AsyncSession, nickname: str) -> Player:
    """닉네임으로 플레이어 조회. 없으면 NotFoundError"""
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    player = result.scalar_one_or_none()
    if not player:
        raise NotFoundError(f"'{nickname}' 플레이어를 찾을 수 없습니다")
    return player


async def get_ranking(db: AsyncSession, limit: int = 10) -> list[Player]:
    """best_score 기준 상위 랭킹"""
    result = await db.execute(
        select(Player).order_by(Player.best_score.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def save_game_result(
    db: AsyncSession,
    nickname: str,
    score: int,
    stage: int,
    combo: int,
    stage_scores: dict | None = None,
) -> Player:
    """게임 결과 저장. 단일 트랜잭션:
    1) Player upsert (없으면 생성, 최고값/play_count 갱신)
    2) game_sessions INSERT (snapshot)
    3) player_stats_daily UPSERT (일별 집계)
    """
    now = datetime.utcnow()
    today: date = now.date()
    stage_scores = stage_scores or {}

    # 1) Player
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    player = result.scalar_one_or_none()
    if not player:
        player = Player(nickname=nickname)
        db.add(player)

    player.best_score = max(player.best_score, score)
    player.best_stage = max(player.best_stage, stage)
    player.best_combo = max(player.best_combo, combo)
    player.play_count += 1

    # 2) GameSession 스냅샷
    session = GameSession(
        nickname=nickname,
        score=score,
        stage=stage,
        combo=combo,
        stage_scores=stage_scores,
        played_at=now,
    )
    db.add(session)

    # 3) PlayerStatsDaily UPSERT
    stmt = pg_insert(PlayerStatsDaily).values(
        nickname=nickname,
        date=today,
        play_count=1,
        sum_score=score,
        max_score=score,
        max_stage=stage,
        max_combo=combo,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["nickname", "date"],
        set_={
            "play_count": PlayerStatsDaily.play_count + 1,
            "sum_score": PlayerStatsDaily.sum_score + score,
            "max_score": func.greatest(PlayerStatsDaily.max_score, score),
            "max_stage": func.greatest(PlayerStatsDaily.max_stage, stage),
            "max_combo": func.greatest(PlayerStatsDaily.max_combo, combo),
        },
    )
    await db.execute(stmt)

    await db.commit()
    await db.refresh(player)
    return player
