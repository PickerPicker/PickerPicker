"""src.apis.stats_router
통계 조회 API. HMAC 서명으로 보호. 전체 공개.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import stats_service

router = APIRouter(tags=["stats"])


@router.get("/players/{nickname}/stats")
async def my_stats(
    nickname: str,
    db: AsyncSession = Depends(get_db),
):
    """플레이어 종합 통계. HMAC 서명으로 보호."""
    return await stats_service.get_player_stats(db, nickname)


@router.get("/players/{nickname}/sessions")
async def my_sessions(
    nickname: str,
    days: int = Query(default=30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """플레이어 일별 시계열 (player_stats_daily 기반)."""
    days_data = await stats_service.get_player_sessions_by_day(db, nickname, days)
    return {"days": days_data}


@router.get("/stats/global")
async def global_stats(db: AsyncSession = Depends(get_db)):
    """전체 집계. 5분 캐시. 공개 엔드포인트."""
    return await stats_service.get_global_stats(db)
