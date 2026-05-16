const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const SS_TOKEN_KEY = 'pickerpicker_token'
const SS_TOKEN_NICK_KEY = 'pickerpicker_token_nickname'
const SS_TOKEN_EXP_KEY = 'pickerpicker_token_expires_at'

export interface LoginResult {
  token: string
  expires_at: string
}

/** PIN 검증 후 세션 토큰 발급. 실패 시 null */
export async function login(nickname: string, pin: string): Promise<LoginResult | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, pin }),
    })
    if (!res.ok) return null
    const data: LoginResult = await res.json()
    sessionStorage.setItem(SS_TOKEN_KEY, data.token)
    sessionStorage.setItem(SS_TOKEN_NICK_KEY, nickname)
    sessionStorage.setItem(SS_TOKEN_EXP_KEY, data.expires_at)
    return data
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  const token = sessionStorage.getItem(SS_TOKEN_KEY)
  if (token) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { /* ignore */ }
  }
  sessionStorage.removeItem(SS_TOKEN_KEY)
  sessionStorage.removeItem(SS_TOKEN_NICK_KEY)
  sessionStorage.removeItem(SS_TOKEN_EXP_KEY)
}

export function getStoredToken(): string | null {
  const token = sessionStorage.getItem(SS_TOKEN_KEY)
  const exp = sessionStorage.getItem(SS_TOKEN_EXP_KEY)
  if (!token || !exp) return null
  if (new Date(exp).getTime() < Date.now()) {
    sessionStorage.removeItem(SS_TOKEN_KEY)
    sessionStorage.removeItem(SS_TOKEN_NICK_KEY)
    sessionStorage.removeItem(SS_TOKEN_EXP_KEY)
    return null
  }
  return token
}

export function getStoredTokenNickname(): string | null {
  if (!getStoredToken()) return null
  return sessionStorage.getItem(SS_TOKEN_NICK_KEY)
}

export function authHeaders(): HeadersInit {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
