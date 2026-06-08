import { apiFetch } from './authService'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface WordSummary {
  id: number
  word: string
  difficulty_level: number
  exposure_count: number
  accuracy: number
}

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
  words?: {
    played: number
    most_played: WordSummary[]
    hardest: WordSummary[]
    easiest: WordSummary[]
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

export async function getMyStats(nickname: string): Promise<MyStatsResponse | null> {
  const res = await apiFetch(`${BASE_URL}/players/${encodeURIComponent(nickname)}/stats`)
  if (!res.ok) throw new Error('통계 조회 실패')
  return res.json()
}

export async function getMySessions(nickname: string, days = 30): Promise<DailyEntry[] | null> {
  const res = await apiFetch(
    `${BASE_URL}/players/${encodeURIComponent(nickname)}/sessions?days=${days}`,
  )
  if (!res.ok) throw new Error('일별 시계열 조회 실패')
  const data = await res.json()
  return data.days as DailyEntry[]
}

/** 랭킹에서 다른 사람의 요약 통계. 비공개면 is_public=false. */
export interface PublicStatsResponse {
  is_public: boolean
  nickname: string
  motto?: string | null
  totals?: { play_count: number; best_score: number; best_stage: number; best_combo: number }
  averages?: { avg_score: number }
  percentile?: { rank_top_pct: number }
}

/** 공개 요약 통계 조회 (HMAC만 필요). 실패 시 null */
export async function getPublicStats(nickname: string): Promise<PublicStatsResponse | null> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/${encodeURIComponent(nickname)}/public-stats`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** 본인 통계 공개/비공개 전환 — Bearer 토큰 필수 (authService가 자동 첨부). 성공 시 true */
export async function setStatsVisibility(isPublic: boolean): Promise<boolean> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/me/stats-visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ is_public: isPublic }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getGlobalStats(): Promise<GlobalStatsResponse | null> {
  try {
    const res = await apiFetch(`${BASE_URL}/stats/global`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
