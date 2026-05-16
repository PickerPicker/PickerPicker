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


# 비정상/치팅 값 차단을 위한 상한. 향후 스테이지/스코어링 확장 여유 포함.
# score:       현재 스테이지 최대 ~수만점. 50+ 스테이지 + 배율 보너스 감안 10M
# stage:       현재 1~15. 100까지 여유 (메이저 확장 대비)
# combo:       곡당 최대 노트 ~300. 4자리 상한
MAX_SCORE = 10_000_000
MAX_STAGE = 100
MAX_COMBO = 9_999


class SaveResultRequest(BaseModel):
    nickname: str
    score: int = Field(..., ge=0, le=MAX_SCORE)
    stage: int = Field(..., ge=1, le=MAX_STAGE)
    combo: int = Field(..., ge=0, le=MAX_COMBO)


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
