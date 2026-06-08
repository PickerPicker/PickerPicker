"""src.apis.stats_router
통계 조회 API. HMAC 서명으로 보호. 전체 공개.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import stats_service, player_service

router = APIRouter(tags=["stats"])


@router.get("/players/{nickname}/stats")
async def my_stats(
    nickname: str,
    db: AsyncSession = Depends(get_db),
):
    """플레이어 종합 통계. HMAC 서명으로 보호."""
    return await stats_service.get_player_stats(db, nickname)


@router.get("/players/{nickname}/public-stats")
async def public_stats(
    nickname: str,
    db: AsyncSession = Depends(get_db),
):
    """랭킹에서 다른 사람이 보는 공개 통계.

    민감 정보는 절대 포함하지 않는다:
      - habit (시간대별 습관 / 세션 간격) → 언제 노는지 노출되므로 제외
      - words.hardest (약점 단어) → 약점 노출되므로 제외 (강점/취향만 공개)
    비공개 플레이어는 {is_public: false}만 반환.
    """
    visible = await player_service.is_stats_public(db, nickname)
    if visible is None:
        # 존재하지 않는 플레이어 — 비공개와 동일하게 처리(닉네임 존재 여부 노출 방지)
        return {"nickname": nickname, "is_public": False}
    if not visible:
        return {"nickname": nickname, "is_public": False}

    full = await stats_service.get_player_stats(db, nickname)
    player = await player_service.get_player(db, nickname)

    # words에서 약점(hardest)만 제거하고 강점/취향은 공개
    words = full.get("words") or {}
    public_words = {
        "played": words.get("played", 0),
        "most_played": words.get("most_played", []),
        "easiest": words.get("easiest", []),
    }

    return {
        "is_public": True,
        "nickname": full["nickname"],
        "motto": player.motto,
        "totals": full["totals"],
        # 평균/추세/백분위는 실력 지표라 전체 공개. habit만 의도적으로 제외.
        "averages": full.get("averages") or {},
        "trend": full.get("trend") or {},
        "percentile": full.get("percentile") or {},
        "stage_best": full.get("stage_best") or [],
        "words": public_words,
    }


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
