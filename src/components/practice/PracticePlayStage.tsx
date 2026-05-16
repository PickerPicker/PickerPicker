import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameStat, JudgmentType, StageData } from '../../types'
import { JudgmentDisplay } from '../game/JudgmentDisplay'
import { KeyboardDisplay } from '../game/KeyboardDisplay'
import { NoteTrack } from '../game/NoteTrack'

const PERFECT_WINDOW = 40
const GOOD_WINDOW = 100
const NOTE_TRAVEL_BEATS = 4

interface PracticePlayStageProps {
  stageData: StageData
  stat: GameStat
  onStatUpdate: (update: Partial<GameStat>) => void
  onStageComplete: () => void
  onHitSfx: () => void
  onMissSfx: () => void
  offset: number
}

export function PracticePlayStage({
  stageData,
  stat,
  onStatUpdate,
  onStageComplete,
  onHitSfx,
  onMissSfx,
  offset,
}: PracticePlayStageProps) {
  const { bpm, inputSyllables, keyMapping, validSyllables } = stageData
  const beatMs = Math.round(60_000 / bpm)

  const [pendingIndex, setPendingIndex] = useState(0)
  const [lastJudgment, setLastJudgment] = useState<{ type: JudgmentType; id: number } | null>(null)
  const [pressedKey, setPressedKey] = useState<string | undefined>()
  const [perfectCombo, setPerfectCombo] = useState(0)

  const startTimeRef = useRef(Date.now())
  const pendingIndexRef = useRef(0)
  const statRef = useRef(stat)
  const judgeCountRef = useRef(0)

  useEffect(() => { statRef.current = stat }, [stat])

  const onStatUpdateRef = useRef(onStatUpdate)
  const onStageCompleteRef = useRef(onStageComplete)
  const onHitSfxRef = useRef(onHitSfx)
  const onMissSfxRef = useRef(onMissSfx)
  useEffect(() => { onStatUpdateRef.current = onStatUpdate }, [onStatUpdate])
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

  // 연습모드: 게이지 변화/게임오버 처리 없음. 점수/콤보/카운트만 갱신.
  const applyJudgment = useCallback((type: JudgmentType) => {
    if (type === 'MISS') onMissSfxRef.current()
    else onHitSfxRef.current()

    judgeCountRef.current += 1
    setLastJudgment({ type, id: judgeCountRef.current })

    const current = statRef.current
    let { score, perfectCombo: combo, maxCombo, perfectCount, goodCount, missCount } = current

    if (type === 'PERFECT') {
      combo += 1
      if (combo > maxCombo) maxCombo = combo
      score += combo >= 5 ? 200 : 100
      perfectCount += 1
    } else if (type === 'GOOD') {
      combo = 0
      score += 50
      goodCount += 1
    } else {
      combo = 0
      missCount += 1
    }

    const newStat: GameStat = {
      score,
      gauge: 100,  // 연습모드는 항상 100으로 고정 (사용처에서 표시 안 함)
      perfectCombo: combo,
      maxCombo,
      perfectCount,
      goodCount,
      missCount,
    }
    statRef.current = newStat
    setPerfectCombo(combo)
    onStatUpdateRef.current(newStat)

    advancePending()
  }, [advancePending])

  useLayoutEffect(() => {
    startTimeRef.current = Date.now() + NOTE_TRAVEL_BEATS * beatMs
    pendingIndexRef.current = 0
    setPendingIndex(0)
    setPerfectCombo(0)
  }, [stageData, beatMs])

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return
      const arrivalTime = startTimeRef.current + idx * beatMs + offset
      const delta = Date.now() - arrivalTime
      if (delta > GOOD_WINDOW) {
        if (validSyllables.includes(inputSyllables[idx])) {
          applyJudgment('MISS')
        } else {
          const next = pendingIndexRef.current + 1
          pendingIndexRef.current = next
          setPendingIndex(next)
          if (next >= inputSyllables.length) onStageCompleteRef.current()
        }
      }
    }, 16)
    return () => clearInterval(interval)
  }, [stageData, beatMs, applyJudgment, inputSyllables, validSyllables, offset])

  useEffect(() => {
    const codeMap: Record<string, string> = {
      a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF',
      j: 'KeyJ', k: 'KeyK', l: 'KeyL', ';': 'Semicolon',
    }

    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
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
