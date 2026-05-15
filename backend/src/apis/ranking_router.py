"""src.apis.ranking_router
랭킹 API
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import player_service

router = APIRouter(prefix="/ranking", tags=["ranking"])


class RankingEntry(BaseModel):
    rank: int
    nickname: str
    best_score: int
    best_stage: int
    best_combo: int
    play_count: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[RankingEntry])
async def get_ranking(
    limit: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """best_score 기준 상위 랭킹"""
    players = await player_service.get_ranking(db, limit)
    return [
        RankingEntry(
            rank=i + 1,
            nickname=p.nickname,
            best_score=p.best_score,
            best_stage=p.best_stage,
            best_combo=p.best_combo,
            play_count=p.play_count,
        )
        for i, p in enumerate(players)
    ]
