import { useEffect, useMemo, useRef, useState } from 'react'
import type { BestRecord, GameData, GamePhase, GameStat, KeyMapping, StageData } from '../types'
import { saveGameResult, getRanking, updateMotto } from '../services/playerService'
import { GameHeader } from './game/GameHeader'
import { PlayStage } from './game/PlayStage'
import { PreviewStage } from './game/PreviewStage'
import { PauseModal } from './game/PauseModal'
import { SoundButton } from './common/SoundButton'
import gameoverBg from '../assets/gameover-bg.png'

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
  onStats?: () => void
  onClearSfx: () => void
  onGameOverSfx: () => void
  onHitSfx: () => void
  onMissSfx: () => void
  onGameBgm: (stageIndex: number) => void
  offset: number
  onOffset: (v: number) => void
  sfxOn: boolean
  onToggleSfx: () => void
}

export function GameScreen({ nickname, onHome, onRanking, onStats, onClearSfx, onGameOverSfx, onHitSfx, onMissSfx, onGameBgm, offset, onOffset, sfxOn, onToggleSfx }: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)
  const [shuffledKeyMapping, setShuffledKeyMapping] = useState<KeyMapping[]>([])
  const [best, setBest] = useState<BestRecord>(loadBest)
  const [serverPlayCount, setServerPlayCount] = useState<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isClear, setIsClear] = useState(false)
  const [globalTop, setGlobalTop] = useState<{ nickname: string; best_score: number; best_stage: number; best_combo: number } | null>(null)
  const [newRecords, setNewRecords] = useState<{ score: boolean; stage: boolean; combo: boolean }>({ score: false, stage: false, combo: false })
  const [isNewChampion, setIsNewChampion] = useState(false)
  const [championMotto, setChampionMotto] = useState('')
  const [championModalClosed, setChampionModalClosed] = useState(false)
  const resultSavedRef = useRef(false)  // 결과 화면에서 중복 저장 방지
  const statRef = useRef<GameStat>(INITIAL_STAT)  // PlayStage의 onStatUpdate 후 최신값 보관
  const stageStartScoreRef = useRef<number>(0)  // 현재 스테이지 진입 시점 누적 score
  const stageScoresRef = useRef<Record<string, number>>({})  // 스테이지별 획득 점수

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
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'result') return
      e.preventDefault()
      setIsPaused(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase])

  useEffect(() => {
    if (gameData) {
      setShuffledKeyMapping(shuffleKeyMapping(gameData.stages[stageIndex].keyMapping))
      // 스테이지 시작 시점의 누적 score 기록 (스테이지별 획득 점수 계산용)
      stageStartScoreRef.current = statRef.current.score
      // 난이도 그룹 변경 시 BGM 자동 교체
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

    // 현재 스테이지에서 획득한 점수 추가 (마지막 스테이지 분량)
    const lastStageGain = Math.max(0, finalStat.score - stageStartScoreRef.current)
    if (lastStageGain > 0) {
      stageScoresRef.current[String(reachedStage)] = lastStageGain
    }

    // 서버 저장 후 응답의 play_count로 화면 표시
    saveGameResult({
      nickname,
      score: finalStat.score,
      stage: reachedStage,
      combo: finalStat.maxCombo,
      stage_scores: stageScoresRef.current,
    })
      .then(record => {
        setServerPlayCount(record.play_count)
        if (record.is_new_champion) setIsNewChampion(true)
      })
      .catch(() => {})

    getRanking(1).then(ranking => {
      if (ranking.length > 0) setGlobalTop(ranking[0])
    }).catch(() => {})
  }

  const handleStageComplete = () => {
    // 클리어한 스테이지의 획득 점수 누적
    const cleared = gameData.stages[stageIndex]
    const gain = Math.max(0, statRef.current.score - stageStartScoreRef.current)
    if (cleared) {
      stageScoresRef.current[String(cleared.stage)] = gain
    }

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

  const handleGiveUp = () => {
    setIsPaused(false)
    handleGameOver()
  }

  const handleRestart = () => {
    setIsPaused(false)
    resultSavedRef.current = false
    statRef.current = INITIAL_STAT
    stageStartScoreRef.current = 0
    stageScoresRef.current = {}
    setStageIndex(0)
    setStat(INITIAL_STAT)
    setIsClear(false)
    setServerPlayCount(null)
    setIsNewChampion(false)
    setChampionMotto('')
    setChampionModalClosed(false)
    setPhase('preview')
    // stageIndex가 이미 0(첫 스테이지 사망)이면 useEffect 미트리거 →
    // 매핑 재셔플 + BGM 모두 명시적으로 재실행
    if (gameData) {
      setShuffledKeyMapping(shuffleKeyMapping(gameData.stages[0].keyMapping))
    }
    onGameBgm(0)
  }

  if (phase === 'result') {
    const accuracy = calcAccuracy(stat)
    const reachedStage = gameData.stages[stageIndex]?.stage ?? stageIndex + 1

    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-3 px-4 py-4 overflow-hidden"
        style={{
          backgroundImage: `url(${gameoverBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
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

        {/* 하단 버튼들 */}
        <div className="flex flex-col w-full max-w-sm gap-2 shrink-0">
          <SoundButton className="btn btn-primary btn-lg w-full text-lg" onClick={handleRestart}>
            다시 하기
          </SoundButton>
          {onStats && (
            <SoundButton className="btn btn-lg w-full text-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60" onClick={onStats}>
              내 통계 보기
            </SoundButton>
          )}
          <SoundButton className="btn btn-lg w-full text-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60" onClick={onRanking}>
            랭킹 보기
          </SoundButton>
          <SoundButton className="btn btn-lg w-full text-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60" onClick={onHome}>
            홈으로 가기
          </SoundButton>
        </div>

        {/* 1위 달성 모달 — 명예의 전당 등록 */}
        {isNewChampion && !championModalClosed && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'rgba(0,0,20,0.95)',
                border: '1px solid rgba(168,85,247,0.5)',
                borderRadius: 16,
                padding: 32,
                maxWidth: 400,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 0 40px rgba(168,85,247,0.4)',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#e879f9',
                  textShadow: '0 0 12px #a21caf',
                  marginBottom: 8,
                  letterSpacing: 2,
                }}
              >
                명예의 전당 등록!
              </div>
              <div style={{ fontSize: 13, color: '#c084fc', marginBottom: 20 }}>
                전체 1위를 달성했습니다.<br />한마디를 남겨보세요.
              </div>
              <textarea
                maxLength={100}
                value={championMotto}
                onChange={e => setChampionMotto(e.target.value)}
                placeholder="한마디 (선택사항, 100자 이내)"
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,20,0.5)',
                  border: '1px solid rgba(168,85,247,0.4)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#e2e8f0',
                  fontSize: 13,
                  resize: 'none',
                  marginBottom: 16,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <SoundButton
                  onClick={async () => {
                    if (championMotto.trim()) await updateMotto(championMotto.trim())
                    setChampionModalClosed(true)
                  }}
                  style={{
                    padding: '8px 24px',
                    background: 'rgba(168,85,247,0.3)',
                    border: '1px solid rgba(168,85,247,0.5)',
                    borderRadius: 8,
                    color: '#e879f9',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {championMotto.trim() ? '등록하기' : '확인'}
                </SoundButton>
                <SoundButton
                  onClick={() => setChampionModalClosed(true)}
                  style={{
                    padding: '8px 20px',
                    background: 'transparent',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: 8,
                    color: '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  나중에
                </SoundButton>
              </div>
            </div>
          </div>
        )}
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
          stageData={stageWithShuffle!}
          onPreviewEnd={handlePreviewEnd}
          isPaused={isPaused}
        />
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
          isPaused={isPaused}
        />
      )}
      {isPaused && phase !== 'result' && (
        <PauseModal
          onResume={() => setIsPaused(false)}
          onGiveUp={handleGiveUp}
          offset={offset}
          onOffset={onOffset}
          sfxOn={sfxOn}
          onToggleSfx={onToggleSfx}
        />
      )}
    </div>
  )
}
