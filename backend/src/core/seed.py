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

# 데이터셋은 backend 패키지 안에 둔다.
# 과거에는 프로젝트 루트의 docs/를 참조했는데, 백엔드 Docker 이미지는 backend/ 하위만
# 복사하므로(COPY src/) 컨테이너에서 경로가 /docs/... 가 되어 시드가 항상 실패했다.
# parents[0]=core, parents[1]=src → src/data/
DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "rhythm_stages_001_015.json"


async def seed_words(db: AsyncSession) -> None:
    """words 비어있으면 정적 데이터셋 INSERT. 커피 = fixed_stage=1."""
    count = await db.scalar(select(func.count()).select_from(Word))
    if count and count > 0:
        logger.info(f"words 시드 스킵 — {count}개 존재")
        return

    if not DATASET_PATH.exists():
        # words가 비면 /games/start가 422를 반환해 게임 자체를 시작할 수 없다.
        # 조용한 warning으로 두면 신규 환경에서 원인 추적이 어려워 error로 올린다.
        logger.error(
            f"시드 데이터셋을 찾을 수 없습니다: {DATASET_PATH} — "
            "단어 풀이 비어 게임을 시작할 수 없습니다. "
            "이미지에 backend/src/data/ 가 포함됐는지 확인하세요."
        )
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
