"""단어 추첨 단위 테스트. (외부 환경에서 실행)"""
import pytest
import pytest_asyncio
from sqlalchemy import select
from src.services.word_pick_service import pick_stages
from src.core.exceptions import InsufficientPoolError
from src.models.word import Word
from src.core.seed import seed_words


@pytest_asyncio.fixture
async def seeded_words(db_session):
    """시드 데이터(15개) 적용된 세션."""
    await seed_words(db_session)
    return db_session


@pytest_asyncio.fixture
async def seeded_words_extended(db_session):
    """난이도별 풀이 풍부한 세션 — 시드 15개 + 각 난이도 3개씩 추가 (총 30개)."""
    await seed_words(db_session)
    extras_per_difficulty = 3
    for diff in range(1, 6):
        for i in range(extras_per_difficulty):
            extra = Word(
                word=f"테스트{diff}_{i}",
                difficulty_level=diff,
                bpm=90 + diff * 15,
                input_length=16 + (diff - 1) * 8,
                valid_syllables=["테", "스"],
                invalid_syllables=["트", "ㅌ", "ㅅ", "ㅇ", "ㄱ", "ㄴ"],
                input_syllables=["테"] * (16 + (diff - 1) * 8),
                key_mapping=[
                    {"key": "a", "syllable": "테", "type": "valid"},
                    {"key": "s", "syllable": "스", "type": "valid"},
                    {"key": "d", "syllable": "트", "type": "invalid"},
                    {"key": "f", "syllable": "ㅌ", "type": "invalid"},
                    {"key": "j", "syllable": "ㅅ", "type": "invalid"},
                    {"key": "k", "syllable": "ㅇ", "type": "invalid"},
                    {"key": "l", "syllable": "ㄱ", "type": "invalid"},
                    {"key": ";", "syllable": "ㄴ", "type": "invalid"},
                ],
                fixed_stage=None,
                is_active=True,
            )
            db_session.add(extra)
    await db_session.commit()
    return db_session


@pytest.mark.asyncio
async def test_pick_stages_fixed_word_always_at_stage1(seeded_words):
    """커피=stage 1 고정 단어가 항상 stage 1에 배치."""
    stages = await pick_stages(seeded_words)
    assert stages[0].word == "커피"
    assert stages[0].fixed_stage == 1


@pytest.mark.asyncio
async def test_pick_stages_returns_15(seeded_words):
    stages = await pick_stages(seeded_words)
    assert len(stages) == 15


@pytest.mark.asyncio
async def test_pick_stages_no_duplicates(seeded_words_extended):
    """단어 풀 충분할 때 중복 없음."""
    stages = await pick_stages(seeded_words_extended)
    ids = [s.id for s in stages]
    assert len(set(ids)) == len(ids)


@pytest.mark.asyncio
async def test_pick_stages_raises_on_insufficient_pool(db_session):
    """빈 DB일 때 난이도 1부터 부족 → InsufficientPoolError."""
    with pytest.raises(InsufficientPoolError) as exc:
        await pick_stages(db_session)
    assert exc.value.difficulty == 1


@pytest.mark.asyncio
async def test_pick_stages_practice_mode_count_3(seeded_words):
    """연습 모드 — 3개만 추첨. 첫 stage는 고정 단어 커피."""
    stages = await pick_stages(seeded_words, count=3)
    assert len(stages) == 3
    assert stages[0].word == "커피"
