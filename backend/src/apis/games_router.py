"""src.apis.games_router — 게임 시작 단어 추첨 + 연습 모드."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.exceptions import InsufficientPoolError
from src.services.word_pick_service import pick_stages
from src.schemas.word import WordResponse

router = APIRouter(tags=["games"])


class StartGameResponse(BaseModel):
    stages: list[WordResponse]


@router.post("/games/start", response_model=StartGameResponse)
async def start_game(db: AsyncSession = Depends(get_db)):
    try:
        stages = await pick_stages(db, count=15)
    except InsufficientPoolError as e:
        raise HTTPException(422, f"insufficient_word_pool:difficulty={e.difficulty}")
    return StartGameResponse(stages=stages)


@router.post("/practice/start", response_model=StartGameResponse)
async def start_practice(db: AsyncSession = Depends(get_db)):
    try:
        stages = await pick_stages(db, count=3)
    except InsufficientPoolError as e:
        raise HTTPException(422, f"insufficient_word_pool:difficulty={e.difficulty}")
    return StartGameResponse(stages=stages)
