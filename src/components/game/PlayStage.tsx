import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameStat, JudgmentType, StageData } from '../../types'
import { JudgmentDisplay } from './JudgmentDisplay'
import { KeyboardDisplay } from './KeyboardDisplay'
import { NoteTrack } from './NoteTrack'

const PERFECT_WINDOW = 70
const GOOD_WINDOW = 140

interface PlayStageProps {
  stageData: StageData
  stat: GameStat
  onStatUpdate: (update: Partial<GameStat>) => void
  onStageComplete: () => void
  onGameOver: () => void
}

export function PlayStage({
  stageData,
  stat,
  onStatUpdate,
  onStageComplete,
  onGameOver,
}: PlayStageProps) {
  const { bpm, inputSyllables, keyMapping } = stageData
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
  useEffect(() => { pendingIndexRef.current = pendingIndex }, [pendingIndex])
  useEffect(() => { statRef.current = { ...statRef.current, perfectCombo } }, [perfectCombo])

  const onStatUpdateRef = useRef(onStatUpdate)
  const onGameOverRef = useRef(onGameOver)
  const onStageCompleteRef = useRef(onStageComplete)
  useEffect(() => { onStatUpdateRef.current = onStatUpdate }, [onStatUpdate])
  useEffect(() => { onGameOverRef.current = onGameOver }, [onGameOver])
  useEffect(() => { onStageCompleteRef.current = onStageComplete }, [onStageComplete])

  const applyJudgment = useCallback((type: JudgmentType) => {
    judgeCountRef.current += 1
    setLastJudgment({ type, id: judgeCountRef.current })

    const current = statRef.current
    let { score, gauge, perfectCombo: combo, perfectCount, goodCount, missCount } = current

    if (type === 'PERFECT') {
      combo += 1
      score += combo >= 5 ? 200 : 100
      gauge = Math.min(100, gauge + (combo >= 5 ? 2 : 1))
      perfectCount += 1
    } else if (type === 'GOOD') {
      combo = 0
      score += 50
      goodCount += 1
    } else {
      combo = 0
      gauge = Math.max(0, gauge - 15)
      missCount += 1
    }

    setPerfectCombo(combo)
    onStatUpdateRef.current({ score, gauge, perfectCombo: combo, perfectCount, goodCount, missCount })

    if (gauge <= 0) {
      onGameOverRef.current()
      return
    }

    const next = pendingIndexRef.current + 1
    setPendingIndex(next)
    pendingIndexRef.current = next

    if (next >= inputSyllables.length) {
      onStageCompleteRef.current()
    }
  }, [inputSyllables.length])

  // Auto-MISS: when note passes GOOD_WINDOW without input
  useEffect(() => {
    startTimeRef.current = Date.now()
    setPendingIndex(0)
    pendingIndexRef.current = 0
    setPerfectCombo(0)

    const interval = setInterval(() => {
      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return
      const arrivalTime = startTimeRef.current + idx * beatMs
      const delta = Date.now() - arrivalTime
      if (delta > GOOD_WINDOW) {
        applyJudgment('MISS')
      }
    }, 16)

    return () => clearInterval(interval)
  }, [stageData, beatMs, applyJudgment, inputSyllables.length])

  // Key input handler
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

      const arrivalTime = startTimeRef.current + idx * beatMs
      const delta = Math.abs(Date.now() - arrivalTime)
      const expectedSyllable = inputSyllables[idx]

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
  }, [stageData, keyMapping, inputSyllables, beatMs, applyJudgment])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 relative flex flex-col">
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <JudgmentDisplay judgment={lastJudgment} perfectCombo={perfectCombo} />
        </div>
        <NoteTrack
          inputSyllables={inputSyllables}
          beatMs={beatMs}
          startTime={startTimeRef.current}
          pendingIndex={pendingIndex}
        />
      </div>
      <KeyboardDisplay keyMapping={keyMapping} pressedKey={pressedKey} />
    </div>
  )
}
