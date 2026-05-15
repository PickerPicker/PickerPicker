import { useEffect, useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname, createPlayer, verifyPin } from './services/playerService'
import { StartScreen } from './components/StartScreen'
import { NicknameModal } from './components/NicknameModal'
import { PinModal } from './components/PinModal'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { useAudio } from './hooks/useAudio'

/** PIN 입력 단계 */
type PinStep = 'login' | 'create' | 'confirm'

const LS_OFFSET_KEY = 'pickerpicker_offset'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start')
  const audio = useAudio()

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
    if (currentScreen === 'start' || currentScreen === 'ranking') {
      audio.playStartBgm()
    }
    // game 화면 BGM은 GameScreen이 직접 제어
  }, [currentScreen])

  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [pinStep, setPinStep] = useState<PinStep | null>(null)
  const [nickname, setNickname] = useState('')
  const [pendingPin, setPendingPin] = useState('')   // 신규 생성 시 첫 입력 임시 보관
  const [isNewPlayer, setIsNewPlayer] = useState(true)

  const handleStart = () => {
    // 첫 클릭 시 AudioContext 초기화 + SFX 프리로드 시작
    audio.ensureAudioCtx()
    audio.playButtonSfx()
    setShowNicknameModal(true)
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
      // 검증은 PinModal 내부(verifyPin prop)에서 완료 후 호출됨
      resetModals()
      setCurrentScreen('game')
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
      resetModals()
      setCurrentScreen('game')
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
          onRanking={() => {
            audio.playButtonSfx()
            setCurrentScreen('ranking')
          }}
          onStart={handleStart}
          bgmVolume={audio.bgmVolume}
          sfxOn={audio.sfxOn}
          onBgmVolume={audio.setBgmVol}
          onToggleSfx={audio.toggleSfx}
          offset={offset}
          onOffset={handleOffset}
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
          onButtonSfx={audio.playButtonSfx}
          onClearSfx={audio.playClearSfx}
          onGameOverSfx={audio.playGameOverSfx}
          onHitSfx={audio.playHitSfx}
          onMissSfx={audio.playMissSfx}
          onGameBgm={audio.playGameBgm}
          offset={offset}
        />
      )}
      {currentScreen === 'ranking' && (
        <RankingScreen
          onBack={() => {
            audio.playButtonSfx()
            setCurrentScreen('start')
          }}
        />
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

export default App
