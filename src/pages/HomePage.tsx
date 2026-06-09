import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StartScreen } from '../features/player/StartScreen'
import { GameScreen } from '../features/game/GameScreen'
import { TutorialScreen } from '../features/tutorial/TutorialScreen'
import { useAudioContext } from '../contexts/AudioContext'
import { MobileWarningModal } from '../components/common/MobileWarningModal'
import { WelcomeModal } from '../components/common/WelcomeModal'
import { getPlayer, markTutorialSeen } from '../services/playerService'
import { usePlayerStore } from '../store/playerStore'

/**
 * 홈 페이지 (`/`).
 *
 * 설계 A안: 공유·새로고침이 필요한 화면(ranking/stats/practice 등)만 URL을 갖고,
 * 게임 내부 플로우(start ↔ tutorial ↔ game)는 진행 상태가 메모리에만 있으므로
 * URL 없이 로컬 상태로 렌더한다. 기존 App.tsx의 AppInner 플로우 로직을 그대로 이사하되,
 * - nickname/offset/isStatsPublic은 zustand playerStore로,
 * - ranking/stats/practice 이동은 navigate로 교체했다.
 */

/** HomePage 한정 내부 화면 — URL을 갖지 않는 게임 플로우 단계 */
type HomeScreen = 'start' | 'tutorial' | 'game'

const SS_MOBILE_WARNED_KEY = 'pickerpicker_mobile_warned'
const LS_BEST_KEY = 'pickerpicker_best'
const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

export function HomePage() {
  const navigate = useNavigate()
  const audio = useAudioContext()

  const nickname = usePlayerStore((s) => s.nickname)
  const offset = usePlayerStore((s) => s.offset)
  const isStatsPublic = usePlayerStore((s) => s.isStatsPublic)
  const setNickname = usePlayerStore((s) => s.setNickname)
  const logout = usePlayerStore((s) => s.logout)
  const setOffset = usePlayerStore((s) => s.setOffset)
  const setStatsPublic = usePlayerStore((s) => s.setStatsPublic)
  const toggleStatsPublic = usePlayerStore((s) => s.toggleStatsPublic)

  const [currentScreen, setCurrentScreen] = useState<HomeScreen>('start')
  const [afterTutorial, setAfterTutorial] = useState<HomeScreen>('start')

  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)
    window.addEventListener('pickerpicker:offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('pickerpicker:offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // 모바일 감지 — 세션당 1회만 표시
  const [showMobileWarning, setShowMobileWarning] = useState<boolean>(() => {
    if (sessionStorage.getItem(SS_MOBILE_WARNED_KEY)) return false
    return window.innerWidth < 768
  })

  // 본 게임 1회 이상 플레이 여부 — 연습모드 노출 조건
  const hasPlayedBefore =
    typeof window !== 'undefined' && localStorage.getItem(LS_BEST_KEY) !== null

  // Welcome 모달 — PC 전용, sessionStorage 기반 세션당 1회
  const SS_WELCOME_KEY = 'pickerpicker_welcome_seen'
  const isMobile = window.innerWidth < 768
  const [showWelcome, setShowWelcome] = useState<boolean>(
    () => !isMobile && !sessionStorage.getItem(SS_WELCOME_KEY),
  )

  const handleWelcomeClose = () => {
    sessionStorage.setItem(SS_WELCOME_KEY, 'true')
    setShowWelcome(false)
    audio.playStartBgm()
  }

  const handleMobileWarningClose = () => {
    sessionStorage.setItem(SS_MOBILE_WARNED_KEY, 'true')
    setShowMobileWarning(false)
    // 모바일도 첫 인터랙션 → BGM 시작
    audio.playStartBgm()
  }

  // 화면 전환 시 BGM 제어 — start 진입 시 BGM (Welcome 모달 없을 때만)
  useEffect(() => {
    if (currentScreen === 'start' && !showWelcome) {
      audio.playStartBgm()
    }
    // game 화면 BGM은 GameScreen이 직접 제어
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen])

  // 로그인 상태면 서버에서 통계 공개 여부 초기화
  useEffect(() => {
    if (!nickname) return
    getPlayer(nickname)
      .then((player) => {
        if (player && typeof player.is_stats_public === 'boolean') {
          setStatsPublic(player.is_stats_public)
        }
      })
      .catch(() => {})
  }, [nickname, setStatsPublic])

  // tutorialSeen: 서버값 우선, API 실패 시 localStorage fallback
  const goToGameOrTutorial = (next: HomeScreen, tutorialSeen?: boolean) => {
    const seen = tutorialSeen ?? !!localStorage.getItem(LS_TUTORIAL_KEY)
    if (!seen) {
      setAfterTutorial(next)
      setCurrentScreen('tutorial')
    } else {
      setCurrentScreen(next)
    }
  }

  const handleStart = () => {
    audio.ensureAudioCtx()
    if (nickname) {
      // 이미 로그인된 사용자 — 서버에서 tutorial_seen 조회
      getPlayer(nickname)
        .then((player) => goToGameOrTutorial('game', player?.tutorial_seen))
        .catch(() => goToGameOrTutorial('game'))
    }
    // 비로그인 시 StartScreen 내부에서 처리
  }

  const handleTutorialOpen = () => {
    audio.ensureAudioCtx()
    setAfterTutorial('start')
    setCurrentScreen('tutorial')
  }

  const handleTutorialComplete = () => {
    // 서버 기록 시도 + localStorage 동기화 (fallback)
    if (nickname) {
      markTutorialSeen(nickname).catch(() => {})
    }
    localStorage.setItem(LS_TUTORIAL_KEY, 'true')
    setCurrentScreen(afterTutorial)
  }

  const handleLoginComplete = (name: string, tutorialSeen: boolean) => {
    setNickname(name)
    goToGameOrTutorial('game', tutorialSeen)
  }

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-content text-center text-xs py-1 font-bold tracking-wide">
          서버 연결 끊김 — 기록이 저장되지 않습니다
        </div>
      )}
      {currentScreen === 'start' && (
        <StartScreen
          onRanking={() => navigate('/ranking')}
          onStart={handleStart}
          onPractice={() => {
            audio.ensureAudioCtx()
            navigate('/practice')
          }}
          onTutorial={handleTutorialOpen}
          hasPlayedBefore={hasPlayedBefore}
          isOffline={isOffline}
          bgmVolume={audio.bgmVolume}
          sfxOn={audio.sfxOn}
          onBgmVolume={audio.setBgmVol}
          onToggleSfx={audio.toggleSfx}
          offset={offset}
          onOffset={setOffset}
          nickname={nickname}
          onLogout={logout}
          onLoginComplete={handleLoginComplete}
          onStats={() => navigate('/stats')}
          isStatsPublic={isStatsPublic}
          onToggleStatsPublic={toggleStatsPublic}
        />
      )}
      {currentScreen === 'tutorial' && (
        <TutorialScreen
          onComplete={handleTutorialComplete}
          onExit={() => {
            localStorage.setItem(LS_TUTORIAL_KEY, 'true')
            setCurrentScreen(afterTutorial === 'game' ? 'game' : 'start')
          }}
          showReadyCountdown={afterTutorial === 'game'}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
        />
      )}
      {currentScreen === 'game' && (
        <GameScreen
          nickname={nickname}
          isNewPlayer={false}
          onHome={() => {
            audio.stopBgm()
            setCurrentScreen('start')
          }}
          onRanking={() => {
            audio.stopBgm()
            navigate('/ranking')
          }}
          onStats={() => {
            audio.stopBgm()
            navigate('/stats')
          }}
          onClearSfx={audio.playClearSfx}
          onGameOverSfx={audio.playGameOverSfx}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
          onGameBgm={audio.playGameBgm}
          offset={offset}
          onOffset={setOffset}
          sfxOn={audio.sfxOn}
          onToggleSfx={audio.toggleSfx}
          bgmVolume={audio.bgmVolume}
          onBgmVolume={audio.setBgmVol}
        />
      )}

      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}

      {!showWelcome && showMobileWarning && (
        <MobileWarningModal onClose={handleMobileWarningClose} />
      )}
    </>
  )
}
