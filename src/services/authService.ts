const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || ''

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 서명 대상 문자열 조립 — 백엔드 `build_signature_message()`와 순서가 반드시 일치해야 한다.
 *
 * timestamp만 서명하면 서명 1개로 유효기간(5분) 동안 모든 경로·본문을 호출할 수 있어
 * 메서드/경로/쿼리/본문해시를 함께 묶는다.
 * path는 백엔드 ASGI scope["path"](퍼센트 디코딩된 값)와 맞추기 위해 디코딩해서 넣는다.
 */
async function buildSignatureMessage(
  timestamp: string,
  method: string,
  url: string,
  body: string,
): Promise<string> {
  const parsed = new URL(url, window.location.origin)
  const path = decodeURIComponent(parsed.pathname)
  const query = parsed.search.replace(/^\?/, '')
  const bodyHash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))
  return [timestamp, method.toUpperCase(), path, query, bodyHash].join('\n')
}

/** HMAC-SHA256(message, secretKey) → hex 서명 생성 */
async function signMessage(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
}

/**
 * 모든 API 요청 공통 fetch 래퍼 — HMAC 서명 자동 적용.
 * 네트워크 오류 시 'pickerpicker:offline' 이벤트 dispatch 후 throw.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const body = typeof init.body === 'string' ? init.body : ''
  const headers = await authHeaders(method, url, body)
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string> | undefined) ?? {}) },
    })
    return res
  } catch (err) {
    window.dispatchEvent(new CustomEvent('pickerpicker:offline'))
    throw err
  }
}

// 토큰은 localStorage에 둔다 — 닉네임(localStorage)과 수명이 어긋나면
// "로그인 상태인데 토큰 없음" 불일치가 생겨 본인 전용 API가 전부 401이 된다.
// 실제 만료는 서버가 발급한 expires_at으로 판정한다.
const LS_TOKEN_KEY = 'pickerpicker_token'
const LS_TOKEN_NICK_KEY = 'pickerpicker_token_nickname'
const LS_TOKEN_EXP_KEY = 'pickerpicker_token_expires_at'

function clearStoredToken(): void {
  localStorage.removeItem(LS_TOKEN_KEY)
  localStorage.removeItem(LS_TOKEN_NICK_KEY)
  localStorage.removeItem(LS_TOKEN_EXP_KEY)
}

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
    localStorage.setItem(LS_TOKEN_KEY, data.token)
    localStorage.setItem(LS_TOKEN_NICK_KEY, nickname)
    localStorage.setItem(LS_TOKEN_EXP_KEY, data.expires_at)
    return data
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  if (localStorage.getItem(LS_TOKEN_KEY)) {
    try {
      await apiFetch(`${BASE_URL}/auth/logout`, { method: 'POST' })
    } catch {
      /* ignore */
    }
  }
  clearStoredToken()
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(LS_TOKEN_KEY)
  const exp = localStorage.getItem(LS_TOKEN_EXP_KEY)
  if (!token || !exp) return null
  if (new Date(exp).getTime() < Date.now()) {
    clearStoredToken()
    return null
  }
  return token
}

export function getStoredTokenNickname(): string | null {
  if (!getStoredToken()) return null
  return localStorage.getItem(LS_TOKEN_NICK_KEY)
}

/**
 * HMAC 서명 헤더만 생성 (Bearer 토큰 제외).
 * 어드민처럼 별도 토큰 체계를 쓰는 클라이언트가 서명 로직을 재사용하기 위해 분리했다.
 */
export async function signatureHeaders(
  method: string,
  url: string,
  body: string,
): Promise<Record<string, string>> {
  const timestamp = String(Date.now())
  const signature = await signMessage(await buildSignatureMessage(timestamp, method, url, body))
  return { 'X-Timestamp': timestamp, 'X-Signature': signature }
}

/** 모든 API 요청 공통 헤더 — Bearer 토큰 + HMAC 서명 */
export async function authHeaders(
  method = 'GET',
  url = '/',
  body = '',
): Promise<Record<string, string>> {
  const token = getStoredToken()
  return {
    'Content-Type': 'application/json',
    ...(await signatureHeaders(method, url, body)),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
