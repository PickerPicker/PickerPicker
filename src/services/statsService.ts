import { authHeaders } from './authService'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface MyStatsResponse {
  nickname: string
  totals: { play_count: number; best_score: number; best_stage: number; best_combo: number }
  averages: {
    avg_score: number
    median_score: number
    min_score: number
    avg_stage: number
    avg_combo: number
  }
  trend: {
    last_7_days_avg_score: number
    last_30_days_avg_score: number
    last_7_days_play_count: number
    last_30_days_play_count: number
  }
  percentile: { score: number; rank_top_pct: number }
  stage_best: { stage: number; best_score: number; reach_count: number }[]
  habit: {
    by_hour: { hour: number; count: number }[]
    session_gap_minutes: { avg: number; median: number }
  }
}

export interface GlobalStatsResponse {
  total_players: number
  total_sessions: number
  avg_score: number
  median_score: number
  score_distribution: { bucket: string; count: number }[]
}

export interface DailyEntry {
  date: string
  play_count: number
  max_score: number
  avg_score: number
}

/** 본인 통계. 401이면 null (재로그인 필요) */
export async function getMyStats(nickname: string): Promise<MyStatsResponse | null> {
  const res = await fetch(`${BASE_URL}/players/${encodeURIComponent(nickname)}/stats`, {
    headers: authHeaders(),
  })
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) throw new Error('통계 조회 실패')
  return res.json()
}

export async function getMySessions(nickname: string, days = 30): Promise<DailyEntry[] | null> {
  const res = await fetch(
    `${BASE_URL}/players/${encodeURIComponent(nickname)}/sessions?days=${days}`,
    { headers: authHeaders() },
  )
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) throw new Error('일별 시계열 조회 실패')
  const data = await res.json()
  return data.days as DailyEntry[]
}

export async function getGlobalStats(): Promise<GlobalStatsResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/stats/global`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
