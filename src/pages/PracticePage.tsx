import { useNavigate } from 'react-router-dom'
import { PracticeScreen } from '../features/practice/PracticeScreen'
import { useAudioContext } from '../contexts/AudioContext'
import { usePlayerStore } from '../store/playerStore'

/**
 * 연습 페이지 (`/practice`). 게임 1회+ 플레이 필요 — 라우트에서 RequirePlayed로 감싼다.
 */
export function PracticePage() {
  const navigate = useNavigate()
  const audio = useAudioContext()
  const offset = usePlayerStore((s) => s.offset)

  return (
    <PracticeScreen
      onHome={() => {
        audio.stopBgm()
        navigate('/')
      }}
      onHitSfx={audio.playHitSfx}
      onMissSfx={audio.playMissSfx}
      onGameBgm={audio.playGameBgm}
      onStopBgm={audio.stopBgm}
      offset={offset}
    />
  )
}
