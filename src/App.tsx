import { useEffect, useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { StartScreen } from './components/StartScreen'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { PracticeScreen } from './components/practice/PracticeScreen'
import { TutorialScreen } from './components/tutorial/TutorialScreen'
import { AudioProvider, useAudioContext } from './contexts/AudioContext'
import { MobileWarningModal } from './components/common/MobileWarningModal'

/** App.tsx 한정 화면 union — types/Screen 확장 없이 'practice' 추가 */
type AppScreen = Screen | 'practice'

const LS_OFFSET_KEY = 'pickerpicker_offset'
const SS_MOBILE_WARNED_KEY = 'pickerpicker_mobile_warned'
const LS_NICKNAME_KEY = 'pickerpicker_nickname'
const LS_BEST_KEY = 'pickerpicker_best'
const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

function AppInner() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('start')
  const [afterTutorial, setAfterTutorial] = useState<AppScreen>('start')
  const audio = useAudioContext()

  // 모바일 감지 — 세션당 1회만 표시
  const [showMobileWarning, setShowMobileWarning] = useState<boolean>(() => {
    if (sessionStorage.getItem(SS_MOBILE_WARNED_KEY)) return false
    return window.innerWidth < 768
  })

  const handleMobileWarningClose = () => {
    sessionStorage.setItem(SS_MOBILE_WARNED_KEY, 'true')
    setShowMobileWarning(false)
  }

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

  // 화면 전환 시 BGM 제어
  useEffect(() => {
    if (currentScreen === 'start') {
      audio.playStartBgm()
    } else if (currentScreen === 'ranking') {
      audio.playRankingBgm()
    }
    // game 화면 BGM은 GameScreen이 직접 제어
  }, [currentScreen])

  // localStorage에서 닉네임 복원 — 있으면 자동 로그인 상태
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem(LS_NICKNAME_KEY) ?? '')

  const goToGameOrTutorial = (next: AppScreen) => {
    if (!localStorage.getItem(LS_TUTORIAL_KEY)) {
      setAfterTutorial(next)
      setCurrentScreen('tutorial')
    } else {
      setCurrentScreen(next)
    }
  }

  const handleStart = () => {
    audio.ensureAudioCtx()
    if (nickname) {
      goToGameOrTutorial('game')
    }
    // 비로그인 시 StartScreen 내부에서 처리
  }

  const handleTutorialOpen = () => {
    audio.ensureAudioCtx()
    setAfterTutorial('start')
    setCurrentScreen('tutorial')
  }

  const handleTutorialComplete = () => {
    localStorage.setItem(LS_TUTORIAL_KEY, 'true')
    setCurrentScreen(afterTutorial)
  }

  const handleLogout = () => {
    localStorage.removeItem(LS_NICKNAME_KEY)
    setNickname('')
  }

  const handleLoginComplete = (name: string) => {
    setNickname(name)
    localStorage.setItem(LS_NICKNAME_KEY, name)
    goToGameOrTutorial('game')
  }

  return (
    <>
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
          bgmVolume={audio.bgmVolume}
          sfxOn={audio.sfxOn}
          onBgmVolume={audio.setBgmVol}
          onToggleSfx={audio.toggleSfx}
          offset={offset}
          onOffset={handleOffset}
          nickname={nickname}
          onLogout={handleLogout}
          onLoginComplete={handleLoginComplete}
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
          onClearSfx={audio.playClearSfx}
          onGameOverSfx={audio.playGameOverSfx}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
          onGameBgm={audio.playGameBgm}
          offset={offset}
        />
      )}
      {currentScreen === 'ranking' && (
        <RankingScreen onBack={() => setCurrentScreen('start')} />
      )}

      {showMobileWarning && (
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
