import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { showToast } from '../../store/toastStore'

const LS_BEST_KEY = 'pickerpicker_best'

function hasPlayedBefore(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_BEST_KEY) !== null
}

/**
 * 본 게임 1회 이상 플레이 필요 라우트 가드(연습 모드 노출 조건).
 * 미플레이 시 홈(/)으로 리다이렉트하며 토스트로 안내한다.
 */
export function RequirePlayed({ children }: { children: ReactNode }) {
  const played = hasPlayedBefore()

  useEffect(() => {
    if (!played) showToast('게임을 한 번 이상 플레이해야 이용할 수 있습니다', 'warning')
  }, [played])

  if (!played) return <Navigate to="/" replace />
  return <>{children}</>
}
