import { create } from 'zustand'
import { setStatsVisibility } from '../services/statsService'
import { getStoredToken, logout as revokeSession } from '../services/authService'
import { showToast } from './toastStore'

/**
 * 플레이어 전역 상태 — 기존 App.tsx에 흩어져 있던 nickname/offset/isStatsPublic을 통합.
 * localStorage 동기화는 액션 내부에서 처리하여 컴포넌트가 신경 쓸 필요 없게 한다.
 */

const LS_NICKNAME_KEY = 'pickerpicker_nickname'
const LS_OFFSET_KEY = 'pickerpicker_offset'

function readInitialNickname(): string {
  if (typeof window === 'undefined') return ''
  const saved = localStorage.getItem(LS_NICKNAME_KEY) ?? ''
  // 토큰이 없거나 만료됐으면 로그인 상태로 두지 않는다.
  // 닉네임만 남아 있으면 본인 전용 API가 전부 401이 나면서 원인을 알기 어려워진다.
  if (saved && !getStoredToken()) {
    localStorage.removeItem(LS_NICKNAME_KEY)
    return ''
  }
  return saved
}

function readInitialOffset(): number {
  if (typeof window === 'undefined') return 0
  const saved = localStorage.getItem(LS_OFFSET_KEY)
  return saved ? Number(saved) : 0
}

interface PlayerState {
  /** 로그인된 닉네임. 빈 문자열이면 비로그인. */
  nickname: string
  /** 싱크 보정 오프셋(ms). [-100, 100] clamp. */
  offset: number
  /** 통계 공개 여부. 서버값(getPlayer.is_stats_public)을 진실 소스로 초기화. 기본 공개. */
  isStatsPublic: boolean

  setNickname: (nickname: string) => void
  logout: () => void
  setOffset: (offset: number) => void
  /** 서버값으로 통계 공개 여부를 동기화(낙관적 토글과 구분). */
  setStatsPublic: (isPublic: boolean) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  nickname: readInitialNickname(),
  offset: readInitialOffset(),
  isStatsPublic: true,

  setNickname: (nickname) => {
    localStorage.setItem(LS_NICKNAME_KEY, nickname)
    set({ nickname })
  },

  logout: () => {
    localStorage.removeItem(LS_NICKNAME_KEY)
    set({ nickname: '' })
    // 서버 세션도 폐기 (실패해도 로컬 로그아웃은 이미 완료된 상태)
    void revokeSession()
  },

  setOffset: (offset) => {
    const clamped = Math.max(-100, Math.min(100, offset))
    localStorage.setItem(LS_OFFSET_KEY, String(clamped))
    set({ offset: clamped })
  },

  setStatsPublic: (isPublic) => set({ isStatsPublic: isPublic }),
}))

/**
 * 통계 공개 토글 — 낙관적 업데이트 후 서버 반영, 실패 시 롤백.
 *
 * 스토어 액션이 아니라 별도 함수인 이유: 스토어는 상태만 관리하고 통신은 하지 않는다.
 * (스토어가 네트워크까지 겸하면 테스트·재사용이 어려워진다)
 */
export async function toggleStatsPublic(): Promise<boolean> {
  const { nickname, isStatsPublic, setStatsPublic } = usePlayerStore.getState()
  if (!nickname) return false

  const next = !isStatsPublic
  setStatsPublic(next) // 낙관적 반영
  const ok = await setStatsVisibility(nickname, next)
  if (!ok) {
    setStatsPublic(!next) // 롤백
    showToast('설정을 저장하지 못했습니다', 'warning')
  }
  return ok
}
