import { apiFetch } from './authService'
import { showToast } from '../store/toastStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface PlayerRecord {
  nickname: string
  best_score: number
  best_stage: number
  best_combo: number
  play_count: number
  tutorial_seen: boolean
  is_new_champion?: boolean
  is_stats_public?: boolean
}

export interface StageResultItem {
  word_id: number
  stage_index: number
  perfect_count: number
  good_count: number
  miss_count: number
  stage_score: number
}

export interface HallOfFameEntry {
  nickname: string
  score: number
  started_at: string
  ended_at: string | null
  motto: string | null
  days: number
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
  stage_results?: StageResultItem[]
}): Promise<PlayerRecord> {
  try {
    const res = await apiFetch(`${BASE_URL}/players/result`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
    if (res.ok) return res.json()
    // 서버 저장 실패는 반드시 알린다 — 로컬 fallback으로 조용히 넘어가면
    // 플레이어는 기록이 랭킹에 반영된 줄 안다.
    showToast(
      res.status === 401
        ? '로그인이 만료되어 기록이 저장되지 않았습니다. 다시 로그인해주세요'
        : '기록을 서버에 저장하지 못했습니다',
      'warning',
    )
  } catch {
    showToast('오프라인 상태여서 기록이 서버에 저장되지 않았습니다', 'warning')
  }

  // 저장 실패 시에도 결과 화면은 로컬 최고 기록으로 그린다
  const raw = localStorage.getItem('pickerpicker_best')
  const local = raw ? JSON.parse(raw) : { bestScore: 0, bestStage: 0, bestCombo: 0 }
  return {
    nickname: params.nickname,
    best_score: Math.max(local.bestScore ?? 0, params.score),
    best_stage: Math.max(local.bestStage ?? 0, params.stage),
    best_combo: Math.max(local.bestCombo ?? 0, params.combo),
    play_count: 0,
    tutorial_seen: true,
    is_new_champion: false,
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

/** 명예의 전당 목록 조회 */
export async function getHallOfFame(): Promise<HallOfFameEntry[]> {
  try {
    const res = await apiFetch(`${BASE_URL}/hall-of-fame`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/** 한마디 수정 — Bearer 토큰 필수 (authService.ts에서 자동 첨부). 성공 시 true */
export async function updateMotto(motto: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${BASE_URL}/hall-of-fame/motto`, {
      method: 'PATCH',
      body: JSON.stringify({ motto }),
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}
