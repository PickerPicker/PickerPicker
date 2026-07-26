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
import { GameOverScreen } from './GameOverScreen'

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 스테이지 인덱스 변경 시 해당 스테이지의 키매핑을 셔플해 리셋; gameData 로드/스테이지 전환에 따른 파생 상태 동기화
      setShuffledKeyMapping(shuffleKeyMapping(gameData.stages[stageIndex].keyMapping))
      // 스테이지 시작 시점의 누적 score 기록 (스테이지별 획득 점수 계산용)
      stageStartScoreRef.current = statRef.current.score
      // 난이도 그룹 변경 시 BGM 자동 교체
      onGameBgm(stageIndex)
    }
    // onGameBgm은 useAudio에서 useCallback으로 안정화되어 있어 재실행을 유발하지 않는다.
  }, [stageIndex, gameData, onGameBgm])

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
      <GameOverScreen
        stat={stat}
        accuracy={accuracy}
        isClear={isClear}
        reachedStage={reachedStage}
        best={best}
        newRecords={newRecords}
        serverPlayCount={serverPlayCount}
        globalTop={globalTop}
        wordsLookup={wordsLookup}
        // eslint-disable-next-line react-hooks/refs -- 게임 종료 시점에 값이 확정되어 불변; 결과 화면은 게임 루프가 끝난 뒤에만 렌더된다
        stageResults={stageResultsRef.current}
        isNewChampion={isNewChampion}
        championMotto={championMotto}
        championModalClosed={championModalClosed}
        onChampionMottoChange={setChampionMotto}
        onChampionModalClose={setChampionModalClosed}
        onSubmitMotto={updateMotto}
        onRestart={handleRestart}
        onHome={onHome}
        onRanking={onRanking}
        onStats={onStats}
      />
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
