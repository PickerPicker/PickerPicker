"""src.apis.hall_of_fame_router
명예의 전당 API — 역대 1위 조회 + 한마디 수정.
"""
import math
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import require_player
from src.core.timeutil import utcnow
from src.services import player_service

router = APIRouter(prefix="/hall-of-fame", tags=["hall-of-fame"])


class HallOfFameEntry(BaseModel):
    nickname: str
    score: int
    started_at: datetime
    ended_at: datetime | None
    motto: str | None
    days: int


class MottoRequest(BaseModel):
    motto: str = Field(..., max_length=15)


@router.get("", response_model=list[HallOfFameEntry])
async def get_hall_of_fame(db: AsyncSession = Depends(get_db)):
    """명예의 전당 전체 목록 (현 1위 먼저, 이후 역대순)."""
    entries = await player_service.get_hall_of_fame(db)
    now = utcnow()
    result: list[HallOfFameEntry] = []
    for e in entries:
        end = e.ended_at or now
        # 초 단위로 올림해 1시간만 재위해도 1일로 표시
        elapsed_sec = (end - e.started_at).total_seconds()
        days = max(1, math.ceil(elapsed_sec / 86400)) if elapsed_sec > 0 else 0
        result.append(HallOfFameEntry(
            nickname=e.nickname,
            score=e.score,
            started_at=e.started_at,
            ended_at=e.ended_at,
            motto=e.motto,
            days=days,
        ))
    return result


@router.patch("/motto", status_code=204)
async def update_motto(
    body: MottoRequest,
    nickname: str = Depends(require_player),
    db: AsyncSession = Depends(get_db),
):
    """한마디 수정 — Bearer 토큰 필수, is_hall_of_famer 검증."""
    try:
        await player_service.update_motto(db, nickname, body.motto)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return None
