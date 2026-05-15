import { useEffect, useMemo, useRef, useState } from 'react'
import type { BestRecord, GameData, GamePhase, GameStat, KeyMapping, StageData } from '../types'
import { saveGameResult } from '../services/playerService'
import { GameHeader } from './game/GameHeader'
import { PlayStage } from './game/PlayStage'
import { PreviewStage } from './game/PreviewStage'

const LS_KEY = 'pickerpicker_best'

const INITIAL_STAT: GameStat = {
  score: 0,
  gauge: 100,
  perfectCombo: 0,
  maxCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  missCount: 0,
}

function shuffleKeyMapping(keyMapping: KeyMapping[]): KeyMapping[] {
  const entries = keyMapping.map(k => ({ syllable: k.syllable, type: k.type }))
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  return keyMapping.map((k, i) => ({ ...k, syllable: entries[i].syllable, type: entries[i].type }))
}

function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as BestRecord
  } catch { /* 손상된 데이터 무시 */ }
  return { bestScore: 0, bestStage: 0, bestCombo: 0, bestPerfectCount: 0, playCount: 0 }
}

function saveBest(record: BestRecord) {
  localStorage.setItem(LS_KEY, JSON.stringify(record))
}

/** PERFECT + GOOD 기반 정확도 (%) */
function calcAccuracy(stat: GameStat): number {
  const total = stat.perfectCount + stat.goodCount + stat.missCount
  if (total === 0) return 100
  return Math.round(((stat.perfectCount + stat.goodCount) / total) * 100)
}

interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
  onHome: () => void
  onRanking: () => void
  onButtonSfx: () => void
  onClearSfx: () => void
  onGameOverSfx: () => void
  onNoteSfx: () => void
  onGameBgm: (stageIndex: number) => void
}

export function GameScreen({ nickname, onHome, onRanking, onButtonSfx, onClearSfx, onGameOverSfx, onNoteSfx, onGameBgm }: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)
  const [shuffledKeyMapping, setShuffledKeyMapping] = useState<KeyMapping[]>([])
  const [best, setBest] = useState<BestRecord>(loadBest)
  const [isClear, setIsClear] = useState(false)
  const resultSavedRef = useRef(false)  // 결과 화면에서 중복 저장 방지
  const statRef = useRef<GameStat>(INITIAL_STAT)  // PlayStage의 onStatUpdate 후 최신값 보관

  useEffect(() => {
    fetch('/rhythm_stages_001_015.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setShuffledKeyMapping(shuffleKeyMapping(data.stages[0].keyMapping))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (gameData) {
      setShuffledKeyMapping(shuffleKeyMapping(gameData.stages[stageIndex].keyMapping))
      // 난이도 그룹 변경 시 BGM 자동 교체 (같은 그룹이면 useAudio 내부에서 유지)
      onGameBgm(stageIndex)
    }
  }, [stageIndex, gameData])

  // 얼리 리턴 전에 useMemo 호출 (React 훅 규칙)
  const currentStageRaw = gameData?.stages[stageIndex] ?? null
  const stageWithShuffle = useMemo(() => {
    if (!currentStageRaw) return null
    return {
      ...currentStageRaw,
      keyMapping: shuffledKeyMapping.length > 0 ? shuffledKeyMapping : currentStageRaw.keyMapping,
    } as StageData
  }, [currentStageRaw, shuffledKeyMapping])

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
    setStat(prev => {
      const next = { ...prev, ...update }
      statRef.current = next
      return next
    })
  }

  const finishGame = (finalStat: GameStat, cleared: boolean, reachedStageIndex: number) => {
    if (resultSavedRef.current) return
    resultSavedRef.current = true

    setIsClear(cleared)
    if (cleared) onClearSfx()
    else onGameOverSfx()

    // localStorage 갱신
    const prev = loadBest()
    const reachedStage = gameData.stages[reachedStageIndex]?.stage ?? reachedStageIndex + 1
    const updated: BestRecord = {
      bestScore: Math.max(prev.bestScore, finalStat.score),
      bestStage: Math.max(prev.bestStage, reachedStage),
      bestCombo: Math.max(prev.bestCombo, finalStat.maxCombo),
      bestPerfectCount: Math.max(prev.bestPerfectCount, finalStat.perfectCount),
      playCount: prev.playCount + 1,
    }
    saveBest(updated)
    setBest(updated)

    // 서버 저장 (실패해도 게임 진행에 영향 없음)
    saveGameResult({
      nickname,
      score: finalStat.score,
      stage: reachedStage,
      combo: finalStat.maxCombo,
    }).catch(() => {})
  }

  const handleStageComplete = () => {
    const nextIndex = stageIndex + 1
    if (nextIndex >= gameData.stages.length) {
      finishGame(statRef.current, true, stageIndex)
      setPhase('result')
    } else {
      setStageIndex(nextIndex)
      setPhase('preview')
    }
  }

  const handleGameOver = () => {
    finishGame(statRef.current, false, stageIndex)
    setPhase('result')
  }

  const handleRestart = () => {
    resultSavedRef.current = false
    statRef.current = INITIAL_STAT
    setStageIndex(0)
    setStat(INITIAL_STAT)
    setIsClear(false)
    setPhase('preview')
    // stageIndex 0으로 리셋 → useEffect에서 BGM도 자동 교체
  }

  if (phase === 'result') {
    const accuracy = calcAccuracy(stat)
    const reachedStage = gameData.stages[stageIndex]?.stage ?? stageIndex + 1

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 bg-base-100">
        {/* 타이틀 */}
        <h2 className={`text-5xl font-black tracking-wider ${isClear ? 'text-success' : 'text-error'}`}>
          {isClear ? 'ALL CLEAR' : 'GAME OVER'}
        </h2>

        {/* 이번 기록 */}
        <div className="card bg-base-200 w-full max-w-sm">
          <div className="card-body gap-3">
            {!isClear && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">도달 스테이지</span>
                <span className="font-bold">STAGE {reachedStage}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">최종 점수</span>
              <span className="font-mono font-bold text-primary">{stat.score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">최대 콤보</span>
              <span className="font-bold">{stat.maxCombo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">정확도</span>
              <span className="font-bold">{accuracy}%</span>
            </div>
            <div className="divider my-0" />
            <div className="flex justify-between text-sm">
              <span className="text-success">PERFECT</span>
              <span>{stat.perfectCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warning">GOOD</span>
              <span>{stat.goodCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-error">MISS</span>
              <span>{stat.missCount}</span>
            </div>
          </div>
        </div>

        {/* 역대 최고 기록 */}
        <div className="card bg-base-300 w-full max-w-sm">
          <div className="card-body gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/50">역대 최고 기록</h3>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">최고 점수</span>
              <span className="font-mono font-bold">{best.bestScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">최고 스테이지</span>
              <span className="font-bold">STAGE {best.bestStage}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">최고 콤보</span>
              <span className="font-bold">{best.bestCombo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">플레이 횟수</span>
              <span className="font-bold">{best.playCount}회</span>
            </div>
          </div>
        </div>

        {/* 하단 버튼 3개 */}
        <div className="flex flex-col w-full max-w-sm gap-2">
          <button className="btn btn-primary w-full" onClick={() => { onButtonSfx(); handleRestart() }}>
            다시 하기
          </button>
          <button className="btn btn-outline w-full" onClick={() => { onButtonSfx(); onRanking() }}>
            랭킹 보기
          </button>
          <button className="btn btn-ghost w-full" onClick={() => { onButtonSfx(); onHome() }}>
            홈으로 가기
          </button>
        </div>
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
        <PreviewStage stageData={stageWithShuffle!} onPreviewEnd={handlePreviewEnd} />
      )}
      {phase === 'playing' && (
        <PlayStage
          stageData={stageWithShuffle!}
          stat={stat}
          onStatUpdate={handleStatUpdate}
          onStageComplete={handleStageComplete}
          onGameOver={handleGameOver}
          onNoteSfx={onNoteSfx}
        />
      )}
    </div>
  )
}
