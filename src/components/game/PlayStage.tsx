import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameStat, JudgmentType, StageData } from '../../types'
import { JudgmentDisplay } from './JudgmentDisplay'
import { KeyboardDisplay } from './KeyboardDisplay'
import { NoteTrack } from './NoteTrack'

const PERFECT_WINDOW = 100   // ±100ms
const GOOD_WINDOW = 250      // ±250ms
const NOTE_TRAVEL_BEATS = 4

interface PlayStageProps {
  stageData: StageData
  stat: GameStat
  onStatUpdate: (update: Partial<GameStat>) => void
  onStageComplete: () => void
  onGameOver: () => void
  onHitSfx: () => void
  onMissSfx: () => void
  offset: number
}

export function PlayStage({
  stageData,
  stat,
  onStatUpdate,
  onStageComplete,
  onGameOver,
  onHitSfx,
  onMissSfx,
  offset,
}: PlayStageProps) {
  const { bpm, inputSyllables, keyMapping, validSyllables } = stageData
  const beatMs = Math.round(60_000 / bpm)

  // pendingIndex를 state와 ref 둘 다 관리 — ref는 즉시 반영, state는 NoteTrack 렌더용
  const [pendingIndex, setPendingIndex] = useState(0)
  const [lastJudgment, setLastJudgment] = useState<{ type: JudgmentType; id: number } | null>(null)
  const [pressedKey, setPressedKey] = useState<string | undefined>()
  const [perfectCombo, setPerfectCombo] = useState(0)

  const startTimeRef = useRef(Date.now())
  const pendingIndexRef = useRef(0)
  const statRef = useRef(stat)
  const judgeCountRef = useRef(0)
  const gameOverRef = useRef(false)

  useEffect(() => { statRef.current = stat }, [stat])

  const onStatUpdateRef = useRef(onStatUpdate)
  const onGameOverRef = useRef(onGameOver)
  const onStageCompleteRef = useRef(onStageComplete)
  const onHitSfxRef = useRef(onHitSfx)
  const onMissSfxRef = useRef(onMissSfx)
  useEffect(() => { onStatUpdateRef.current = onStatUpdate }, [onStatUpdate])
  useEffect(() => { onGameOverRef.current = onGameOver }, [onGameOver])
  useEffect(() => { onStageCompleteRef.current = onStageComplete }, [onStageComplete])
  useEffect(() => { onHitSfxRef.current = onHitSfx }, [onHitSfx])
  useEffect(() => { onMissSfxRef.current = onMissSfx }, [onMissSfx])

  const advancePending = useCallback((applyCount = 1) => {
    const next = pendingIndexRef.current + applyCount
    pendingIndexRef.current = next
    setPendingIndex(next)
    if (next >= inputSyllables.length) {
      onStageCompleteRef.current()
    }
  }, [inputSyllables.length])

  const applyJudgment = useCallback((type: JudgmentType) => {
    if (gameOverRef.current) return

    // PERFECT/GOOD → 정타음, MISS → 미스음
    if (type === 'MISS') {
      onMissSfxRef.current()
    } else {
      onHitSfxRef.current()
    }
    judgeCountRef.current += 1
    setLastJudgment({ type, id: judgeCountRef.current })

    const current = statRef.current
    let { score, gauge, perfectCombo: combo, maxCombo, perfectCount, goodCount, missCount } = current

    if (type === 'PERFECT') {
      combo += 1
      if (combo > maxCombo) maxCombo = combo
      score += combo >= 5 ? 200 : 100
      gauge = Math.min(100, gauge + (combo >= 5 ? 2 : 1))
      perfectCount += 1
      if (combo > maxCombo) maxCombo = combo  // 최대 콤보 갱신
    } else if (type === 'GOOD') {
      combo = 0
      score += 50
      goodCount += 1
    } else {
      combo = 0
      gauge = Math.max(0, gauge - 15)
      missCount += 1
    }

    const newStat = { score, gauge, perfectCombo: combo, maxCombo, perfectCount, goodCount, missCount }
    statRef.current = newStat
    setPerfectCombo(combo)
    onStatUpdateRef.current(newStat)

    if (gauge <= 0) {
      gameOverRef.current = true
      onGameOverRef.current()
      return
    }

    advancePending()
  }, [advancePending])

  // useLayoutEffect: DOM 업데이트 직후 paint 전에 실행 → 애니메이션 시작 시각과 일치
  useLayoutEffect(() => {
    startTimeRef.current = Date.now() + NOTE_TRAVEL_BEATS * beatMs
    pendingIndexRef.current = 0
    setPendingIndex(0)
    setPerfectCombo(0)
    gameOverRef.current = false
  }, [stageData, beatMs])

  // 자동 MISS/통과 인터벌 (useLayoutEffect 이후 실행되므로 startTimeRef가 올바름)
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOverRef.current) return
      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return
      const arrivalTime = startTimeRef.current + idx * beatMs + offset
      const delta = Date.now() - arrivalTime
      if (delta > GOOD_WINDOW) {
        if (validSyllables.includes(inputSyllables[idx])) {
          applyJudgment('MISS')
        } else {
          // 무효 음절: 패널티 없이 통과
          const next = pendingIndexRef.current + 1
          pendingIndexRef.current = next
          setPendingIndex(next)
          if (next >= inputSyllables.length) onStageCompleteRef.current()
        }
      }
    }, 16)
    return () => clearInterval(interval)
  }, [stageData, beatMs, applyJudgment, inputSyllables, validSyllables, offset])

  // 키 입력 핸들러
  useEffect(() => {
    const codeMap: Record<string, string> = {
      a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF',
      j: 'KeyJ', k: 'KeyK', l: 'KeyL', ';': 'Semicolon',
    }

    const handler = (e: KeyboardEvent) => {
      if (e.repeat || gameOverRef.current) return
      const km = keyMapping.find(k => codeMap[k.key] === e.code)
      if (!km) return

      setPressedKey(e.code)
      setTimeout(() => setPressedKey(undefined), 100)

      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return

      const expectedSyllable = inputSyllables[idx]
      if (!validSyllables.includes(expectedSyllable)) {
        applyJudgment('MISS')
        return
      }

      const arrivalTime = startTimeRef.current + idx * beatMs + offset
      const delta = Math.abs(Date.now() - arrivalTime)

      if (km.syllable !== expectedSyllable) {
        applyJudgment('MISS')
      } else if (delta <= PERFECT_WINDOW) {
        applyJudgment('PERFECT')
      } else if (delta <= GOOD_WINDOW) {
        applyJudgment('GOOD')
      } else {
        applyJudgment('MISS')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stageData, keyMapping, inputSyllables, beatMs, applyJudgment, offset])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 relative flex flex-col">
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <JudgmentDisplay judgment={lastJudgment} perfectCombo={perfectCombo} />
        </div>
        <NoteTrack
          inputSyllables={inputSyllables}
          beatMs={beatMs}
          pendingIndex={pendingIndex}
          lastJudgment={lastJudgment}
        />
      </div>
      <KeyboardDisplay keyMapping={keyMapping} pressedKey={pressedKey} />
    </div>
  )
}
