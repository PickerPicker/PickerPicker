import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameData, GamePhase, GameStat, KeyMapping, StageData } from '../../types'
import { PreviewStage } from '../game/PreviewStage'
import { PracticeHeader } from './PracticeHeader'
import { PracticePlayStage } from './PracticePlayStage'

const INITIAL_STAT: GameStat = {
  score: 0,
  gauge: 100,
  perfectCombo: 0,
  maxCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  missCount: 0,
}

const DIFFICULTIES: { level: number; title: string; subtitle: string; keys: string; bpm: number }[] = [
  { level: 1, title: '입문',      subtitle: 'Stage 1~3',   keys: '4키',           bpm: 90  },
  { level: 2, title: '확장',      subtitle: 'Stage 4~6',   keys: '6키',           bpm: 105 },
  { level: 3, title: '8키 진입',  subtitle: 'Stage 7~9',   keys: '8키 전체',      bpm: 120 },
  { level: 4, title: '복수 단어', subtitle: 'Stage 10~12', keys: '8키 · 2단어',   bpm: 135 },
  { level: 5, title: '고난도',    subtitle: 'Stage 13~15', keys: '8키 · 2~3단어', bpm: 150 },
]

function shuffleKeyMapping(keyMapping: KeyMapping[]): KeyMapping[] {
  const entries = keyMapping.map(k => ({ syllable: k.syllable, type: k.type }))
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  return keyMapping.map((k, i) => ({ ...k, syllable: entries[i].syllable, type: entries[i].type }))
}

function calcAccuracy(stat: GameStat): number {
  const total = stat.perfectCount + stat.goodCount + stat.missCount
  if (total === 0) return 100
  return Math.round(((stat.perfectCount + stat.goodCount) / total) * 100)
}

type PracticePhase = 'menu' | 'play' | 'done'

interface PracticeScreenProps {
  onHome: () => void
  onHitSfx: () => void
  onMissSfx: () => void
  onGameBgm: (stageIndex: number) => void
  onStopBgm: () => void
  offset: number
}

export function PracticeScreen({
  onHome,
  onHitSfx,
  onMissSfx,
  onGameBgm,
  onStopBgm,
  offset,
}: PracticeScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pPhase, setPPhase] = useState<PracticePhase>('menu')
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [localStageIdx, setLocalStageIdx] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)
  const [shuffledKeyMapping, setShuffledKeyMapping] = useState<KeyMapping[]>([])
  const statRef = useRef<GameStat>(INITIAL_STAT)

  useEffect(() => {
    fetch('/rhythm_stages_001_015.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const levelStages = useMemo<StageData[]>(() => {
    if (!gameData || selectedLevel === null) return []
    const start = (selectedLevel - 1) * 3
    return gameData.stages.slice(start, start + 3)
  }, [gameData, selectedLevel])

  const currentStageRaw = levelStages[localStageIdx] ?? null
  const stageWithShuffle = useMemo<StageData | null>(() => {
    if (!currentStageRaw) return null
    return {
      ...currentStageRaw,
      keyMapping: shuffledKeyMapping.length > 0 ? shuffledKeyMapping : currentStageRaw.keyMapping,
    }
  }, [currentStageRaw, shuffledKeyMapping])

  useEffect(() => {
    if (pPhase !== 'play') return
    if (!currentStageRaw) return
    setShuffledKeyMapping(shuffleKeyMapping(currentStageRaw.keyMapping))
    const globalIdx = (selectedLevel! - 1) * 3 + localStageIdx
    onGameBgm(globalIdx)
  }, [pPhase, localStageIdx, currentStageRaw, selectedLevel, onGameBgm])

  const handleStatUpdate = (update: Partial<GameStat>) => {
    setStat(prev => {
      const next = { ...prev, ...update }
      statRef.current = next
      return next
    })
  }

  const startLevel = (level: number) => {
    setSelectedLevel(level)
    setLocalStageIdx(0)
    statRef.current = INITIAL_STAT
    setStat(INITIAL_STAT)
    setPhase('preview')
    setPPhase('play')
  }

  const handlePreviewEnd = () => setPhase('playing')

  const handleStageComplete = () => {
    const next = localStageIdx + 1
    if (next >= 3) {
      onStopBgm()
      setPPhase('done')
    } else {
      setLocalStageIdx(next)
      setPhase('preview')
    }
  }

  const backToMenu = () => {
    onStopBgm()
    setSelectedLevel(null)
    setLocalStageIdx(0)
    statRef.current = INITIAL_STAT
    setStat(INITIAL_STAT)
    setPPhase('menu')
  }

  const exitToHome = () => {
    onStopBgm()
    onHome()
  }

  // ESC: 메뉴면 홈으로, 플레이/완료면 메뉴로
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (pPhase === 'menu') exitToHome()
      else backToMenu()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [pPhase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!gameData || gameData.stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-error">
        <p>스테이지 데이터를 불러올 수 없습니다.</p>
        <button className="btn btn-primary" onClick={onHome}>홈으로</button>
      </div>
    )
  }

  if (pPhase === 'menu') {
    return (
      <div
        className="relative flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8"
        style={{
          backgroundImage: 'url(/bg-home.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className="flex flex-col items-center gap-5 px-8 py-7 rounded-3xl w-[520px] max-w-[92vw]"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <h1
              className="text-3xl font-black tracking-widest text-primary"
              style={{ textShadow: '0 2px 16px rgba(0,180,255,0.5)' }}
            >
              ─ PRACTICE ─
            </h1>
            <p
              className="text-xs tracking-widest"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              난이도를 골라 3스테이지를 연습하세요
            </p>
            <p
              className="text-[10px] tracking-wider"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              · 게임오버 없음 · 기록 저장 안함 ·
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            {DIFFICULTIES.map(d => (
              <button
                key={d.level}
                className="flex items-center justify-between px-5 py-4 rounded-xl text-left transition hover:bg-white/10"
                style={{
                  background: 'rgba(60,80,120,0.35)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                onClick={() => startLevel(d.level)}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-xs tracking-widest" style={{ color: 'rgba(0,180,255,0.7)' }}>
                    [LV {d.level}]
                  </span>
                  <span className="text-lg font-bold text-white tracking-wider" style={{  }}>
                    {d.title}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '1px' }}>
                    {d.subtitle} · {d.keys} · BPM {d.bpm}
                  </span>
                </div>
                <span className="text-2xl text-primary opacity-80 font-mono">›</span>
              </button>
            ))}
          </div>

          <button
            className="btn btn-lg w-full mt-2 text-base"
            style={{
              background: 'rgba(60,80,120,0.45)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              letterSpacing: '2px',
            }}
            onClick={onHome}
          >
            ← 홈으로
          </button>
        </div>
      </div>
    )
  }

  if (pPhase === 'done' && selectedLevel !== null) {
    const accuracy = calcAccuracy(stat)
    const levelInfo = DIFFICULTIES.find(d => d.level === selectedLevel)!

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4 py-4 bg-base-100">
        <h2 className="text-3xl font-black tracking-widest text-success" style={{  }}>
          {levelInfo.title} 연습 완료
        </h2>
        <p className="text-xs tracking-widest text-base-content/60" style={{  }}>
          {levelInfo.subtitle} · 기록 저장 안 함
        </p>

        <div className="card bg-base-200 w-full max-w-sm">
          <div className="card-body gap-1 py-4 px-5">
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">점수</span>
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

        <div className="flex flex-col w-full max-w-sm gap-2">
          <button
            className="btn btn-primary btn-lg w-full text-lg"
            onClick={backToMenu}
          >
            다른 난이도 선택
          </button>
          <button
            className="btn btn-lg w-full text-lg border border-white/60 text-white hover:bg-white/10"
            onClick={exitToHome}
          >
            홈으로 가기
          </button>
        </div>
      </div>
    )
  }

  if (!stageWithShuffle) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const levelInfo = DIFFICULTIES.find(d => d.level === selectedLevel)!

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <PracticeHeader
        levelTitle={levelInfo.title}
        stepIndex={localStageIdx}
        word={stageWithShuffle.word}
        score={stat.score}
        combo={stat.perfectCombo}
        onExit={backToMenu}
      />
      {phase === 'preview' && (
        <PreviewStage stageData={stageWithShuffle} onPreviewEnd={handlePreviewEnd} />
      )}
      {phase === 'playing' && (
        <PracticePlayStage
          stageData={stageWithShuffle}
          stat={stat}
          onStatUpdate={handleStatUpdate}
          onStageComplete={handleStageComplete}
          onHitSfx={onHitSfx}
          onMissSfx={onMissSfx}
          offset={offset}
        />
      )}
    </div>
  )
}
