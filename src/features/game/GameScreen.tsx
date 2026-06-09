import { useEffect, useMemo, useRef, useState } from 'react'
import type { BestRecord, GameData, GamePhase, GameStat, KeyMapping, StageData } from '../../types'
import { saveGameResult, getRanking, updateMotto } from '../../services/playerService'
import type { StageResultItem } from '../../services/playerService'
import { apiFetch } from '../../services/authService'
import { GameHeader } from './GameHeader'
import { PlayStage } from './PlayStage'
import { PreviewStage } from './PreviewStage'
import { PauseModal } from './PauseModal'
import { CountdownOverlay } from './CountdownOverlay'
import { SoundButton } from '../../components/common/SoundButton'
import gameoverBg from '../../assets/gameover-bg.png'
import { GameOverWordCards } from './GameOverWordCards'

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

interface BackendStage {
  id: number
  stage?: number
  word: string
  difficulty_level: number
  bpm: number
  input_length: number
  valid_syllables: string[]
  invalid_syllables: string[]
  input_syllables: string[]
  key_mapping: { key: string; syllable: string; type: 'valid' | 'invalid' }[]
  fixed_stage: number | null
  is_active?: boolean
}

function beStageToStageData(be: BackendStage, idx: number): StageData & { id: number } {
  return {
    id: be.id,
    stage: be.fixed_stage ?? idx + 1,
    word: be.word,
    difficultyLevel: be.difficulty_level,
    bpm: be.bpm,
    inputLength: be.input_length,
    validSyllables: be.valid_syllables,
    invalidSyllables: be.invalid_syllables,
    inputSyllables: be.input_syllables,
    keyMapping: be.key_mapping.map((km) => ({ key: km.key, syllable: km.syllable, type: km.type })),
  } as StageData & { id: number }
}

function shuffleKeyMapping(keyMapping: KeyMapping[]): KeyMapping[] {
  const entries = keyMapping.map((k) => ({ syllable: k.syllable, type: k.type }))
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
  } catch {
    /* 손상된 데이터 무시 */
  }
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
  bgmVolume: number
  onBgmVolume: (v: number) => void
}

export function GameScreen({
  nickname,
  onHome,
  onRanking,
  onStats,
  onClearSfx,
  onGameOverSfx,
  onHitSfx,
  onMissSfx,
  onGameBgm,
  offset,
  onOffset,
  sfxOn,
  onToggleSfx,
  bgmVolume,
  onBgmVolume,
}: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)
  const [shuffledKeyMapping, setShuffledKeyMapping] = useState<KeyMapping[]>([])
  const [best, setBest] = useState<BestRecord>(loadBest)
  const [serverPlayCount, setServerPlayCount] = useState<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [isClear, setIsClear] = useState(false)
  const [globalTop, setGlobalTop] = useState<{
    nickname: string
    best_score: number
    best_stage: number
    best_combo: number
  } | null>(null)
  const [newRecords, setNewRecords] = useState<{ score: boolean; stage: boolean; combo: boolean }>({
    score: false,
    stage: false,
    combo: false,
  })
  const [isNewChampion, setIsNewChampion] = useState(false)
  const [championMotto, setChampionMotto] = useState('')
  const [championModalClosed, setChampionModalClosed] = useState(false)
  const resultSavedRef = useRef(false) // 결과 화면에서 중복 저장 방지
  const statRef = useRef<GameStat>(INITIAL_STAT) // PlayStage의 onStatUpdate 후 최신값 보관
  const stageStartScoreRef = useRef<number>(0) // 현재 스테이지 진입 시점 누적 score
  const stageScoresRef = useRef<Record<string, number>>({}) // 스테이지별 획득 점수
  const stageResultsRef = useRef<StageResultItem[]>([]) // stage_results 누적 (word_id 포함)
  const resumeTimeRef = useRef<number>(0) // 카운트다운 완료 시각 — blur grace period 판단용

  useEffect(() => {
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    apiFetch(`${BASE_URL}/games/start`, { method: 'POST' })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 422) {
            const detail = await r.text()
            if (detail.includes('insufficient_word_pool')) {
              alert('단어 풀이 부족합니다. 관리자에게 단어 등록을 요청하세요.')
              onHome()
              return
            }
          }
          throw new Error(`게임 시작 실패: ${r.status}`)
        }
        const data = (await r.json()) as { stages: BackendStage[] }
        const gd: GameData = {
          gameTitle: '',
          version: '',
          keyLayout: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
          rules: {
            totalStages: 15,
            difficultyGroupSize: 3,
            baseBpm: 90,
            bpmIncreasePerDifficulty: 15,
            baseInputLength: 16,
            inputLengthIncreasePerDifficulty: 8,
            validSyllableRatioMin: 0.7,
          },
          stages: data.stages.map(beStageToStageData),
        }
        setGameData(gd)
        setShuffledKeyMapping(shuffleKeyMapping(gd.stages[0].keyMapping))
        setLoading(false)
      })
      .catch((err) => {
        console.error('게임 시작 실패', err)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'result') return
      e.preventDefault()
      if (isCountingDown) {
        setIsCountingDown(false)
        setIsPaused(true)
        return
      }
      // unpause 시 카운트다운 경유 (Resume 버튼과 동일 흐름)
      if (isPaused) {
        setIsPaused(false)
        setIsCountingDown(true)
      } else {
        setIsPaused(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, isCountingDown, isPaused])

  // 리사이즈/포커스아웃/탭전환 자동 pause (playing 단계에서만)
  useEffect(() => {
    if (phase !== 'playing') return
    if (isPaused || isCountingDown) return

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    // 카운트다운 완료 직후 1초 내 blur/resize는 무시 — 포커스 전환 타이밍 오탐 방지
    const triggerPause = () => {
      if (Date.now() - resumeTimeRef.current < 1000) return
      setIsPaused(true)
    }
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(triggerPause, 300)
    }
    const onBlur = () => triggerPause()
    const onVisibility = () => {
      if (document.hidden) triggerPause()
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase, isPaused, isCountingDown])

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
    setStat((prev) => {
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
      stage_results: stageResultsRef.current,
    })
      .then((record) => {
        setServerPlayCount(record.play_count)
        if (record.is_new_champion) setIsNewChampion(true)
      })
      .catch(() => {})

    getRanking(1)
      .then((ranking) => {
        if (ranking.length > 0) setGlobalTop(ranking[0])
      })
      .catch(() => {})
  }

  const handleStageComplete = () => {
    // 클리어한 스테이지의 획득 점수 누적
    const cleared = gameData.stages[stageIndex] as StageData & { id?: number }
    const gain = Math.max(0, statRef.current.score - stageStartScoreRef.current)
    if (cleared) {
      stageScoresRef.current[String(cleared.stage)] = gain
      if (cleared.id) {
        // MVP: 본 스테이지 판정 카운트는 0으로 보냄. 향후 stage별 정확 추적 필요
        stageResultsRef.current.push({
          word_id: cleared.id,
          stage_index: cleared.stage,
          perfect_count: 0,
          good_count: 0,
          miss_count: 0,
          stage_score: gain,
        })
      }
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
    // 도달 스테이지의 stage_result도 누적 (게임 오버 직전 스테이지)
    const currentStageInfo = gameData.stages[stageIndex] as StageData & { id?: number }
    if (currentStageInfo?.id) {
      const gain = Math.max(0, statRef.current.score - stageStartScoreRef.current)
      stageResultsRef.current.push({
        word_id: currentStageInfo.id,
        stage_index: currentStageInfo.stage,
        perfect_count: 0,
        good_count: 0,
        miss_count: 0,
        stage_score: gain,
      })
    }
    finishGame(statRef.current, false, stageIndex)
    setPhase('result')
  }

  const handleGiveUp = () => {
    setIsPaused(false)
    setIsCountingDown(false)
    handleGameOver()
  }

  const handleRestart = () => {
    setIsPaused(false)
    setIsCountingDown(false)
    resultSavedRef.current = false
    statRef.current = INITIAL_STAT
    stageStartScoreRef.current = 0
    stageScoresRef.current = {}
    stageResultsRef.current = []
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

    const wordsLookup = Object.fromEntries(
      (gameData.stages as Array<StageData & { id?: number }>).map((w) => [
        w.id ?? -1,
        {
          word: w.word,
          difficulty_level: (w as { difficultyLevel?: number }).difficultyLevel ?? 1,
        },
      ]),
    )

    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-4 py-6 overflow-auto"
        style={{
          backgroundImage: `url(${gameoverBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* 중앙 단일 컬럼 — 화면 폭에 관계없이 항상 동일한 세로 흐름. my-auto로 세로 중앙 정렬하되 콘텐츠가 길면 자연스럽게 스크롤 */}
        <div className="flex flex-col items-stretch gap-4 w-full max-w-2xl my-auto">
          {/* 타이틀 — 네온 글로우. 와이드에서 더 크게, 아래 여백 확보 */}
          <h2
            className={`text-center text-6xl sm:text-7xl font-black tracking-widest shrink-0 mb-2 ${isClear ? 'text-success' : 'text-error'}`}
            style={{
              textShadow: isClear
                ? '0 0 18px rgba(74,222,128,0.7), 0 0 40px rgba(74,222,128,0.4)'
                : '0 0 18px rgba(248,113,113,0.7), 0 0 40px rgba(248,113,113,0.4)',
            }}
          >
            {isClear ? 'ALL CLEAR' : 'GAME OVER'}
          </h2>

          {/* 하이라이트 3카드 — 최종 점수 / 도달 스테이지 / 최대 콤보 */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {/* 최종 점수 (시안) */}
            <div
              className="rounded-xl py-5 px-3 text-center backdrop-blur"
              style={{
                background: 'rgba(8,12,28,0.55)',
                border: '1px solid rgba(56,189,248,0.55)',
                boxShadow: '0 0 16px rgba(56,189,248,0.18)',
              }}
            >
              <div className="text-xs uppercase tracking-widest text-sky-300/80 mb-1">점수</div>
              <div
                className="font-mono font-black text-3xl text-sky-300 leading-tight"
                style={{ textShadow: '0 0 12px rgba(56,189,248,0.6)' }}
              >
                {stat.score.toLocaleString()}
              </div>
            </div>
            {/* 도달 스테이지 (핑크) */}
            <div
              className="rounded-xl py-5 px-3 text-center backdrop-blur"
              style={{
                background: 'rgba(8,12,28,0.55)',
                border: '1px solid rgba(244,114,182,0.55)',
                boxShadow: '0 0 16px rgba(244,114,182,0.18)',
              }}
            >
              <div className="text-xs uppercase tracking-widest text-pink-300/80 mb-1">
                {isClear ? '클리어' : '스테이지'}
              </div>
              <div
                className="font-black text-2xl sm:text-3xl text-pink-300 leading-tight whitespace-nowrap"
                style={{ textShadow: '0 0 12px rgba(244,114,182,0.6)' }}
              >
                {isClear ? 'ALL' : `STAGE ${reachedStage}`}
              </div>
            </div>
            {/* 최대 콤보 (옐로) */}
            <div
              className="rounded-xl py-5 px-3 text-center backdrop-blur"
              style={{
                background: 'rgba(8,12,28,0.55)',
                border: '1px solid rgba(250,204,21,0.55)',
                boxShadow: '0 0 16px rgba(250,204,21,0.18)',
              }}
            >
              <div className="text-xs uppercase tracking-widest text-yellow-300/80 mb-1">콤보</div>
              <div
                className="font-black text-3xl text-yellow-300 leading-tight"
                style={{ textShadow: '0 0 12px rgba(250,204,21,0.6)' }}
              >
                {stat.maxCombo}
              </div>
            </div>
          </div>

          {/* 판정 상세 — 정확도 강조 + PERFECT/GOOD/MISS */}
          <div
            className="rounded-xl px-5 py-4 shrink-0 backdrop-blur"
            style={{ background: 'rgba(8,12,28,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* 정확도 — 라벨 바로 옆에 큰 숫자로 묶어 가운데 배치 */}
            <div className="flex items-baseline justify-center gap-2 mb-3">
              <span className="text-sm uppercase tracking-widest text-white/50">정확도</span>
              <span
                className="font-mono font-black text-3xl text-white"
                style={{ textShadow: '0 0 12px rgba(255,255,255,0.3)' }}
              >
                {accuracy}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
              <div>
                <div className="text-xs font-bold text-success uppercase tracking-wide">
                  Perfect
                </div>
                <div className="font-black text-xl text-white">{stat.perfectCount}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-warning uppercase tracking-wide">Good</div>
                <div className="font-black text-xl text-white">{stat.goodCount}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-error uppercase tracking-wide">Miss</div>
                <div className="font-black text-xl text-white">{stat.missCount}</div>
              </div>
            </div>
          </div>

          {/* 내 최고 기록 + 글로벌 1위 — 가로 2분할 (좁으면 자동 세로) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* 내 최고 기록 */}
            <div
              className="rounded-xl px-4 py-4 backdrop-blur"
              style={{ background: 'rgba(8,12,28,0.5)', border: '1px solid rgba(99,102,241,0.5)' }}
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-2">
                내 최고 기록
              </h3>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="flex items-center gap-1 text-white/60">
                  점수
                  {newRecords.score && (
                    <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                      NEW
                    </span>
                  )}
                </span>
                <span className="font-mono font-bold text-white">
                  {best.bestScore.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="flex items-center gap-1 text-white/60">
                  스테이지
                  {newRecords.stage && (
                    <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                      NEW
                    </span>
                  )}
                </span>
                <span className="font-bold text-white">STAGE {best.bestStage}</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="flex items-center gap-1 text-white/60">
                  콤보
                  {newRecords.combo && (
                    <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                      NEW
                    </span>
                  )}
                </span>
                <span className="font-bold text-white">{best.bestCombo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">플레이 횟수</span>
                <span className="font-bold text-white">
                  {serverPlayCount === null ? '...' : `${serverPlayCount}회`}
                </span>
              </div>
            </div>

            {/* 글로벌 1위 */}
            {globalTop ? (
              <div
                className="rounded-xl px-4 py-4 backdrop-blur"
                style={{
                  background: 'rgba(8,12,28,0.5)',
                  border: '1px solid rgba(250,204,21,0.45)',
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-2">
                  🏆 글로벌 1위
                </h3>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">닉네임</span>
                  <span className="font-bold text-yellow-300 truncate ml-2">
                    {globalTop.nickname}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">점수</span>
                  <span className="font-mono font-bold text-white">
                    {globalTop.best_score.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">스테이지</span>
                  <span className="font-bold text-white">STAGE {globalTop.best_stage}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">콤보</span>
                  <span className="font-bold text-white">{globalTop.best_combo}</span>
                </div>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          {/* 이번 판 단어 — 본문 흐름에 합류, 폭 적응 그리드 */}
          <div className="shrink-0">
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest mb-2">
              이번 판 단어
            </h3>
            <GameOverWordCards results={stageResultsRef.current} wordsLookup={wordsLookup} />
          </div>

          {/* 하단 버튼 — 다시하기 강조 + 보조 3버튼 가로 분할 */}
          <div className="flex flex-col gap-2 shrink-0 pt-1">
            <SoundButton className="btn btn-primary btn-lg w-full text-lg" onClick={handleRestart}>
              다시 하기
            </SoundButton>
            <div className="grid grid-cols-3 gap-2">
              {onStats && (
                <SoundButton
                  className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
                  onClick={onStats}
                >
                  내 통계 보기
                </SoundButton>
              )}
              <SoundButton
                className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
                onClick={onRanking}
              >
                랭킹 보기
              </SoundButton>
              <SoundButton
                className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
                onClick={onHome}
              >
                홈으로 가기
              </SoundButton>
            </div>
          </div>
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
                전체 1위를 달성했습니다.
                <br />
                한마디를 남겨보세요.
              </div>
              <textarea
                maxLength={100}
                value={championMotto}
                onChange={(e) => setChampionMotto(e.target.value)}
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
          isPaused={isPaused || isCountingDown}
        />
      )}
      {isPaused && (phase as string) !== 'result' && (
        <PauseModal
          onResume={() => {
            setIsPaused(false)
            setIsCountingDown(true)
          }}
          onGiveUp={handleGiveUp}
          offset={offset}
          onOffset={onOffset}
          sfxOn={sfxOn}
          onToggleSfx={onToggleSfx}
          bgmVolume={bgmVolume}
          onBgmVolume={onBgmVolume}
        />
      )}
      {isCountingDown && (phase as string) !== 'result' && (
        <CountdownOverlay
          onComplete={() => {
            resumeTimeRef.current = Date.now()
            setIsCountingDown(false)
          }}
        />
      )}
    </div>
  )
}
