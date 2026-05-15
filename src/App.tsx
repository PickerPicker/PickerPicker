import { useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname, createPlayer } from './services/playerService'
import { StartScreen } from './components/StartScreen'
import { NicknameModal } from './components/NicknameModal'
import { PlayerTypeModal } from './components/PlayerTypeModal'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start')
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showPlayerTypeModal, setShowPlayerTypeModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [isNewPlayer, setIsNewPlayer] = useState(true)

  const handleStart = () => setShowNicknameModal(true)

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
          onRanking={() => setCurrentScreen('ranking')}
          onStart={handleStart}
        />
      )}
      {currentScreen === 'game' && (
        <GameScreen nickname={nickname} isNewPlayer={isNewPlayer} />
      )}
      {currentScreen === 'ranking' && <RankingScreen onBack={() => setCurrentScreen('start')} />}

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
