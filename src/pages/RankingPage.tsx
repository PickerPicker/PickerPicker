import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RankingScreen } from '../features/ranking/RankingScreen'
import { useAudioContext } from '../contexts/AudioContext'
import { usePlayerStore } from '../store/playerStore'

/**
 * 랭킹 페이지 (`/ranking`). 공개 — 가드 없음.
 * 기존 App.tsx에서 ranking 화면 진입 시 랭킹 BGM을 재생하던 동작을 마운트 시 재현한다.
 */
export function RankingPage() {
  const navigate = useNavigate()
  const audio = useAudioContext()
  const nickname = usePlayerStore((s) => s.nickname)

  useEffect(() => {
    audio.playRankingBgm()
    return () => audio.stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <RankingScreen nickname={nickname} onBack={() => navigate('/')} />
}
