import { useEffect, useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { StartScreen } from './components/StartScreen'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { PracticeScreen } from './components/practice/PracticeScreen'
import { TutorialScreen } from './components/tutorial/TutorialScreen'
import { StatsScreen } from './components/StatsScreen'
import { AudioProvider, useAudioContext } from './contexts/AudioContext'
import { MobileWarningModal } from './components/common/MobileWarningModal'
import { WelcomeModal } from './components/common/WelcomeModal'
import { getPlayer, markTutorialSeen } from './services/playerService'

/** App.tsx 한정 화면 union — types/Screen 확장 없이 'practice', 'stats' 추가 */
type AppScreen = Screen | 'practice' | 'stats'

const LS_OFFSET_KEY = 'pickerpicker_offset'
const SS_MOBILE_WARNED_KEY = 'pickerpicker_mobile_warned'
const LS_NICKNAME_KEY = 'pickerpicker_nickname'
const LS_BEST_KEY = 'pickerpicker_best'
const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

function AppInner() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('start')
  const [afterTutorial, setAfterTutorial] = useState<AppScreen>('start')
  const audio = useAudioContext()

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
  const hasPlayedBefore = typeof window !== 'undefined' && localStorage.getItem(LS_BEST_KEY) !== null

  const [offset, setOffset] = useState<number>(() => {
    const saved = localStorage.getItem(LS_OFFSET_KEY)
    return saved ? Number(saved) : 0
  })

  const handleOffset = (v: number) => {
    const clamped = Math.max(-100, Math.min(100, v))
    setOffset(clamped)
    localStorage.setItem(LS_OFFSET_KEY, String(clamped))
  }

  // Welcome 모달 — PC 전용, sessionStorage 기반 세션당 1회
  const SS_WELCOME_KEY = 'pickerpicker_welcome_seen'
  const isMobile = window.innerWidth < 768
  const [showWelcome, setShowWelcome] = useState<boolean>(
    () => !isMobile && !sessionStorage.getItem(SS_WELCOME_KEY)
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

  // 화면 전환 시 BGM 제어
  useEffect(() => {
    if (currentScreen === 'ranking') {
      audio.playRankingBgm()
    } else if (currentScreen === 'start' && !showWelcome) {
      // Welcome 모달 없을 때만 (재방문 등) 즉시 BGM 시도
      audio.playStartBgm()
    }
    // game 화면 BGM은 GameScreen이 직접 제어
  }, [currentScreen])

  // localStorage에서 닉네임 복원 — 있으면 자동 로그인 상태
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem(LS_NICKNAME_KEY) ?? '')

  // tutorialSeen: 서버값 우선, API 실패 시 localStorage fallback
  const goToGameOrTutorial = (next: AppScreen, tutorialSeen?: boolean) => {
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
        .then(player => goToGameOrTutorial('game', player?.tutorial_seen))
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

  const handleLogout = () => {
    localStorage.removeItem(LS_NICKNAME_KEY)
    setNickname('')
  }

  const handleLoginComplete = (name: string, tutorialSeen: boolean) => {
    setNickname(name)
    localStorage.setItem(LS_NICKNAME_KEY, name)
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
          onRanking={() => setCurrentScreen('ranking')}
          onStart={handleStart}
          onPractice={() => {
            audio.ensureAudioCtx()
            setCurrentScreen('practice')
          }}
          onTutorial={handleTutorialOpen}
          hasPlayedBefore={hasPlayedBefore}
          isOffline={isOffline}
          bgmVolume={audio.bgmVolume}
          sfxOn={audio.sfxOn}
          onBgmVolume={audio.setBgmVol}
          onToggleSfx={audio.toggleSfx}
          offset={offset}
          onOffset={handleOffset}
          nickname={nickname}
          onLogout={handleLogout}
          onLoginComplete={handleLoginComplete}
          onStats={() => setCurrentScreen('stats')}
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
      {currentScreen === 'practice' && (
        <PracticeScreen
          onHome={() => {
            audio.stopBgm()
            setCurrentScreen('start')
          }}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
          onGameBgm={audio.playGameBgm}
          onStopBgm={audio.stopBgm}
          offset={offset}
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
            setCurrentScreen('ranking')
          }}
          onStats={() => {
            audio.stopBgm()
            setCurrentScreen('stats')
          }}
          onClearSfx={audio.playClearSfx}
          onGameOverSfx={audio.playGameOverSfx}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
          onGameBgm={audio.playGameBgm}
          offset={offset}
          onOffset={handleOffset}
          sfxOn={audio.sfxOn}
          onToggleSfx={audio.toggleSfx}
          bgmVolume={audio.bgmVolume}
          onBgmVolume={audio.setBgmVol}
        />
      )}
      {currentScreen === 'ranking' && (
        <RankingScreen nickname={nickname} onBack={() => setCurrentScreen('start')} />
      )}
      {currentScreen === 'stats' && (
        <StatsScreen
          nickname={nickname}
          onBack={() => setCurrentScreen('start')}
        />
      )}

      {showWelcome && (
        <WelcomeModal onClose={handleWelcomeClose} />
      )}

      {!showWelcome && showMobileWarning && (
        <MobileWarningModal onClose={handleMobileWarningClose} />
      )}
    </>
  )
}

export default function App() {
  return (
    <AudioProvider>
      <AppInner />
    </AudioProvider>
  )
}
