"""
hall_of_fame 테이블 초기 데이터 삽입.

현재 DB best_score 1위 플레이어를 hall_of_fame에 1개 레코드 삽입하고
is_hall_of_famer = True 업데이트.
이미 hall_of_fame에 데이터가 있으면 실행 중단.

실행: python -m scripts.migrate_hall_of_fame_init
(backend/ 디렉토리에서)
"""
import asyncio
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import engine, Base
from src.models.player import Player
from src.models.hall_of_fame import HallOfFame
import src.models  # noqa: F401 — create_all 인식용


async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as db:
        # 이미 데이터 있으면 중단
        count_result = await db.execute(select(func.count()).select_from(HallOfFame))
        if (count_result.scalar() or 0) > 0:
            print("hall_of_fame에 이미 데이터가 있습니다. 중단.")
            return

        # 현재 1위 조회
        top_result = await db.execute(
            select(Player).order_by(Player.best_score.desc()).limit(1)
        )
        top_player = top_result.scalar_one_or_none()
        if not top_player or top_player.best_score <= 0:
            print("랭킹 1위 플레이어가 없습니다 (best_score = 0).")
            return

        now = datetime.utcnow()
        entry = HallOfFame(
            nickname=top_player.nickname,
            score=top_player.best_score,
            started_at=now,
            ended_at=None,
        )
        db.add(entry)
        top_player.is_hall_of_famer = True
        await db.commit()
        print(f"초기 챔피언 등록 완료: {top_player.nickname} (점수: {top_player.best_score})")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
