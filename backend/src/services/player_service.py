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
from src.models.hall_of_fame import HallOfFame
from src.core.exceptions import NotFoundError, ConflictError
from src.services.word_stats_service import record_stage_result

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


async def mark_tutorial_seen(db: AsyncSession, nickname: str) -> Player:
    """튜토리얼 시청 완료 처리. 닉네임 없으면 NotFoundError"""
    player = await get_player(db, nickname)
    player.tutorial_seen = True
    await db.commit()
    await db.refresh(player)
    return player


async def get_ranking(db: AsyncSession, limit: int = 10, offset: int = 0) -> list[Player]:
    """best_score 기준 상위 랭킹"""
    result = await db.execute(
        select(Player).order_by(Player.best_score.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def save_game_result(
    db: AsyncSession,
    nickname: str,
    score: int,
    stage: int,
    combo: int,
    stage_scores: dict | None = None,
    stage_results: list | None = None,
) -> Player:
    """게임 결과 저장. 단일 트랜잭션:
    1) Player upsert (없으면 생성, 최고값/play_count 갱신)
    2) hall_of_fame 갱신 (챔피언 교체 시)
    3) game_sessions INSERT (snapshot)
    4) session_word_results INSERT × N (stage_results 있을 때)
    5) word_stats UPSERT × N (stage_results 있을 때)
    6) player_stats_daily UPSERT (일별 집계)
    """
    now = datetime.utcnow()
    today: date = now.date()
    stage_scores = stage_scores or {}

    # 전체 1위 점수 미리 조회 (챔피언 교체 판정용)
    top_result = await db.execute(select(func.max(Player.best_score)))
    current_top_score: int = top_result.scalar() or 0

    # 1) Player
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    player = result.scalar_one_or_none()
    if not player:
        player = Player(nickname=nickname)
        db.add(player)
        await db.flush()  # player.id 발급 (신규 생성 시)

    # 챔피언 교체 판정: 새 점수가 전체 최고점 초과 + 본인 기존 최고점 초과
    is_new_champion = score > current_top_score and score > player.best_score

    player.best_score = max(player.best_score, score)
    player.best_stage = max(player.best_stage, stage)
    player.best_combo = max(player.best_combo, combo)
    player.play_count += 1

    # 1-b) 챔피언 교체 — hall_of_fame 갱신
    if is_new_champion:
        prev_champ_result = await db.execute(
            select(HallOfFame).where(HallOfFame.ended_at.is_(None))
        )
        prev_champ = prev_champ_result.scalar_one_or_none()
        if prev_champ:
            prev_champ.ended_at = now

        new_entry = HallOfFame(
            nickname=nickname,
            score=score,
            started_at=now,
            ended_at=None,
        )
        db.add(new_entry)
        player.is_hall_of_famer = True

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
    await db.flush()  # session.id 발급 (FK 참조용)

    # 2-b) stage_results — raw INSERT + word_stats UPSERT (있을 때)
    if stage_results:
        for sr in stage_results:
            await record_stage_result(
                db,
                session_id=session.id,
                player_id=player.id,
                word_id=sr.word_id,
                stage_index=sr.stage_index,
                perfect=sr.perfect_count,
                good=sr.good_count,
                miss=sr.miss_count,
                stage_score=sr.stage_score,
            )

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
    # 라우터에서 is_new_champion 응답 필드로 전달 (ORM 인스턴스에 임시 속성 부착)
    player._is_new_champion = is_new_champion  # type: ignore[attr-defined]
    return player


async def get_hall_of_fame(db: AsyncSession) -> list[HallOfFame]:
    """명예의 전당 목록. 현재 챔피언(ended_at IS NULL) 먼저, 이후 started_at 내림차순."""
    result = await db.execute(
        select(HallOfFame).order_by(
            HallOfFame.ended_at.is_(None).desc(),
            HallOfFame.started_at.desc(),
        )
    )
    return list(result.scalars().all())


async def update_motto(db: AsyncSession, nickname: str, motto: str) -> None:
    """한마디 수정. is_hall_of_famer가 False이면 PermissionError."""
    player = await get_player(db, nickname)
    if not player.is_hall_of_famer:
        raise PermissionError("1위 경험자만 한마디를 남길 수 있습니다")

    # 해당 닉네임의 가장 최근 hall_of_fame 레코드 업데이트
    result = await db.execute(
        select(HallOfFame)
        .where(HallOfFame.nickname == nickname)
        .order_by(HallOfFame.started_at.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.motto = motto

    player.motto = motto
    await db.commit()
