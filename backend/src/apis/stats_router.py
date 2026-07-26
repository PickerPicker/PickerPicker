"""src.apis.stats_router
통계 조회 API.

본인 전용(`/stats`, `/sessions`)은 Bearer 토큰 필수 — habit(플레이 시간대·간격)과
words.hardest(약점 단어)가 담기므로 남이 열람하면 안 된다.
공개용(`public-stats`)만 토큰 없이 열려 있고, 그마저도 민감 항목은 제외한다.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import require_player, assert_self
from src.services import stats_service, player_service

router = APIRouter(tags=["stats"])


@router.get("/players/{nickname}/stats")
async def my_stats(
    nickname: str,
    me: str = Depends(require_player),
    db: AsyncSession = Depends(get_db),
):
    """본인 종합 통계. Bearer 토큰 필수 — 민감 정보(habit/약점단어) 포함."""
    assert_self(nickname, me)
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

    # 공개 전용 집계 — habit·약점단어는 계산조차 하지 않는다
    stats = await stats_service.get_public_stats(db, nickname)
    if stats is None:
        return {"nickname": nickname, "is_public": False}

    return {"is_public": True, **stats}


@router.get("/players/{nickname}/sessions")
async def my_sessions(
    nickname: str,
    days: int = Query(default=30, ge=1, le=90),
    me: str = Depends(require_player),
    db: AsyncSession = Depends(get_db),
):
    """본인 일별 시계열 (player_stats_daily 기반). Bearer 토큰 필수."""
    assert_self(nickname, me)
    days_data = await stats_service.get_player_sessions_by_day(db, nickname, days)
    return {"days": days_data}


@router.get("/stats/global")
async def global_stats(db: AsyncSession = Depends(get_db)):
    """전체 집계. 5분 캐시. 공개 엔드포인트."""
    return await stats_service.get_global_stats(db)
