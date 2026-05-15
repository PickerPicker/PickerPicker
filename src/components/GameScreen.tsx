import { useEffect, useState } from 'react'
import type { GameData, GamePhase, GameStat, StageData } from '../types'
import { GameHeader } from './game/GameHeader'
import { PlayStage } from './game/PlayStage'
import { PreviewStage } from './game/PreviewStage'

interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
}

const INITIAL_STAT: GameStat = {
  score: 0,
  gauge: 100,
  perfectCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  missCount: 0,
}

export function GameScreen({ nickname }: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)

  useEffect(() => {
    fetch('/rhythm_stages_001_015.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!gameData || gameData.stages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-error">
        스테이지 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const currentStage: StageData = gameData.stages[stageIndex]

  const handlePreviewEnd = () => setPhase('playing')

  const handleStatUpdate = (update: Partial<GameStat>) => {
    setStat(prev => ({ ...prev, ...update }))
  }

  const handleStageComplete = () => {
    const nextIndex = stageIndex + 1
    if (nextIndex >= gameData.stages.length) {
      setPhase('result')
    } else {
      setStageIndex(nextIndex)
      setPhase('preview')
    }
  }

  const handleGameOver = () => {
    setPhase('result')
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h2 className="text-4xl font-black text-primary">
          {stageIndex >= gameData.stages.length - 1 ? 'ALL CLEAR' : 'GAME OVER'}
        </h2>
        <div className="text-center space-y-1 text-base-content/70">
          <p>Score: {stat.score}</p>
          <p>PERFECT: {stat.perfectCount} / GOOD: {stat.goodCount} / MISS: {stat.missCount}</p>
          <p>{nickname}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setStageIndex(0)
            setStat(INITIAL_STAT)
            setPhase('preview')
          }}
        >
          다시 하기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <GameHeader
        stage={currentStage.stage}
        word={currentStage.word}
        gauge={stat.gauge}
        score={stat.score}
      />

      {phase === 'preview' && (
        <PreviewStage
          stageData={currentStage}
          onPreviewEnd={handlePreviewEnd}
        />
      )}

      {phase === 'playing' && (
        <PlayStage
          stageData={currentStage}
          stat={stat}
          onStatUpdate={handleStatUpdate}
          onStageComplete={handleStageComplete}
          onGameOver={handleGameOver}
        />
      )}
    </div>
  )
}
