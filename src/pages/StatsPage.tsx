import { useNavigate } from 'react-router-dom'
import { StatsScreen } from '../features/stats/StatsScreen'
import { usePlayerStore } from '../store/playerStore'

/**
 * 통계 페이지 (`/stats`). 로그인 필요 — 라우트에서 RequireAuth로 감싼다.
 */
export function StatsPage() {
  const navigate = useNavigate()
  const nickname = usePlayerStore((s) => s.nickname)

  return <StatsScreen nickname={nickname} onBack={() => navigate('/')} />
}
