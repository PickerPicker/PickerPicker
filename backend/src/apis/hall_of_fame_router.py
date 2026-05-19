"""src.apis.hall_of_fame_router
명예의 전당 API — 역대 1위 조회 + 한마디 수정.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import player_service
from src.services.auth_service import verify_token

router = APIRouter(prefix="/hall-of-fame", tags=["hall-of-fame"])


class HallOfFameEntry(BaseModel):
    nickname: str
    score: int
    started_at: datetime
    ended_at: datetime | None
    motto: str | None
    days: int


class MottoRequest(BaseModel):
    motto: str = Field(..., max_length=100)


@router.get("", response_model=list[HallOfFameEntry])
async def get_hall_of_fame(db: AsyncSession = Depends(get_db)):
    """명예의 전당 전체 목록 (현 1위 먼저, 이후 역대순)."""
    entries = await player_service.get_hall_of_fame(db)
    now = datetime.utcnow()
    result: list[HallOfFameEntry] = []
    for e in entries:
        end = e.ended_at or now
        days = max(0, (end - e.started_at).days)
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
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """한마디 수정 — Bearer 토큰 필수, is_hall_of_famer 검증."""
    if not authorization:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer 토큰 형식이 올바르지 않습니다")

    nickname = await verify_token(db, parts[1])
    if not nickname:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    try:
        await player_service.update_motto(db, nickname, body.motto)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return None
