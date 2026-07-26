"""src.services.word_stats_service
word_stats UPSERT + session_word_results raw INSERT.
단일 트랜잭션 — 호출자가 commit/rollback 관리. 본 함수는 db.add/db.execute만.
"""
import logging

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.timeutil import utcnow
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult

logger = logging.getLogger(__name__)


async def record_stage_result(
    db: AsyncSession,
    session_id: int,
    player_id: int,
    word_id: int,
    stage_index: int,
    perfect: int,
    good: int,
    miss: int,
    stage_score: int,
) -> None:
    """1개 stage 결과 raw INSERT + 집계 UPSERT.

    호출자가 트랜잭션 관리. 본 함수는 commit 하지 않음.
    """
    # 1. raw 기록
    raw = SessionWordResult(
        session_id=session_id,
        word_id=word_id,
        stage_index=stage_index,
        perfect_count=perfect,
        good_count=good,
        miss_count=miss,
        stage_score=stage_score,
    )
    db.add(raw)

    # 2. word_stats UPSERT (PG ON CONFLICT)
    now = utcnow()
    stmt = pg_insert(WordStats).values(
        player_id=player_id,
        word_id=word_id,
        exposure_count=1,
        perfect_count=perfect,
        good_count=good,
        miss_count=miss,
        best_score=stage_score,
        last_played_at=now,
    ).on_conflict_do_update(
        index_elements=["player_id", "word_id"],
        set_={
            "exposure_count": WordStats.__table__.c.exposure_count + 1,
            "perfect_count": WordStats.__table__.c.perfect_count + perfect,
            "good_count": WordStats.__table__.c.good_count + good,
            "miss_count": WordStats.__table__.c.miss_count + miss,
            "best_score": func.greatest(WordStats.__table__.c.best_score, stage_score),
            "last_played_at": now,
        },
    )
    await db.execute(stmt)
