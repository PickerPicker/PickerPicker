"""src.core.seed
첫 기동 시 자동 시드 — words(rhythm_stages_001_015.json), admins(env).
멱등성 보장 — 이미 데이터 있으면 스킵.
"""
import json
import logging
from pathlib import Path

import bcrypt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.word import Word
from src.models.admin import Admin

logger = logging.getLogger(__name__)

# backend/src/core/seed.py → backend/src/core → backend/src → backend → project root
# parents[0]=core, parents[1]=src, parents[2]=backend, parents[3]=PickerPicker
DATASET_PATH = Path(__file__).resolve().parents[3] / "docs" / "rhythm_stages_001_015.json"


async def seed_words(db: AsyncSession) -> None:
    """words 비어있으면 정적 데이터셋 INSERT. 커피 = fixed_stage=1."""
    count = await db.scalar(select(func.count()).select_from(Word))
    if count and count > 0:
        logger.info(f"words 시드 스킵 — {count}개 존재")
        return

    if not DATASET_PATH.exists():
        logger.warning(f"시드 데이터셋 없음: {DATASET_PATH}")
        return

    with DATASET_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    for stage_data in data["stages"]:
        word = Word(
            word=stage_data["word"],
            difficulty_level=stage_data["difficultyLevel"],
            bpm=stage_data["bpm"],
            input_length=stage_data["inputLength"],
            valid_syllables=stage_data["validSyllables"],
            invalid_syllables=stage_data["invalidSyllables"],
            input_syllables=stage_data["inputSyllables"],
            key_mapping=stage_data["keyMapping"],
            fixed_stage=stage_data["stage"] if stage_data["word"] == "커피" else None,
            is_active=True,
        )
        db.add(word)

    await db.commit()
    logger.info(f"words 시드 완료 — {len(data['stages'])}개 (커피=fixed_stage=1)")


async def seed_admin(db: AsyncSession) -> None:
    """admins 비어있고 env 자격증명 있으면 INSERT."""
    if not settings.INITIAL_ADMIN_USERNAME or not settings.INITIAL_ADMIN_PASSWORD:
        logger.info("admin 시드 스킵 — env 미설정")
        return

    count = await db.scalar(select(func.count()).select_from(Admin))
    if count and count > 0:
        logger.info(f"admin 시드 스킵 — {count}개 존재")
        return

    password_hash = bcrypt.hashpw(
        settings.INITIAL_ADMIN_PASSWORD.encode(), bcrypt.gensalt()
    ).decode()
    admin = Admin(username=settings.INITIAL_ADMIN_USERNAME, password_hash=password_hash)
    db.add(admin)
    await db.commit()
    logger.info(f"admin 시드 완료 — username={settings.INITIAL_ADMIN_USERNAME}")
