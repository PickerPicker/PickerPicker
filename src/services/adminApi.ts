import type { Word, AdminUser, WordGlobalStat, AdminOverview } from '../types/admin'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || ''

const SS_ADMIN_TOKEN_KEY = 'pickerpicker_admin_token'
const SS_ADMIN_TOKEN_USER_KEY = 'pickerpicker_admin_username'
const SS_ADMIN_TOKEN_EXP_KEY = 'pickerpicker_admin_token_expires_at'

async function hmacSignature(timestamp: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(timestamp))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getAdminToken(): string | null {
  const tok = sessionStorage.getItem(SS_ADMIN_TOKEN_KEY)
  const exp = sessionStorage.getItem(SS_ADMIN_TOKEN_EXP_KEY)
  if (!tok || !exp) return null
  if (new Date(exp).getTime() < Date.now()) {
    sessionStorage.removeItem(SS_ADMIN_TOKEN_KEY)
    sessionStorage.removeItem(SS_ADMIN_TOKEN_USER_KEY)
    sessionStorage.removeItem(SS_ADMIN_TOKEN_EXP_KEY)
    return null
  }
  return tok
}

export function getAdminUsername(): string | null {
  if (!getAdminToken()) return null
  return sessionStorage.getItem(SS_ADMIN_TOKEN_USER_KEY)
}

async function adminHeaders(): Promise<Record<string, string>> {
  const timestamp = String(Date.now())
  const signature = await hmacSignature(timestamp)
  const token = getAdminToken()
  return {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = await adminHeaders()
  return fetch(url, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string> | undefined) ?? {}) },
  })
}

export async function adminLogin(username: string, password: string): Promise<boolean> {
  const r = await adminFetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) return false
  const data = await r.json()
  sessionStorage.setItem(SS_ADMIN_TOKEN_KEY, data.token)
  sessionStorage.setItem(SS_ADMIN_TOKEN_USER_KEY, username)
  sessionStorage.setItem(SS_ADMIN_TOKEN_EXP_KEY, data.expires_at)
  return true
}

export async function adminLogout(): Promise<void> {
  const tok = getAdminToken()
  if (tok) {
    try {
      await adminFetch(`${BASE_URL}/admin/auth/logout`, { method: 'POST' })
    } catch {
      // 서버 로그아웃 실패해도 로컬 토큰은 아래에서 정리한다
    }
  }
  sessionStorage.removeItem(SS_ADMIN_TOKEN_KEY)
  sessionStorage.removeItem(SS_ADMIN_TOKEN_USER_KEY)
  sessionStorage.removeItem(SS_ADMIN_TOKEN_EXP_KEY)
}

export function isAdminLoggedIn(): boolean {
  return getAdminToken() !== null
}

export async function listWords(params?: {
  difficulty?: number
  is_active?: boolean
}): Promise<Word[]> {
  const q = new URLSearchParams()
  if (params?.difficulty !== undefined) q.set('difficulty', String(params.difficulty))
  if (params?.is_active !== undefined) q.set('is_active', String(params.is_active))
  const r = await adminFetch(`${BASE_URL}/admin/words?${q}`)
  if (!r.ok) throw new Error(`list_words_failed: ${r.status}`)
  return r.json()
}

export async function getWord(id: number): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`)
  if (!r.ok) throw new Error(`get_word_failed: ${r.status}`)
  return r.json()
}

export async function createWord(payload: Omit<Word, 'id' | 'is_active'>): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`create_word_failed: ${r.status} ${detail}`)
  }
  return r.json()
}

export async function updateWord(
  id: number,
  payload: Omit<Word, 'id' | 'is_active'>,
): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`update_word_failed: ${r.status}`)
  return r.json()
}

export async function deleteWord(id: number): Promise<void> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`delete_word_failed: ${r.status}`)
}

export async function listAdmins(): Promise<AdminUser[]> {
  const r = await adminFetch(`${BASE_URL}/admin/admins`)
  if (!r.ok) throw new Error(`list_admins_failed: ${r.status}`)
  return r.json()
}

export async function createAdmin(username: string, password: string): Promise<AdminUser> {
  const r = await adminFetch(`${BASE_URL}/admin/admins`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`create_admin_failed: ${r.status} ${detail}`)
  }
  return r.json()
}

export async function globalWordStats(
  sort: 'exposure_desc' | 'accuracy_asc' | 'accuracy_desc' = 'exposure_desc',
): Promise<WordGlobalStat[]> {
  const r = await adminFetch(`${BASE_URL}/admin/stats/words?sort=${sort}&limit=50`)
  if (!r.ok) throw new Error(`stats_words_failed: ${r.status}`)
  return r.json()
}

export async function adminOverview(): Promise<AdminOverview> {
  const r = await adminFetch(`${BASE_URL}/admin/stats/overview`)
  if (!r.ok) throw new Error(`stats_overview_failed: ${r.status}`)
  return r.json()
}
