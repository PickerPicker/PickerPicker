import { useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname } from './services/playerService'
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
      setShowPlayerTypeModal(true)
    } else {
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

  const handleNewPlayer = () => {
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
      {currentScreen === 'ranking' && <RankingScreen />}

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
