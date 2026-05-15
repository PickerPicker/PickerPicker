const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface PlayerRecord {
  nickname: string
  best_score: number
  best_stage: number
  best_combo: number
  play_count: number
}

export interface RankingEntry extends PlayerRecord {
  rank: number
}

/** 닉네임 존재 여부 — true: 기존 플레이어. 서버 연결 실패 시 false 반환 */
export async function checkNickname(nickname: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/players/check/${encodeURIComponent(nickname)}`)
    if (!res.ok) return false
    const data = await res.json()
    return data.exists
  } catch {
    return false
  }
}

/** 신규 플레이어 등록. 서버 연결 실패 시 에러를 throw하지 않음 */
export async function createPlayer(nickname: string): Promise<PlayerRecord | null> {
  try {
    const res = await fetch(`${BASE_URL}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** 플레이어 조회 (역대 최고 기록) */
export async function getPlayer(nickname: string): Promise<PlayerRecord | null> {
  const res = await fetch(`${BASE_URL}/players/${encodeURIComponent(nickname)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('플레이어 조회 실패')
  return res.json()
}

/** 게임 결과 저장 */
export async function saveGameResult(params: {
  nickname: string
  score: number
  stage: number
  combo: number
}): Promise<PlayerRecord> {
  const res = await fetch(`${BASE_URL}/players/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('결과 저장 실패')
  return res.json()
}

/** 랭킹 조회 */
export async function getRanking(limit = 10): Promise<RankingEntry[]> {
  const res = await fetch(`${BASE_URL}/ranking?limit=${limit}`)
  if (!res.ok) return []
  return res.json()
}
