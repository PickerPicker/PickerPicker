"""src.apis.player_router
플레이어 REST API
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import player_service

router = APIRouter(prefix="/players", tags=["players"])


# ── 스키마 ────────────────────────────────────────────────────────

class NicknameCheckResponse(BaseModel):
    exists: bool
    nickname: str


class PlayerResponse(BaseModel):
    nickname: str
    best_score: int
    best_stage: int
    best_combo: int
    play_count: int

    class Config:
        from_attributes = True


class CreatePlayerRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class VerifyPinRequest(BaseModel):
    nickname: str
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class VerifyPinResponse(BaseModel):
    success: bool


class SaveResultRequest(BaseModel):
    nickname: str
    score: int = Field(..., ge=0)
    stage: int = Field(..., ge=1, le=15)
    combo: int = Field(..., ge=0)


# ── 엔드포인트 ───────────────────────────────────────────────────

@router.get("/check/{nickname}", response_model=NicknameCheckResponse)
async def check_nickname(nickname: str, db: AsyncSession = Depends(get_db)):
    """닉네임 존재 여부 확인 (기존/신규 플레이어 구분)"""
    exists = await player_service.check_nickname(db, nickname)
    return NicknameCheckResponse(exists=exists, nickname=nickname)


@router.post("", response_model=PlayerResponse, status_code=201)
async def create_player(body: CreatePlayerRequest, db: AsyncSession = Depends(get_db)):
    """신규 플레이어 등록 (PIN 포함)"""
    player = await player_service.create_player(db, body.nickname, body.pin)
    return PlayerResponse.model_validate(player)


@router.post("/verify-pin", response_model=VerifyPinResponse)
async def verify_pin(body: VerifyPinRequest, db: AsyncSession = Depends(get_db)):
    """PIN 검증 — 기존 플레이어 로그인"""
    success = await player_service.verify_pin(db, body.nickname, body.pin)
    return VerifyPinResponse(success=success)


@router.get("/{nickname}", response_model=PlayerResponse)
async def get_player(nickname: str, db: AsyncSession = Depends(get_db)):
    """닉네임으로 플레이어 조회 (역대 최고 기록 포함)"""
    player = await player_service.get_player(db, nickname)
    return PlayerResponse.model_validate(player)


@router.post("/result", response_model=PlayerResponse)
async def save_result(body: SaveResultRequest, db: AsyncSession = Depends(get_db)):
    """게임 결과 저장 — 최고 기록 갱신"""
    player = await player_service.save_game_result(
        db, body.nickname, body.score, body.stage, body.combo
    )
    return PlayerResponse.model_validate(player)
