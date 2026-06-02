"""src.apis.admin_router — admin 전용 API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.dependencies.admin_auth import get_current_admin
from src.models.admin import Admin
from src.models.player import Player
from src.models.game_session import GameSession
from src.models.word import Word
from src.models.word_stats import WordStats
from src.services import admin_auth_service, word_service
from src.services.word_service import WordAlreadyExists, FixedStageTaken
from src.schemas.word import WordCreateRequest, WordUpdateRequest, WordResponse

router = APIRouter(prefix="/admin", tags=["admin"])


# ===== auth =====
class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await admin_auth_service.login(db, body.username, body.password)
    if result is None:
        raise HTTPException(401, "invalid_credentials")
    token, exp = result
    return AdminLoginResponse(token=token, expires_at=exp)


@router.post("/auth/logout", status_code=204)
async def admin_logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    if authorization and authorization.lower().startswith("bearer "):
        await admin_auth_service.logout(db, authorization[7:].strip())


# ===== admin user mgmt =====
class AdminCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class AdminResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    created_by: int | None
    model_config = {"from_attributes": True}


@router.post("/admins", response_model=AdminResponse, status_code=201)
async def create_admin_endpoint(
    body: AdminCreateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        admin = await admin_auth_service.create_admin(db, body.username, body.password, current.id)
    except IntegrityError:
        raise HTTPException(409, "admin_username_exists")
    return admin


@router.get("/admins", response_model=list[AdminResponse])
async def list_admins(
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).order_by(Admin.id))
    return list(result.scalars().all())


# ===== words =====
@router.get("/words", response_model=list[WordResponse])
async def list_words_endpoint(
    difficulty: int | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await word_service.list_words(db, difficulty, is_active, limit, offset)


@router.get("/words/{word_id}", response_model=WordResponse)
async def get_word_endpoint(
    word_id: int,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    word = await word_service.get_word(db, word_id)
    if word is None:
        raise HTTPException(404, "word_not_found")
    return word


@router.post("/words", response_model=WordResponse, status_code=201)
async def create_word_endpoint(
    body: WordCreateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await word_service.create_word(db, body)
    except WordAlreadyExists as e:
        raise HTTPException(409, f"word_exists:{e.word}")
    except FixedStageTaken as e:
        raise HTTPException(409, f"fixed_stage_taken:{e.stage}")


@router.put("/words/{word_id}", response_model=WordResponse)
async def update_word_endpoint(
    word_id: int,
    body: WordUpdateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        word = await word_service.update_word(db, word_id, body)
    except WordAlreadyExists as e:
        raise HTTPException(409, f"word_exists:{e.word}")
    except FixedStageTaken as e:
        raise HTTPException(409, f"fixed_stage_taken:{e.stage}")
    if word is None:
        raise HTTPException(404, "word_not_found")
    return word


@router.delete("/words/{word_id}", status_code=204)
async def delete_word_endpoint(
    word_id: int,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ok = await word_service.soft_delete_word(db, word_id)
    if not ok:
        raise HTTPException(404, "word_not_found")


# ===== stats =====
class WordGlobalStat(BaseModel):
    word_id: int
    word: str
    difficulty_level: int
    total_exposure: int
    accuracy: float
    is_active: bool


@router.get("/stats/words", response_model=list[WordGlobalStat])
async def admin_stats_words(
    sort: str = "exposure_desc",
    limit: int = 50,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    perfect_sum = func.coalesce(func.sum(WordStats.perfect_count), 0)
    good_sum = func.coalesce(func.sum(WordStats.good_count), 0)
    miss_sum = func.coalesce(func.sum(WordStats.miss_count), 0)
    total_judgments = perfect_sum + good_sum + miss_sum
    accuracy_expr = func.coalesce(
        (perfect_sum + good_sum * 0.5) / func.nullif(total_judgments, 0), 0.0
    )
    exposure_sum_expr = func.coalesce(func.sum(WordStats.exposure_count), 0)

    stmt = (
        select(
            Word.id.label("word_id"),
            Word.word.label("word"),
            Word.difficulty_level,
            exposure_sum_expr.label("total_exposure"),
            accuracy_expr.label("accuracy"),
            Word.is_active,
        )
        .outerjoin(WordStats, WordStats.word_id == Word.id)
        .group_by(Word.id)
    )
    if sort == "exposure_desc":
        stmt = stmt.order_by(exposure_sum_expr.desc())
    elif sort == "accuracy_asc":
        stmt = stmt.order_by(accuracy_expr.asc())
    elif sort == "accuracy_desc":
        stmt = stmt.order_by(accuracy_expr.desc())
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return [
        WordGlobalStat(
            word_id=r.word_id,
            word=r.word,
            difficulty_level=r.difficulty_level,
            total_exposure=int(r.total_exposure or 0),
            accuracy=float(r.accuracy or 0),
            is_active=r.is_active,
        )
        for r in result.all()
    ]


class AdminOverview(BaseModel):
    total_players: int
    total_sessions: int
    active_word_count: int
    avg_score: float


@router.get("/stats/overview", response_model=AdminOverview)
async def admin_stats_overview(
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_players = await db.scalar(select(func.count()).select_from(Player)) or 0
    total_sessions = await db.scalar(select(func.count()).select_from(GameSession)) or 0
    active_word_count = await db.scalar(
        select(func.count()).select_from(Word).where(Word.is_active == True)
    ) or 0
    avg_score = await db.scalar(select(func.avg(GameSession.score))) or 0

    return AdminOverview(
        total_players=total_players,
        total_sessions=total_sessions,
        active_word_count=active_word_count,
        avg_score=float(avg_score),
    )
