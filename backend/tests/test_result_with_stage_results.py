"""POST /players/result + stage_results 통합 테스트.

save_game_result 서비스 직접 호출로 트랜잭션 동작 검증:
- session 생성 후 stage_results raw INSERT
- word_stats UPSERT
- stage_results 누락 시에도 기존 동작 그대로 (호환성)
"""
import pytest
import pytest_asyncio
from sqlalchemy import select
from src.services.player_service import save_game_result
from src.services.word_service import create_word
from src.schemas.word import WordCreateRequest
from src.core.exceptions import NotFoundError
from src.models.player import Player
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult


def _word_payload(word: str) -> WordCreateRequest:
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


class _StageResult:
    """StageResultItem pydantic 대용 더미 — 속성 접근만 지원."""
    def __init__(self, word_id, stage_index, perfect_count, good_count, miss_count, stage_score):
        self.word_id = word_id
        self.stage_index = stage_index
        self.perfect_count = perfect_count
        self.good_count = good_count
        self.miss_count = miss_count
        self.stage_score = stage_score


async def _register(db_session, nickname: str) -> Player:
    """결과 저장은 등록된 플레이어만 가능하므로 미리 생성해둔다."""
    player = Player(nickname=nickname)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)
    return player


@pytest.mark.asyncio
async def test_save_result_persists_stage_results(db_session):
    await _register(db_session, "tester")
    w1 = await create_word(db_session, _word_payload(word="단어A"))
    w2 = await create_word(db_session, _word_payload(word="단어B"))
    w3 = await create_word(db_session, _word_payload(word="단어C"))

    stage_results = [
        _StageResult(w1.id, 1, 10, 0, 0, 100),
        _StageResult(w2.id, 2, 8, 2, 0, 100),
        _StageResult(w3.id, 3, 5, 3, 2, 100),
    ]

    outcome = await save_game_result(
        db_session,
        nickname="tester",
        score=300,
        stage=3,
        combo=10,
        stage_scores={"1": 100, "2": 100, "3": 100},
        stage_results=stage_results,
    )
    player = outcome.player
    assert player.nickname == "tester"
    assert outcome.is_new_champion is True, "첫 기록이므로 챔피언 등극"

    swrs = (await db_session.execute(select(SessionWordResult))).scalars().all()
    assert len(swrs) == 3

    wss = (await db_session.execute(
        select(WordStats).where(WordStats.player_id == player.id)
    )).scalars().all()
    assert len(wss) == 3


@pytest.mark.asyncio
async def test_save_result_without_stage_results_still_works(db_session):
    """기존 호출(stage_results 누락) 호환성 확인."""
    await _register(db_session, "tester2")
    outcome = await save_game_result(
        db_session,
        nickname="tester2",
        score=100,
        stage=1,
        combo=5,
        stage_scores={"1": 100},
        # stage_results 인자 누락
    )
    assert outcome.player.nickname == "tester2"

    swrs = (await db_session.execute(select(SessionWordResult))).scalars().all()
    assert len(swrs) == 0


@pytest.mark.asyncio
async def test_save_result_rejects_unregistered_nickname(db_session):
    """미등록 닉네임으로는 결과를 저장할 수 없다.

    과거에는 여기서 PIN 없는 계정이 자동 생성됐고, 그 계정을 아무나 선점할 수 있었다.
    (#155 유령 계정 차단 / #156 PIN 선점 차단)
    """
    with pytest.raises(NotFoundError):
        await save_game_result(
            db_session,
            nickname="존재하지않는유저",
            score=100,
            stage=1,
            combo=5,
        )

    players = (await db_session.execute(select(Player))).scalars().all()
    assert len(players) == 0, "실패한 저장이 계정을 만들면 안 된다"
