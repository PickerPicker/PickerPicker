"""src.services.stats_service
통계 집계 — 개인/공개/전체/시계열.

집계는 가능한 한 SQL에서 끝낸다. 과거에는 유저의 전체 game_sessions(JSONB 포함)를
파이썬으로 끌어와 순회했기 때문에 플레이 횟수에 비례해 느려졌다.
"""
import logging
import time
from datetime import date, timedelta
from sqlalchemy import select, func, and_, cast, Float, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.timeutil import utcnow
from src.models.player import Player
from src.models.game_session import GameSession
from src.models.player_stats_daily import PlayerStatsDaily
from src.models.word import Word
from src.models.word_stats import WordStats

logger = logging.getLogger(__name__)

# 5분 인메모리 캐시 (단일 프로세스)
_GLOBAL_CACHE: dict[str, tuple[float, dict]] = {}
GLOBAL_TTL_SEC = 300

# 최근 활동 집계 기준 기간. habit·stage_best·session_gap 모두 이 창을 쓴다.
RECENT_DAYS = 30


def _empty_stats(nickname: str) -> dict:
    return {
        "nickname": nickname,
        "totals": {"play_count": 0, "best_score": 0, "best_stage": 0, "best_combo": 0},
        "averages": {},
        "trend": {},
        "percentile": {},
        "stage_best": [],
        "habit": {"by_hour": [], "session_gap_minutes": {}},
        "words": {"played": 0, "most_played": [], "hardest": [], "easiest": []},
    }


async def _daily_aggregates(db: AsyncSession, nickname: str) -> tuple[float, dict]:
    """player_stats_daily 기반 전체 평균 + 7일/30일 추세.

    FILTER 절로 3개 쿼리(전체/7일/30일)를 하나로 합쳤다.
    """
    today = date.today()
    res = await db.execute(
        text("""
            SELECT
              COALESCE(SUM(play_count), 0)                                  AS total_play,
              COALESCE(SUM(sum_score), 0)                                   AS total_sum,
              COALESCE(SUM(play_count) FILTER (WHERE date >= :d7), 0)       AS play7,
              COALESCE(SUM(sum_score)  FILTER (WHERE date >= :d7), 0)       AS sum7,
              COALESCE(SUM(play_count) FILTER (WHERE date >= :d30), 0)      AS play30,
              COALESCE(SUM(sum_score)  FILTER (WHERE date >= :d30), 0)      AS sum30
            FROM player_stats_daily
            WHERE nickname = :nickname
        """),
        {
            "nickname": nickname,
            "d7": today - timedelta(days=7),
            "d30": today - timedelta(days=RECENT_DAYS),
        },
    )
    total_play, total_sum, play7, sum7, play30, sum30 = res.one()

    avg_score = (total_sum / total_play) if total_play else 0
    trend = {
        "last_7_days_avg_score": round((sum7 / play7) if play7 else 0.0, 1),
        "last_30_days_avg_score": round((sum30 / play30) if play30 else 0.0, 1),
        "last_7_days_play_count": int(play7),
        "last_30_days_play_count": int(play30),
    }
    return avg_score, trend


async def _score_averages(db: AsyncSession, nickname: str, avg_score: float) -> dict:
    """최근 30일 game_sessions 기준 중앙값/최저/평균 스테이지·콤보."""
    res = await db.execute(
        select(
            func.percentile_cont(0.5).within_group(GameSession.score.asc()),
            func.min(GameSession.score),
            func.avg(cast(GameSession.stage, Float)),
            func.avg(cast(GameSession.combo, Float)),
        ).where(
            and_(
                GameSession.nickname == nickname,
                GameSession.played_at >= utcnow() - timedelta(days=RECENT_DAYS),
            )
        )
    )
    median_score, min_score, avg_stage, avg_combo = res.one()
    return {
        "avg_score": round(avg_score, 1),
        "median_score": round(float(median_score), 1) if median_score is not None else 0,
        "min_score": int(min_score or 0),
        "avg_stage": round(float(avg_stage), 2) if avg_stage is not None else 0,
        "avg_combo": round(float(avg_combo), 2) if avg_combo is not None else 0,
    }


async def _percentile(db: AsyncSession, best_score: int) -> dict:
    """players.best_score 분포에서의 위치. COUNT FILTER로 2개 쿼리를 하나로 합쳤다."""
    res = await db.execute(
        text("""
            SELECT
              COUNT(*) FILTER (WHERE best_score < :my) AS below,
              COUNT(*)                                 AS total
            FROM players
        """),
        {"my": best_score},
    )
    below, total = res.one()
    percentile = (below / total) if total else 0.0
    return {
        "score": round(percentile, 4),
        "rank_top_pct": round((1 - percentile) * 100, 1),
    }


async def _stage_best(db: AsyncSession, nickname: str) -> list[dict]:
    """스테이지별 최고점/도달 횟수.

    과거에는 유저의 전체 세션 JSONB를 파이썬으로 끌어와 순회했다.
    jsonb_each_text로 DB에서 펼쳐 집계하고 최근 30일로 제한한다.
    키가 숫자가 아닌 이상 데이터는 정규식으로 걸러낸다.
    """
    res = await db.execute(
        text("""
            SELECT
              (kv.key)::int              AS stage,
              MAX((kv.value)::int)       AS best_score,
              COUNT(*)                   AS reach_count
            FROM game_sessions gs
            CROSS JOIN LATERAL jsonb_each_text(gs.stage_scores) AS kv
            WHERE gs.nickname = :nickname
              AND gs.played_at >= :since
              AND kv.key ~ '^[0-9]+$'
              AND kv.value ~ '^-?[0-9]+$'
            GROUP BY (kv.key)::int
            ORDER BY (kv.key)::int
        """),
        {"nickname": nickname, "since": utcnow() - timedelta(days=RECENT_DAYS)},
    )
    return [
        {"stage": int(stage), "best_score": int(best), "reach_count": int(cnt)}
        for stage, best, cnt in res.all()
    ]


async def _habit(db: AsyncSession, nickname: str) -> dict:
    """시간대별 플레이 분포 + 세션 간격. 민감 정보라 본인에게만 노출한다."""
    since = utcnow() - timedelta(days=RECENT_DAYS)

    hour_res = await db.execute(
        select(
            func.extract("hour", GameSession.played_at).label("h"),
            func.count(),
        )
        .where(and_(GameSession.nickname == nickname, GameSession.played_at >= since))
        .group_by("h")
    )
    by_hour_map = {int(h): int(c) for h, c in hour_res.all()}
    by_hour = [{"hour": h, "count": by_hour_map.get(h, 0)} for h in range(24)]

    # 세션 간격: 과거에는 전체 played_at을 파이썬으로 가져와 루프를 돌렸다.
    # LAG window function으로 DB에서 계산한다.
    # 중앙값은 percentile_cont(보간)이라 기존 파이썬 구현(상위 중앙값)과
    # 짝수 표본에서 값이 미세하게 다를 수 있다.
    gap_res = await db.execute(
        text("""
            WITH gaps AS (
              SELECT EXTRACT(EPOCH FROM (
                       played_at - LAG(played_at) OVER (ORDER BY played_at)
                     )) / 60.0 AS gap_min
              FROM game_sessions
              WHERE nickname = :nickname AND played_at >= :since
            )
            SELECT
              COALESCE(AVG(gap_min), 0)                                        AS avg_gap,
              COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_min), 0) AS median_gap
            FROM gaps
            WHERE gap_min > 0
        """),
        {"nickname": nickname, "since": since},
    )
    avg_gap, median_gap = gap_res.one()

    return {
        "by_hour": by_hour,
        "session_gap_minutes": {
            "avg": round(float(avg_gap or 0), 1),
            "median": round(float(median_gap or 0), 1),
        },
    }


async def player_word_stats(
    db: AsyncSession, player_id: int, include_hardest: bool = True
) -> dict:
    """본인 단어별 분석 — 많이 만난/어려운/잘하는 TOP5.

    include_hardest=False면 약점 단어(hardest)를 아예 조회하지 않는다.
    공개 통계에서는 응답에 담지도 않을 값을 계산할 이유가 없다.
    """
    perfect = WordStats.perfect_count
    good = WordStats.good_count
    miss = WordStats.miss_count
    total_judg = perfect + good + miss
    accuracy_expr = (perfect + good * 0.5) / func.nullif(total_judg, 0)

    base = (
        select(
            Word.id, Word.word, Word.difficulty_level,
            WordStats.exposure_count,
            accuracy_expr.label("accuracy"),
        )
        .join(WordStats, WordStats.word_id == Word.id)
        .where(WordStats.player_id == player_id)
    )

    most_played = (await db.execute(base.order_by(WordStats.exposure_count.desc()).limit(5))).all()
    easiest = (await db.execute(
        base.where(WordStats.exposure_count >= 3).order_by(accuracy_expr.desc()).limit(5)
    )).all()
    hardest = []
    if include_hardest:
        hardest = (await db.execute(
            base.where(WordStats.exposure_count >= 3).order_by(accuracy_expr.asc()).limit(5)
        )).all()

    total_played = await db.scalar(
        select(func.count()).select_from(WordStats).where(WordStats.player_id == player_id)
    ) or 0

    def fmt(rows):
        return [
            {
                "id": r.id,
                "word": r.word,
                "difficulty_level": r.difficulty_level,
                "exposure_count": int(r.exposure_count),
                "accuracy": float(r.accuracy or 0),
            }
            for r in rows
        ]

    result = {
        "played": int(total_played),
        "most_played": fmt(most_played),
        "easiest": fmt(easiest),
    }
    if include_hardest:
        result["hardest"] = fmt(hardest)
    return result


async def _core_stats(db: AsyncSession, player: Player) -> dict:
    """개인/공개 통계가 공유하는 부분 (민감 항목 제외)."""
    nickname = player.nickname
    avg_score, trend = await _daily_aggregates(db, nickname)
    return {
        "nickname": nickname,
        "totals": {
            "play_count": player.play_count,
            "best_score": player.best_score,
            "best_stage": player.best_stage,
            "best_combo": player.best_combo,
        },
        "averages": await _score_averages(db, nickname, avg_score),
        "trend": trend,
        "percentile": await _percentile(db, player.best_score),
        "stage_best": await _stage_best(db, nickname),
    }


async def get_player_stats(db: AsyncSession, nickname: str) -> dict:
    """개인 종합 통계 (본인 전용 — habit·약점단어 포함)."""
    player = await db.scalar(select(Player).where(Player.nickname == nickname))
    if not player:
        return _empty_stats(nickname)

    stats = await _core_stats(db, player)
    stats["habit"] = await _habit(db, nickname)
    stats["words"] = await player_word_stats(db, player.id, include_hardest=True)
    return stats


async def get_public_stats(db: AsyncSession, nickname: str) -> dict | None:
    """랭킹에서 다른 사람이 보는 공개 통계. 플레이어가 없으면 None.

    민감 항목(habit, words.hardest)은 **계산 자체를 하지 않는다.**
    과거에는 전체 통계를 계산한 뒤 버려서, 트래픽이 가장 많은 랭킹 화면이
    가장 비싼 쿼리를 유발했다.
    """
    player = await db.scalar(select(Player).where(Player.nickname == nickname))
    if not player:
        return None

    stats = await _core_stats(db, player)
    stats["motto"] = player.motto
    stats["words"] = await player_word_stats(db, player.id, include_hardest=False)
    return stats


async def get_global_stats(db: AsyncSession) -> dict:
    """전체 통계. 5분 캐시."""
    cached = _GLOBAL_CACHE.get("global")
    now_ts = time.time()
    if cached and (now_ts - cached[0]) < GLOBAL_TTL_SEC:
        return cached[1]

    total_players_res = await db.execute(select(func.count()).select_from(Player))
    total_players = total_players_res.scalar() or 0

    sess_agg_res = await db.execute(
        select(
            func.count(),
            func.coalesce(func.avg(cast(GameSession.score, Float)), 0),
            func.percentile_cont(0.5).within_group(GameSession.score.asc()),
        )
    )
    total_sessions, avg_score, median_score = sess_agg_res.one()

    # 점수 분포 — 1000점 단위 버킷
    dist_res = await db.execute(
        select(
            (GameSession.score / 1000).label("bucket"),
            func.count(),
        ).group_by("bucket").order_by("bucket")
    )
    score_distribution = []
    for bucket, cnt in dist_res.all():
        lo = int(bucket) * 1000
        score_distribution.append({
            "bucket": f"{lo}-{lo + 999}",
            "count": int(cnt),
        })

    data = {
        "total_players": int(total_players),
        "total_sessions": int(total_sessions or 0),
        "avg_score": round(float(avg_score or 0), 1),
        "median_score": round(float(median_score or 0), 1),
        "score_distribution": score_distribution,
    }
    _GLOBAL_CACHE["global"] = (now_ts, data)
    return data


async def get_player_sessions_by_day(
    db: AsyncSession, nickname: str, days: int
) -> list[dict]:
    """일별 시계열. player_stats_daily에서 최근 N일."""
    since = date.today() - timedelta(days=days)
    res = await db.execute(
        select(
            PlayerStatsDaily.date,
            PlayerStatsDaily.play_count,
            PlayerStatsDaily.sum_score,
            PlayerStatsDaily.max_score,
        ).where(
            and_(
                PlayerStatsDaily.nickname == nickname,
                PlayerStatsDaily.date >= since,
            )
        ).order_by(PlayerStatsDaily.date.asc())
    )
    result = []
    for d, pc, ss, ms in res.all():
        avg = round((ss / pc), 1) if pc else 0
        result.append({
            "date": d.isoformat(),
            "play_count": int(pc),
            "max_score": int(ms),
            "avg_score": avg,
        })
    return result
