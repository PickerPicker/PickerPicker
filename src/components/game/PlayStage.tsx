import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameStat, JudgmentType, StageData } from '../../types'
import { JudgmentDisplay } from './JudgmentDisplay'
import { KeyboardDisplay } from './KeyboardDisplay'
import { NoteTrack } from './NoteTrack'

const PERFECT_WINDOW = 70
const GOOD_WINDOW = 140
const NOTE_TRAVEL_BEATS = 4

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
  const gameOverRef = useRef(false) // prevents double game-over

  // Keep statRef in sync with prop (async, for non-critical reads)
  useEffect(() => { statRef.current = stat }, [stat])

  // Sync callbacks via refs to avoid stale closures
  const onStatUpdateRef = useRef(onStatUpdate)
  const onGameOverRef = useRef(onGameOver)
  const onStageCompleteRef = useRef(onStageComplete)
  useEffect(() => { onStatUpdateRef.current = onStatUpdate }, [onStatUpdate])
  useEffect(() => { onGameOverRef.current = onGameOver }, [onGameOver])
  useEffect(() => { onStageCompleteRef.current = onStageComplete }, [onStageComplete])

  // 무효 음절 노트를 패널티 없이 넘긴다
  const advanceInvalidNote = useCallback(() => {
    const next = pendingIndexRef.current + 1
    pendingIndexRef.current = next
    setPendingIndex(next)
    if (next >= inputSyllables.length) {
      onStageCompleteRef.current()
    }
  }, [inputSyllables.length])

  const applyJudgment = useCallback((type: JudgmentType) => {
    if (gameOverRef.current) return // guard against double game-over

    judgeCountRef.current += 1
    setLastJudgment({ type, id: judgeCountRef.current })

    // Read from statRef synchronously
    const current = statRef.current
    let { score, gauge, perfectCombo: combo, maxCombo, perfectCount, goodCount, missCount } = current

    if (type === 'PERFECT') {
      combo += 1
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

    // Update statRef synchronously so next call reads fresh values
    const newStat = { score, gauge, perfectCombo: combo, maxCombo, perfectCount, goodCount, missCount }
    statRef.current = newStat

    setPerfectCombo(combo)
    onStatUpdateRef.current(newStat)

    if (gauge <= 0) {
      gameOverRef.current = true
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

  // Reset state when stage changes
  useEffect(() => {
    startTimeRef.current = Date.now() + NOTE_TRAVEL_BEATS * beatMs
    setPendingIndex(0)
    pendingIndexRef.current = 0
    setPerfectCombo(0)
    gameOverRef.current = false

    const interval = setInterval(() => {
      if (gameOverRef.current) return
      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return
      const arrivalTime = startTimeRef.current + idx * beatMs
      const delta = Date.now() - arrivalTime
      if (delta > GOOD_WINDOW) {
        if (validSyllables.includes(inputSyllables[idx])) {
          applyJudgment('MISS')
        } else {
          advanceInvalidNote()
        }
      }
    }, 16)

    return () => clearInterval(interval)
  }, [stageData, beatMs, applyJudgment, advanceInvalidNote, inputSyllables, validSyllables])

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

      // 무효 음절 노트는 키 입력을 무시 (자동으로 window 초과 시 넘어감)
      if (!validSyllables.includes(expectedSyllable)) return

      const arrivalTime = startTimeRef.current + idx * beatMs
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
          pendingIndex={pendingIndex}
        />
      </div>
      <KeyboardDisplay keyMapping={keyMapping} pressedKey={pressedKey} />
    </div>
  )
}
