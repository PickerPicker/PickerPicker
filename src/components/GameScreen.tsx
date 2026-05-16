import { useEffect, useMemo, useRef, useState } from 'react'
import type { BestRecord, GameData, GamePhase, GameStat, KeyMapping, StageData } from '../types'
import { saveGameResult, getRanking } from '../services/playerService'
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
  return { bestScore: 0, bestStage: 0, bestCombo: 0, bestPerfectCount: 0 }
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
  onHitSfx: () => void
  onMissSfx: () => void
  onGameBgm: (stageIndex: number) => void
  offset: number
}

export function GameScreen({ nickname, onHome, onRanking, onButtonSfx, onClearSfx, onGameOverSfx, onHitSfx, onMissSfx, onGameBgm, offset }: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)
  const [shuffledKeyMapping, setShuffledKeyMapping] = useState<KeyMapping[]>([])
  const [best, setBest] = useState<BestRecord>(loadBest)
  const [serverPlayCount, setServerPlayCount] = useState<number | null>(null)
  const [isClear, setIsClear] = useState(false)
  const [globalTop, setGlobalTop] = useState<{ nickname: string; best_score: number; best_stage: number; best_combo: number } | null>(null)
  const [newRecords, setNewRecords] = useState<{ score: boolean; stage: boolean; combo: boolean }>({ score: false, stage: false, combo: false })
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
    }
    saveBest(updated)
    setBest(updated)
    setNewRecords({
      score: finalStat.score > prev.bestScore,
      stage: reachedStage > prev.bestStage,
      combo: finalStat.maxCombo > prev.bestCombo,
    })

    // 서버 저장 후 응답의 play_count로 화면 표시
    saveGameResult({
      nickname,
      score: finalStat.score,
      stage: reachedStage,
      combo: finalStat.maxCombo,
    })
      .then(record => setServerPlayCount(record.play_count))
      .catch(() => {})

    getRanking(1).then(ranking => {
      if (ranking.length > 0) setGlobalTop(ranking[0])
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
    setServerPlayCount(null)
    setPhase('preview')
    // stageIndex가 이미 0이면 useEffect 미트리거 → 명시적으로 BGM 재시작
    onGameBgm(0)
  }

  if (phase === 'result') {
    const accuracy = calcAccuracy(stat)
    const reachedStage = gameData.stages[stageIndex]?.stage ?? stageIndex + 1

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-4 py-4 bg-base-100 overflow-hidden">
        {/* 타이틀 */}
        <h2 className={`text-4xl font-black tracking-wider shrink-0 ${isClear ? 'text-success' : 'text-error'}`}>
          {isClear ? 'ALL CLEAR' : 'GAME OVER'}
        </h2>

        {/* 이번 기록 */}
        <div className="card bg-base-200 w-full max-w-sm shrink-0">
          <div className="card-body gap-1 py-3 px-4">
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
              <span className="text-success font-bold">PERFECT</span>
              <span>{stat.perfectCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warning font-bold">GOOD</span>
              <span>{stat.goodCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-error font-bold">MISS</span>
              <span>{stat.missCount}</span>
            </div>
          </div>
        </div>

        {/* 내 최고 기록 */}
        <div className="card w-full max-w-sm border border-primary/60 shrink-0" style={{ background: 'rgba(30,40,70,0.85)' }}>
          <div className="card-body gap-1 py-3 px-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">내 최고 기록</h3>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-base-content/70">
                최고 점수
                {newRecords.score && <span className="badge badge-sm bg-primary text-white border-0 animate-pulse">NEW</span>}
              </span>
              <span className="font-mono font-bold text-white">{best.bestScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-base-content/70">
                최고 스테이지
                {newRecords.stage && <span className="badge badge-sm bg-primary text-white border-0 animate-pulse">NEW</span>}
              </span>
              <span className="font-bold text-white">STAGE {best.bestStage}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-base-content/70">
                최고 콤보
                {newRecords.combo && <span className="badge badge-sm bg-primary text-white border-0 animate-pulse">NEW</span>}
              </span>
              <span className="font-bold text-white">{best.bestCombo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-base-content/70">플레이 횟수</span>
              <span className="font-bold text-white">
                {serverPlayCount === null ? '...' : `${serverPlayCount}회`}
              </span>
            </div>
          </div>
        </div>

        {/* 글로벌 1위 */}
        {globalTop && (
          <div className="card bg-base-300 w-full max-w-sm border border-yellow-500/40 shrink-0">
            <div className="card-body gap-1 py-3 px-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400">🏆 글로벌 1위</h3>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">닉네임</span>
                <span className="font-bold text-yellow-300">{globalTop.nickname}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">최고 점수</span>
                <span className="font-mono font-bold">{globalTop.best_score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">최고 스테이지</span>
                <span className="font-bold">STAGE {globalTop.best_stage}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">최고 콤보</span>
                <span className="font-bold">{globalTop.best_combo}</span>
              </div>
            </div>
          </div>
        )}

        {/* 하단 버튼 3개 */}
        <div className="flex flex-col w-full max-w-sm gap-2 shrink-0">
          <button className="btn btn-primary btn-lg w-full text-lg" onClick={() => { onButtonSfx(); handleRestart() }}>
            다시 하기
          </button>
          <button className="btn btn-outline btn-lg w-full text-lg" onClick={() => { onButtonSfx(); onRanking() }}>
            랭킹 보기
          </button>
          <button className="btn btn-lg w-full text-lg border border-white/60 text-white hover:bg-white/10" onClick={() => { onButtonSfx(); onHome() }}>
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
          onHitSfx={onHitSfx}
          onMissSfx={onMissSfx}
          offset={offset}
        />
      )}
    </div>
  )
}
