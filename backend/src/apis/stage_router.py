"""Stage data API."""
import json
from functools import lru_cache
from pathlib import Path as FilePath
from typing import Literal

from fastapi import APIRouter, Path
from pydantic import BaseModel, Field

from src.core.exceptions import NotFoundError

router = APIRouter(prefix="/stages", tags=["stages"])

DATASET_PATH = FilePath(__file__).resolve().parents[3] / "docs" / "rhythm_stages_001_015.json"


class KeyMappingResponse(BaseModel):
    key: str
    syllable: str
    type: Literal["valid", "invalid"]


class StageResponse(BaseModel):
    stage: int = Field(..., ge=1, le=15)
    difficultyLevel: int = Field(..., ge=1)
    bpm: int = Field(..., ge=1)
    word: str
    validSyllables: list[str]
    invalidSyllables: list[str]
    inputLength: int = Field(..., ge=1)
    inputSyllables: list[str]
    keyMapping: list[KeyMappingResponse]


class GameRulesResponse(BaseModel):
    totalStages: int
    difficultyGroupSize: int
    baseBpm: int
    bpmIncreasePerDifficulty: int
    baseInputLength: int
    inputLengthIncreasePerDifficulty: int
    validSyllableRatioMin: float


class GameDataResponse(BaseModel):
    gameTitle: str
    version: str
    keyLayout: list[str]
    rules: GameRulesResponse
    stages: list[StageResponse]


class StageListResponse(BaseModel):
    gameTitle: str
    version: str
    keyLayout: list[str]
    rules: GameRulesResponse
    stages: list[StageResponse]


@lru_cache(maxsize=1)
def load_stage_dataset() -> dict:
    """Load the checked-in stage dataset once per process."""
    with DATASET_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


@router.get("", response_model=StageListResponse)
async def get_stages():
    """Return the full 1-15 stage dataset."""
    return load_stage_dataset()


@router.get("/meta", response_model=GameDataResponse)
async def get_stage_dataset():
    """Return game metadata and all stages."""
    return load_stage_dataset()


@router.get("/{stage_number}", response_model=StageResponse)
async def get_stage(stage_number: int = Path(..., ge=1, le=15)):
    """Return a single stage by number."""
    dataset = load_stage_dataset()
    for stage in dataset["stages"]:
        if stage["stage"] == stage_number:
            return stage
    raise NotFoundError(f"stage {stage_number} not found")
