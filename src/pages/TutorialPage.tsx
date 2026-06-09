import { useNavigate } from 'react-router-dom'
import { TutorialScreen } from '../features/tutorial/TutorialScreen'
import { useAudioContext } from '../contexts/AudioContext'

const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

/**
 * 독립 튜토리얼 페이지 (`/tutorial`).
 *
 * 게임 자동 진입 흐름(StartScreen → 게임 진입 직전 튜토리얼)은 HomePage가 상태로 처리한다.
 * 이 라우트는 공유·북마크용 단독 튜토리얼이므로, 완료/종료 시 홈으로 돌아간다
 * (READY 카운트다운 없음).
 */
export function TutorialPage() {
  const navigate = useNavigate()
  const audio = useAudioContext()

  const finish = () => {
    localStorage.setItem(LS_TUTORIAL_KEY, 'true')
    navigate('/')
  }

  return (
    <TutorialScreen
      onComplete={finish}
      onExit={finish}
      showReadyCountdown={false}
      onHitSfx={audio.playHitSfx}
      onMissSfx={audio.playMissSfx}
    />
  )
}
