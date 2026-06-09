import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePlayerStore } from '../../store/playerStore'
import { showToast } from '../../store/toastStore'

/**
 * 로그인(닉네임) 필요 라우트 가드.
 * 비로그인 시 홈(/)으로 리다이렉트하며 토스트로 안내한다.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const nickname = usePlayerStore((s) => s.nickname)

  useEffect(() => {
    if (!nickname) showToast('로그인이 필요합니다', 'warning')
  }, [nickname])

  if (!nickname) return <Navigate to="/" replace />
  return <>{children}</>
}
