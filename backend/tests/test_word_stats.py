"""word_stats UPSERT + raw INSERT 단위 테스트."""
import pytest
from sqlalchemy import select
from src.services.word_stats_service import record_stage_result
from src.services.word_service import create_word
from src.schemas.word import WordCreateRequest
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult
from src.models.player import Player
from src.models.game_session import GameSession


def _valid_word_payload(word: str = "테스트") -> WordCreateRequest:
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
    )


@pytest.mark.asyncio
async def test_first_play_inserts_new_row(db_session):
    player = Player(nickname="tester1")
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    word = await create_word(db_session, _valid_word_payload(word="단어1"))
    session = GameSession(nickname="tester1", score=100, stage=1, combo=5, stage_scores={"1": 100})
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    await record_stage_result(db_session, session.id, player.id, word.id, 1, 10, 2, 1, 100)
    await db_session.commit()

    ws = await db_session.scalar(
        select(WordStats).where(WordStats.player_id == player.id, WordStats.word_id == word.id)
    )
    assert ws is not None
    assert ws.exposure_count == 1
    assert ws.perfect_count == 10
    assert ws.good_count == 2
    assert ws.miss_count == 1
    assert ws.best_score == 100

    raw = await db_session.scalar(select(SessionWordResult).where(SessionWordResult.session_id == session.id))
    assert raw is not None
    assert raw.stage_score == 100
    assert raw.perfect_count == 10


@pytest.mark.asyncio
async def test_second_play_accumulates_and_keeps_max_best_score(db_session):
    player = Player(nickname="tester2")
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    word = await create_word(db_session, _valid_word_payload(word="단어2"))
    session = GameSession(nickname="tester2", score=100, stage=1, combo=5, stage_scores={"1": 100})
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    # 첫 번째 결과: 점수 50
    await record_stage_result(db_session, session.id, player.id, word.id, 1, 5, 0, 0, 50)
    await db_session.commit()
    # 두 번째 결과: 점수 200 (더 큼 → best_score 갱신)
    await record_stage_result(db_session, session.id, player.id, word.id, 1, 10, 1, 0, 200)
    await db_session.commit()
    # 세 번째 결과: 점수 30 (더 작음 → best_score 유지)
    await record_stage_result(db_session, session.id, player.id, word.id, 1, 3, 0, 2, 30)
    await db_session.commit()

    ws = await db_session.scalar(
        select(WordStats).where(WordStats.player_id == player.id, WordStats.word_id == word.id)
    )
    assert ws.exposure_count == 3
    assert ws.perfect_count == 18  # 5 + 10 + 3
    assert ws.good_count == 1
    assert ws.miss_count == 2
    assert ws.best_score == 200  # GREATEST(50, 200, 30)
