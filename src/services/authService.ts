const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || ''

/** HMAC-SHA256(timestamp, secretKey) → hex 서명 생성 */
async function generateSignature(timestamp: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(SECRET_KEY)
  const msgData = encoder.encode(timestamp)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 모든 API 요청 공통 fetch 래퍼 — HMAC 서명 자동 적용.
 * 네트워크 오류 시 'pickerpicker:offline' 이벤트 dispatch 후 throw.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders()
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined ?? {}) },
    })
    return res
  } catch (err) {
    window.dispatchEvent(new CustomEvent('pickerpicker:offline'))
    throw err
  }
}

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
    const res = await apiFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
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
      await apiFetch(`${BASE_URL}/auth/logout`, { method: 'POST' })
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

/** 모든 API 요청 공통 헤더 — Bearer 토큰 + HMAC 서명 */
export async function authHeaders(): Promise<Record<string, string>> {
  const timestamp = String(Date.now())
  const signature = await generateSignature(timestamp)
  const token = getStoredToken()
  return {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
