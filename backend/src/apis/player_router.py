"""src.apis.player_router
플레이어 관련 REST API 엔드포인트
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import player_service

router = APIRouter(prefix="/players", tags=["players"])


# ── Request/Response 스키마 ──────────────────────────────────────────

class NicknameCheckResponse(BaseModel):
    exists: bool
    nickname: str


class PlayerResponse(BaseModel):
    id: int
    nickname: str
    score: int

    class Config:
        from_attributes = True


class CreatePlayerRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)


class UpdateScoreRequest(BaseModel):
    nickname: str
    score: int = Field(..., ge=0)


# ── 엔드포인트 ──────────────────────────────────────────────────────

@router.get("/check/{nickname}", response_model=NicknameCheckResponse)
async def check_nickname(nickname: str, db: AsyncSession = Depends(get_db)):
    """닉네임 존재 여부 확인 (기존/신규 플레이어 구분용)"""
    exists = await player_service.check_nickname(db, nickname)
    return NicknameCheckResponse(exists=exists, nickname=nickname)


@router.post("", response_model=PlayerResponse, status_code=201)
async def create_player(body: CreatePlayerRequest, db: AsyncSession = Depends(get_db)):
    """신규 플레이어 등록"""
    player = await player_service.create_player(db, body.nickname)
    return PlayerResponse.model_validate(player)


@router.get("/{nickname}", response_model=PlayerResponse)
async def get_player(nickname: str, db: AsyncSession = Depends(get_db)):
    """닉네임으로 플레이어 조회"""
    player = await player_service.get_player(db, nickname)
    return PlayerResponse.model_validate(player)


@router.put("/score", response_model=PlayerResponse)
async def update_score(body: UpdateScoreRequest, db: AsyncSession = Depends(get_db)):
    """플레이어 점수 갱신 (최고 점수만 저장)"""
    player = await player_service.update_score(db, body.nickname, body.score)
    return PlayerResponse.model_validate(player)
