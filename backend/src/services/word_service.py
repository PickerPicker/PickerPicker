"""src.services.word_service — Word CRUD."""
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.word import Word
from src.schemas.word import WordCreateRequest, WordUpdateRequest

logger = logging.getLogger(__name__)


class WordAlreadyExists(Exception):
    def __init__(self, word: str):
        self.word = word
        super().__init__(f"word_exists: {word}")


class FixedStageTaken(Exception):
    def __init__(self, stage: int | None):
        self.stage = stage
        super().__init__(f"fixed_stage_taken: {stage}")


async def list_words(
    db: AsyncSession,
    difficulty: int | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Word]:
    stmt = select(Word).order_by(Word.difficulty_level, Word.id)
    if difficulty is not None:
        stmt = stmt.where(Word.difficulty_level == difficulty)
    if is_active is not None:
        stmt = stmt.where(Word.is_active == is_active)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_word(db: AsyncSession, word_id: int) -> Word | None:
    return await db.get(Word, word_id)


def _classify_integrity_error(e: IntegrityError, payload_word: str, payload_fixed_stage: int | None) -> Exception:
    msg = str(e.orig).lower() if e.orig else str(e).lower()
    if "uq_words_fixed_stage" in msg or "fixed_stage" in msg:
        return FixedStageTaken(payload_fixed_stage)
    if "word" in msg and ("unique" in msg or "duplicate" in msg or "words_word_key" in msg):
        return WordAlreadyExists(payload_word)
    return e


async def create_word(db: AsyncSession, payload: WordCreateRequest) -> Word:
    word = Word(
        word=payload.word,
        difficulty_level=payload.difficulty_level,
        bpm=payload.bpm,
        input_length=payload.input_length,
        valid_syllables=payload.valid_syllables,
        invalid_syllables=payload.invalid_syllables,
        input_syllables=payload.input_syllables,
        key_mapping=[km.model_dump() for km in payload.key_mapping],
        fixed_stage=payload.fixed_stage,
        is_active=True,
    )
    db.add(word)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise _classify_integrity_error(e, payload.word, payload.fixed_stage) from e
    await db.refresh(word)
    logger.info(f"word 생성: {word.word} (id={word.id})")
    return word


async def update_word(db: AsyncSession, word_id: int, payload: WordUpdateRequest) -> Word | None:
    word = await db.get(Word, word_id)
    if word is None:
        return None
    word.word = payload.word
    word.difficulty_level = payload.difficulty_level
    word.bpm = payload.bpm
    word.input_length = payload.input_length
    word.valid_syllables = payload.valid_syllables
    word.invalid_syllables = payload.invalid_syllables
    word.input_syllables = payload.input_syllables
    word.key_mapping = [km.model_dump() for km in payload.key_mapping]
    word.fixed_stage = payload.fixed_stage
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise _classify_integrity_error(e, payload.word, payload.fixed_stage) from e
    await db.refresh(word)
    return word


async def soft_delete_word(db: AsyncSession, word_id: int) -> bool:
    word = await db.get(Word, word_id)
    if word is None:
        return False
    word.is_active = False
    await db.commit()
    logger.info(f"word 비활성화: {word.word} (id={word.id})")
    return True
