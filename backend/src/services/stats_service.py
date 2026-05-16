"""src.services.stats_service
통계 집계 — 개인/전체/시계열.
"""
import logging
import time
from datetime import datetime, date, timedelta
from collections import defaultdict
from sqlalchemy import select, func, and_, cast, Float
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.player import Player
from src.models.game_session import GameSession
from src.models.player_stats_daily import PlayerStatsDaily

logger = logging.getLogger(__name__)

# 5분 인메모리 캐시 (단일 프로세스)
_GLOBAL_CACHE: dict[str, tuple[float, dict]] = {}
GLOBAL_TTL_SEC = 300


async def get_player_stats(db: AsyncSession, nickname: str) -> dict:
    """개인 종합 통계."""
    # players 기본 정보
    p_res = await db.execute(select(Player).where(Player.nickname == nickname))
    player = p_res.scalar_one_or_none()
    if not player:
        return {
            "nickname": nickname,
            "totals": {"play_count": 0, "best_score": 0, "best_stage": 0, "best_combo": 0},
            "averages": {},
            "trend": {},
            "percentile": {},
            "stage_best": [],
            "habit": {"by_hour": [], "session_gap_minutes": {}},
        }

    today = date.today()
    d7 = today - timedelta(days=7)
    d30 = today - timedelta(days=30)

    # 평균/총합 (player_stats_daily 전체 합산)
    agg_res = await db.execute(
        select(
            func.coalesce(func.sum(PlayerStatsDaily.play_count), 0),
            func.coalesce(func.sum(PlayerStatsDaily.sum_score), 0),
        ).where(PlayerStatsDaily.nickname == nickname)
    )
    total_play, total_sum = agg_res.one()
    avg_score = (total_sum / total_play) if total_play else 0

    # 7일/30일 평균 (sum_score / play_count)
    async def _window_avg(since: date) -> tuple[float, int]:
        r = await db.execute(
            select(
                func.coalesce(func.sum(PlayerStatsDaily.play_count), 0),
                func.coalesce(func.sum(PlayerStatsDaily.sum_score), 0),
            ).where(
                and_(
                    PlayerStatsDaily.nickname == nickname,
                    PlayerStatsDaily.date >= since,
                )
            )
        )
        pc, ss = r.one()
        return ((ss / pc) if pc else 0.0), pc

    avg7, play7 = await _window_avg(d7)
    avg30, play30 = await _window_avg(d30)

    # 중앙값/최저 (game_sessions 최근 30일 기준)
    med_res = await db.execute(
        select(
            func.percentile_cont(0.5).within_group(GameSession.score.asc()),
            func.min(GameSession.score),
            func.avg(cast(GameSession.stage, Float)),
            func.avg(cast(GameSession.combo, Float)),
        ).where(
            and_(
                GameSession.nickname == nickname,
                GameSession.played_at >= datetime.utcnow() - timedelta(days=30),
            )
        )
    )
    median_score, min_score, avg_stage, avg_combo = med_res.one()

    # 백분위 (players.best_score 분포)
    # 백분위: 본인보다 낮은 best_score 플레이어 수 / 전체
    below_res = await db.execute(
        select(func.count()).select_from(Player).where(Player.best_score < player.best_score)
    )
    below = below_res.scalar() or 0
    total_res = await db.execute(select(func.count()).select_from(Player))
    total = total_res.scalar() or 0
    percentile = (below / total) if total else 0.0
    rank_top_pct = round((1 - percentile) * 100, 1)

    # 스테이지별 최고점/도달 횟수 (stage_scores JSONB 순회)
    ss_res = await db.execute(
        select(GameSession.stage_scores).where(GameSession.nickname == nickname)
    )
    stage_best_map: dict[int, dict] = defaultdict(lambda: {"best_score": 0, "reach_count": 0})
    for row in ss_res.scalars().all():
        if not row:
            continue
        for k, v in row.items():
            try:
                stage_num = int(k)
                score_v = int(v)
            except (TypeError, ValueError):
                continue
            e = stage_best_map[stage_num]
            e["best_score"] = max(e["best_score"], score_v)
            e["reach_count"] += 1

    stage_best = [
        {"stage": s, "best_score": v["best_score"], "reach_count": v["reach_count"]}
        for s, v in sorted(stage_best_map.items())
    ]

    # 시간대별 (최근 30일 game_sessions)
    hour_res = await db.execute(
        select(
            func.extract("hour", GameSession.played_at).label("h"),
            func.count(),
        ).where(
            and_(
                GameSession.nickname == nickname,
                GameSession.played_at >= datetime.utcnow() - timedelta(days=30),
            )
        ).group_by("h")
    )
    by_hour_map = {int(h): int(c) for h, c in hour_res.all()}
    by_hour = [{"hour": h, "count": by_hour_map.get(h, 0)} for h in range(24)]

    # 세션 간격 (연속 played_at 차이)
    gap_res = await db.execute(
        select(GameSession.played_at)
        .where(GameSession.nickname == nickname)
        .order_by(GameSession.played_at.asc())
    )
    times = list(gap_res.scalars().all())
    gaps_min: list[float] = []
    for i in range(1, len(times)):
        delta = (times[i] - times[i - 1]).total_seconds() / 60
        if delta > 0:
            gaps_min.append(delta)
    if gaps_min:
        gaps_sorted = sorted(gaps_min)
        median_gap = gaps_sorted[len(gaps_sorted) // 2]
        avg_gap = sum(gaps_min) / len(gaps_min)
    else:
        median_gap = 0.0
        avg_gap = 0.0

    return {
        "nickname": nickname,
        "totals": {
            "play_count": player.play_count,
            "best_score": player.best_score,
            "best_stage": player.best_stage,
            "best_combo": player.best_combo,
        },
        "averages": {
            "avg_score": round(avg_score, 1),
            "median_score": round(float(median_score), 1) if median_score is not None else 0,
            "min_score": int(min_score or 0),
            "avg_stage": round(float(avg_stage), 2) if avg_stage is not None else 0,
            "avg_combo": round(float(avg_combo), 2) if avg_combo is not None else 0,
        },
        "trend": {
            "last_7_days_avg_score": round(avg7, 1),
            "last_30_days_avg_score": round(avg30, 1),
            "last_7_days_play_count": int(play7),
            "last_30_days_play_count": int(play30),
        },
        "percentile": {
            "score": round(percentile, 4),
            "rank_top_pct": rank_top_pct,
        },
        "stage_best": stage_best,
        "habit": {
            "by_hour": by_hour,
            "session_gap_minutes": {
                "avg": round(avg_gap, 1),
                "median": round(median_gap, 1),
            },
        },
    }


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
