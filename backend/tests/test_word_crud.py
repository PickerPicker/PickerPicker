"""Word CRUD + 검증 단위 테스트."""
import pytest
from src.services import word_service
from src.services.word_service import WordAlreadyExists, FixedStageTaken
from src.schemas.word import WordCreateRequest


def _valid_payload(word: str = "테스트", fixed: int | None = None) -> WordCreateRequest:
    return WordCreateRequest(
        word=word,
        difficulty_level=1,
        bpm=90,
        input_length=8,
        valid_syllables=["테", "스"],
        invalid_syllables=["트", "ㅌ", "ㅅ", "ㅇ", "ㄱ", "ㄴ"],
        input_syllables=["테", "스"] * 4,
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
        fixed_stage=fixed,
    )


def test_validate_input_length_mismatch():
    with pytest.raises(ValueError, match="input_syllables 길이"):
        WordCreateRequest(
            word="x", difficulty_level=1, bpm=90, input_length=10,
            valid_syllables=["테"], invalid_syllables=[],
            input_syllables=["테"],  # 1 != 10
            key_mapping=[{"key": k, "syllable": "테", "type": "valid"} for k in ["a","s","d","f","j","k","l",";"]],
        )


def test_validate_keys_missing():
    p = _valid_payload()
    p_dict = p.model_dump()
    p_dict["key_mapping"][0]["key"] = "a"
    p_dict["key_mapping"][1]["key"] = "a"  # 'a' 중복, 's' 누락
    with pytest.raises(ValueError, match="8개 키 모두"):
        WordCreateRequest(**p_dict)


def test_validate_syllable_mismatch():
    p_dict = _valid_payload().model_dump()
    p_dict["key_mapping"][0]["syllable"] = "외계어"
    with pytest.raises(ValueError, match="음절 집합이 불일치"):
        WordCreateRequest(**p_dict)


@pytest.mark.asyncio
async def test_create_word(db_session):
    word = await word_service.create_word(db_session, _valid_payload(word="테스트1"))
    assert word.id is not None
    assert word.word == "테스트1"


@pytest.mark.asyncio
async def test_create_word_duplicate_raises(db_session):
    await word_service.create_word(db_session, _valid_payload(word="중복"))
    with pytest.raises(WordAlreadyExists):
        await word_service.create_word(db_session, _valid_payload(word="중복"))


@pytest.mark.asyncio
async def test_create_word_fixed_stage_conflict(db_session):
    await word_service.create_word(db_session, _valid_payload(word="고정1", fixed=1))
    with pytest.raises(FixedStageTaken):
        await word_service.create_word(db_session, _valid_payload(word="고정1b", fixed=1))


@pytest.mark.asyncio
async def test_soft_delete_preserves_row(db_session):
    word = await word_service.create_word(db_session, _valid_payload(word="삭제대상"))
    ok = await word_service.soft_delete_word(db_session, word.id)
    assert ok
    refreshed = await word_service.get_word(db_session, word.id)
    assert refreshed is not None
    assert refreshed.is_active is False
