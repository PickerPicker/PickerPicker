"""src.services.word_pick_service
단어 풀에서 stage 추첨. 고정 단어 우선, 나머지는 난이도 그룹별 무중복 랜덤.
"""
import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.word import Word
from src.core.exceptions import InsufficientPoolError

TOTAL_STAGES = 15


async def pick_stages(db: AsyncSession, count: int = TOTAL_STAGES) -> list[Word]:
    """count개 stage 단어 추첨. 고정 단어 → 난이도 그룹 추첨 순.

    Args:
        db: AsyncSession
        count: 추첨할 stage 수 (게임=15, 연습=3)
    Returns:
        list[Word] (길이 == count)
    Raises:
        InsufficientPoolError: 특정 난이도 풀이 부족할 때
    """
    stages: list[Word | None] = [None] * count

    # 1. 고정 단어 배치 — fixed_stage가 1~count 범위인 단어만
    fixed_result = await db.execute(
        select(Word).where(Word.fixed_stage.isnot(None), Word.is_active)
    )
    for w in fixed_result.scalars().all():
        if w.fixed_stage is not None and 1 <= w.fixed_stage <= count:
            stages[w.fixed_stage - 1] = w

    # 2. 빈 슬롯 = 난이도 그룹별 풀에서 무중복 랜덤
    used_ids: set[int] = {s.id for s in stages if s is not None}
    for idx in range(count):
        if stages[idx] is not None:
            continue
        diff = (idx // 3) + 1  # 0~2 -> 1, 3~5 -> 2, ..., 12~14 -> 5
        if diff > 5:
            diff = 5  # 안전망

        stmt = select(Word).where(
            Word.difficulty_level == diff,
            Word.is_active,
            Word.fixed_stage.is_(None),
        )
        if used_ids:
            stmt = stmt.where(~Word.id.in_(used_ids))

        pool_result = await db.execute(stmt)
        pool = list(pool_result.scalars().all())
        if not pool:
            raise InsufficientPoolError(difficulty=diff)
        chosen = random.choice(pool)
        stages[idx] = chosen
        used_ids.add(chosen.id)

    return [s for s in stages if s is not None]
