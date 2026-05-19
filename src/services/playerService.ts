import { apiFetch } from './authService'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface PlayerRecord {
  nickname: string
  best_score: number
  best_stage: number
  best_combo: number
  play_count: number
  tutorial_seen: boolean
}

export interface RankingEntry extends PlayerRecord {
  rank: number
}

/** 닉네임 존재 여부 — true: 기존 플레이어. 서버 연결 실패 시 false 반환 */
export async function checkNickname(nickname: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/check/${encodeURIComponent(nickname)}`)
    if (!res.ok) return false
    const data = await res.json()
    return data.exists
  } catch {
    return false
  }
}

/** 신규 플레이어 등록 (PIN 포함). 409 Conflict 시 null 반환 */
export async function createPlayer(nickname: string, pin: string): Promise<PlayerRecord | null> {
  try {
    const res = await apiFetch(`${BASE_URL}/players`, {
      method: 'POST',
      body: JSON.stringify({ nickname, pin }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** PIN 검증. true = 성공, false = 불일치 또는 서버 오류 */
export async function verifyPin(nickname: string, pin: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ nickname, pin }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.success
  } catch {
    return false
  }
}

/** 플레이어 조회 (역대 최고 기록) */
export async function getPlayer(nickname: string): Promise<PlayerRecord | null> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/${encodeURIComponent(nickname)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error('플레이어 조회 실패')
    return res.json()
  } catch {
    return null
  }
}

/** 게임 결과 저장. 서버 실패 시 로컬 기록 기반 폴백 반환 */
export async function saveGameResult(params: {
  nickname: string
  score: number
  stage: number
  combo: number
  stage_scores?: Record<string, number>
}): Promise<PlayerRecord> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/result`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error('결과 저장 실패')
    return res.json()
  } catch {
    const raw = localStorage.getItem('pickerpicker_best')
    const local = raw ? JSON.parse(raw) : { bestScore: 0, bestStage: 0, bestCombo: 0 }
    return {
      nickname: params.nickname,
      best_score: Math.max(local.bestScore ?? 0, params.score),
      best_stage: Math.max(local.bestStage ?? 0, params.stage),
      best_combo: Math.max(local.bestCombo ?? 0, params.combo),
      play_count: 0,
      tutorial_seen: true,
    }
  }
}

/** 튜토리얼 시청 완료 서버 기록. 실패 시 null (fallback은 호출부에서 처리) */
export async function markTutorialSeen(nickname: string): Promise<PlayerRecord | null> {
  try {
    const res = await apiFetch(
      `${BASE_URL}/players/${encodeURIComponent(nickname)}/tutorial-seen`,
      { method: 'PATCH' },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** 랭킹 조회 */
export async function getRanking(limit = 20, offset = 0): Promise<RankingEntry[]> {
  try {
    const res = await apiFetch(`${BASE_URL}/ranking?limit=${limit}&offset=${offset}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
