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
    tutorial_seen: bool
    is_stats_public: bool

    class Config:
        from_attributes = True


class SaveResultResponse(BaseModel):
    nickname: str
    best_score: int
    best_stage: int
    best_combo: int
    play_count: int
    tutorial_seen: bool
    is_new_champion: bool

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


class StatsVisibilityRequest(BaseModel):
    is_public: bool


# 비정상/치팅 값 차단을 위한 상한. 향후 스테이지/스코어링 확장 여유 포함.
# score:       현재 스테이지 최대 ~수만점. 50+ 스테이지 + 배율 보너스 감안 10M
# stage:       현재 1~15. 100까지 여유 (메이저 확장 대비)
# combo:       곡당 최대 노트 ~300. 4자리 상한
MAX_SCORE = 10_000_000
MAX_STAGE = 100
MAX_COMBO = 9_999


class StageResultItem(BaseModel):
    """단어 단위 stage raw 결과 (word_stats 집계 + session_word_results raw INSERT용)"""
    word_id: int = Field(..., ge=1)
    stage_index: int = Field(..., ge=1, le=MAX_STAGE)
    perfect_count: int = Field(..., ge=0)
    good_count: int = Field(..., ge=0)
    miss_count: int = Field(..., ge=0)
    stage_score: int = Field(..., ge=0, le=MAX_SCORE)


class SaveResultRequest(BaseModel):
    nickname: str
    score: int = Field(..., ge=0, le=MAX_SCORE)
    stage: int = Field(..., ge=1, le=MAX_STAGE)
    combo: int = Field(..., ge=0, le=MAX_COMBO)
    # 스테이지별 점수: {"1": 1200, "2": 950, ...}. 누락 시 빈 dict.
    stage_scores: dict[str, int] | None = None
    # 단어/stage별 raw 결과. 누락 시 빈 리스트 (기존 호출 호환).
    stage_results: list[StageResultItem] = Field(default_factory=list)


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


@router.patch("/{nickname}/stats-visibility", response_model=PlayerResponse)
async def set_stats_visibility(
    nickname: str,
    body: StatsVisibilityRequest,
    db: AsyncSession = Depends(get_db),
):
    """통계 공개/비공개 전환 — 닉네임 기준 (HMAC 서명으로 보호).

    이 앱은 세션 토큰을 발급하지 않고 닉네임을 신원으로 쓴다 (tutorial-seen과 동일 패턴).
    통계 공개 여부는 민감 정보가 아니므로 HMAC만으로 충분하다.
    """
    player = await player_service.set_stats_visibility(db, nickname, body.is_public)
    return PlayerResponse.model_validate(player)


@router.patch("/{nickname}/tutorial-seen", response_model=PlayerResponse)
async def mark_tutorial_seen(nickname: str, db: AsyncSession = Depends(get_db)):
    """튜토리얼 시청 완료 표시 — 사용자 기준으로 tutorial_seen 관리"""
    player = await player_service.mark_tutorial_seen(db, nickname)
    return PlayerResponse.model_validate(player)


@router.post("/result", response_model=SaveResultResponse)
async def save_result(body: SaveResultRequest, db: AsyncSession = Depends(get_db)):
    """게임 결과 저장 — 최고 기록 갱신 + 세션 스냅샷 + 일별 집계 UPSERT + 챔피언 교체"""
    # stage_scores 검증: 키는 "1"~str(MAX_STAGE), 값은 0~MAX_SCORE
    validated_stage_scores: dict[str, int] = {}
    if body.stage_scores:
        for k, v in body.stage_scores.items():
            try:
                stage_num = int(k)
            except (TypeError, ValueError):
                continue
            if not (1 <= stage_num <= MAX_STAGE):
                continue
            if not isinstance(v, int) or not (0 <= v <= MAX_SCORE):
                continue
            validated_stage_scores[str(stage_num)] = v

    player = await player_service.save_game_result(
        db, body.nickname, body.score, body.stage, body.combo, validated_stage_scores,
        stage_results=body.stage_results,
    )
    is_new_champion = getattr(player, "_is_new_champion", False)
    return SaveResultResponse(
        nickname=player.nickname,
        best_score=player.best_score,
        best_stage=player.best_stage,
        best_combo=player.best_combo,
        play_count=player.play_count,
        tutorial_seen=player.tutorial_seen,
        is_new_champion=is_new_champion,
    )
