import { useEffect, useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname, createPlayer, verifyPin } from './services/playerService'
import { StartScreen } from './components/StartScreen'
import { NicknameModal } from './components/NicknameModal'
import { PinModal } from './components/PinModal'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { PracticeScreen } from './components/practice/PracticeScreen'
import { TutorialScreen } from './components/tutorial/TutorialScreen'
import { AudioProvider, useAudioContext } from './contexts/AudioContext'

/** PIN 입력 단계 */
type PinStep = 'login' | 'create' | 'confirm'

/** App.tsx 한정 화면 union — types/Screen 확장 없이 'practice' 추가 */
type AppScreen = Screen | 'practice'

const LS_OFFSET_KEY = 'pickerpicker_offset'
const LS_NICKNAME_KEY = 'pickerpicker_nickname'
const LS_BEST_KEY = 'pickerpicker_best'
const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

function AppInner() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('start')
  const [afterTutorial, setAfterTutorial] = useState<AppScreen>('start')
  const audio = useAudioContext()

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

  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [pinStep, setPinStep] = useState<PinStep | null>(null)
  // localStorage에서 닉네임 복원 — 있으면 자동 로그인 상태
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem(LS_NICKNAME_KEY) ?? '')
  const [pendingPin, setPendingPin] = useState('')   // 신규 생성 시 첫 입력 임시 보관
  const [isNewPlayer, setIsNewPlayer] = useState(true)

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
    // 이미 로그인된 경우 바로 게임 진입 (튜토리얼 미경험 시 자동 노출)
    if (nickname) {
      goToGameOrTutorial('game')
      return
    }
    setShowNicknameModal(true)
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

  const resetModals = () => {
    setShowNicknameModal(false)
    setPinStep(null)
    setPendingPin('')
  }

  /** 닉네임 확인 후 PIN 단계 자동 분기 */
  const handleNicknameConfirm = async (name: string) => {
    setNickname(name)
    const exists = await checkNickname(name)
    setShowNicknameModal(false)
    setPinStep(exists ? 'login' : 'create')
    setIsNewPlayer(!exists)
  }

  /** PinModal 성공 콜백 */
  const handlePinSuccess = async (pin: string) => {
    if (pinStep === 'login') {
      localStorage.setItem(LS_NICKNAME_KEY, nickname)
      resetModals()
      goToGameOrTutorial('game')
    } else if (pinStep === 'create') {
      // 신규 — 확인 단계로
      setPendingPin(pin)
      setPinStep('confirm')
    } else if (pinStep === 'confirm') {
      // PIN 불일치 시 처음부터 다시
      if (pin !== pendingPin) {
        setPendingPin('')
        setPinStep('create')
        return
      }
      await createPlayer(nickname, pin)
      localStorage.setItem(LS_NICKNAME_KEY, nickname)
      resetModals()
      goToGameOrTutorial('game')
    }
  }

  /** 닉네임 다시 입력 */
  const handleBack = () => {
    resetModals()
    setNickname('')
    setShowNicknameModal(true)
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
        />
      )}
      {currentScreen === 'tutorial' && (
        <TutorialScreen
          onComplete={handleTutorialComplete}
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
          isNewPlayer={isNewPlayer}
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

      {showNicknameModal && (
        <NicknameModal
          onConfirm={handleNicknameConfirm}
          onClose={() => setShowNicknameModal(false)}
        />
      )}

      {pinStep === 'login' && (
        <PinModal
          nickname={nickname}
          mode="login"
          onSuccess={handlePinSuccess}
          onBack={handleBack}
          verifyPin={(pin) => verifyPin(nickname, pin)}
        />
      )}
      {pinStep === 'create' && (
        <PinModal
          nickname={nickname}
          mode="create"
          onSuccess={handlePinSuccess}
          onBack={handleBack}
        />
      )}
      {pinStep === 'confirm' && (
        <PinModal
          nickname={nickname}
          mode="confirm"
          onSuccess={handlePinSuccess}
          onBack={handleBack}
        />
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
