import { useEffect, useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname, createPlayer } from './services/playerService'
import { StartScreen } from './components/StartScreen'
import { NicknameModal } from './components/NicknameModal'
import { PlayerTypeModal } from './components/PlayerTypeModal'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { useAudio } from './hooks/useAudio'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start')
  const audio = useAudio()

  // 화면 전환 시 BGM 제어
  useEffect(() => {
    if (currentScreen === 'start' || currentScreen === 'ranking') {
      audio.playStartBgm()
    }
    // game 화면 BGM은 GameScreen이 직접 제어
  }, [currentScreen])
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showPlayerTypeModal, setShowPlayerTypeModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [isNewPlayer, setIsNewPlayer] = useState(true)

  const handleStart = () => {
    audio.playButtonSfx()
    setShowNicknameModal(true)
  }

  const handleNicknameConfirm = async (name: string) => {
    setNickname(name)
    const exists = await checkNickname(name)
    if (exists) {
      // 기존 플레이어 → 기존/신규 선택 팝업
      setShowPlayerTypeModal(true)
    } else {
      // 신규 플레이어 → DB 등록 후 게임 시작
      try {
        await createPlayer(name)
      } catch {
        // 이미 등록된 경우 무시 (동시 요청 등 예외)
      }
      setIsNewPlayer(true)
      setShowNicknameModal(false)
      setCurrentScreen('game')
    }
  }

  const handleExistingPlayer = () => {
    setIsNewPlayer(false)
    setShowNicknameModal(false)
    setShowPlayerTypeModal(false)
    setCurrentScreen('game')
  }

  const handleNewPlayer = async () => {
    // 기존 닉네임으로 신규 플레이 선택 — DB에는 이미 있으므로 등록 불필요
    setIsNewPlayer(true)
    setShowNicknameModal(false)
    setShowPlayerTypeModal(false)
    setCurrentScreen('game')
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
          onNoteSfx={audio.playNoteSfx}
          onGameBgm={audio.playGameBgm}
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
      {showPlayerTypeModal && (
        <PlayerTypeModal
          nickname={nickname}
          onExisting={handleExistingPlayer}
          onNew={handleNewPlayer}
          onClose={() => setShowPlayerTypeModal(false)}
        />
      )}
    </>
  )
}

export default App
