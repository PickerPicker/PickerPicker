"""src.apis.stats_router
통계 조회 API. 본인 통계는 인증 필수. 전체는 공개.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import require_player
from src.services import stats_service

router = APIRouter(tags=["stats"])


@router.get("/players/{nickname}/stats")
async def my_stats(
    nickname: str,
    current: str = Depends(require_player),
    db: AsyncSession = Depends(get_db),
):
    """본인 종합 통계. 토큰 nickname과 path nickname 일치 필수."""
    if current != nickname:
        raise HTTPException(status_code=403, detail="본인 통계만 조회할 수 있습니다")
    return await stats_service.get_player_stats(db, nickname)


@router.get("/players/{nickname}/sessions")
async def my_sessions(
    nickname: str,
    days: int = Query(default=30, ge=1, le=90),
    current: str = Depends(require_player),
    db: AsyncSession = Depends(get_db),
):
    """본인 일별 시계열 (player_stats_daily 기반)."""
    if current != nickname:
        raise HTTPException(status_code=403, detail="본인 통계만 조회할 수 있습니다")
    days_data = await stats_service.get_player_sessions_by_day(db, nickname, days)
    return {"days": days_data}


@router.get("/stats/global")
async def global_stats(db: AsyncSession = Depends(get_db)):
    """전체 집계. 5분 캐시. 공개 엔드포인트."""
    return await stats_service.get_global_stats(db)
