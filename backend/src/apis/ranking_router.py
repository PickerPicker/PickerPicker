"""src.apis.ranking_router
랭킹 관련 REST API 엔드포인트
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
    score: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[RankingEntry])
async def get_ranking(
    limit: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """상위 랭킹 조회"""
    players = await player_service.get_ranking(db, limit)
    return [
        RankingEntry(rank=i + 1, nickname=p.nickname, score=p.score)
        for i, p in enumerate(players)
    ]
