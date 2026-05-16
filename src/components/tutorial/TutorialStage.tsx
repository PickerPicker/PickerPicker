import { useCallback, useEffect, useRef, useState } from 'react'
import type { JudgmentType } from '../../types'
import { JudgmentDisplay } from '../game/JudgmentDisplay'
import { KeyboardDisplay } from '../game/KeyboardDisplay'
import type { TutorialStep } from './tutorialSteps'
import { TUTORIAL_BPM } from './tutorialSteps'

const PERFECT_WINDOW = 100   // ms
const GOOD_WINDOW = 250
const NOTE_TRAVEL_BEATS = 4
const JUDGMENT_X = 80        // px from track left
const TRACK_RIGHT_MARGIN = 60 // px from track right (spawn point)

interface SpawnedNote {
  id: number
  syllable: string
  spawnTime: number
  arrivalTime: number
  hit: boolean
  hitType?: JudgmentType
}

interface TutorialStageProps {
  step: TutorialStep
  gauge: number
  onStepCleared: () => void
  onGaugeChange: (next: number) => void
  onHitSfx: () => void
  onMissSfx: () => void
}

export function TutorialStage({
  step,
  gauge,
  onStepCleared,
  onGaugeChange,
  onHitSfx,
  onMissSfx,
}: TutorialStageProps) {
  const beatMs = Math.round(60_000 / TUTORIAL_BPM)
  const travelMs = NOTE_TRAVEL_BEATS * beatMs

  const [notes, setNotes] = useState<SpawnedNote[]>([])
  const [progress, setProgress] = useState(0)
  const [lastJudgment, setLastJudgment] = useState<{ type: JudgmentType; id: number } | null>(null)
  const [pressedKey, setPressedKey] = useState<string | undefined>()
  const [trackWidth, setTrackWidth] = useState(800)

  const notesRef = useRef<SpawnedNote[]>([])
  const progressRef = useRef(0)
  const judgeIdRef = useRef(0)
  const noteIdRef = useRef(0)
  const clearedRef = useRef(false)
  const stepIdRef = useRef(step.id)
  const trackRef = useRef<HTMLDivElement | null>(null)

  // STEP 변경 시 상태 리셋
  useEffect(() => {
    notesRef.current = []
    progressRef.current = 0
    clearedRef.current = false
    judgeIdRef.current = 0
    noteIdRef.current = 0
    stepIdRef.current = step.id
    setNotes([])
    setProgress(0)
    setLastJudgment(null)
  }, [step.id])

  // 트랙 폭 측정
  useEffect(() => {
    const update = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.clientWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const markCleared = useCallback(() => {
    if (clearedRef.current) return
    clearedRef.current = true
    onStepCleared()
  }, [onStepCleared])

  const applyJudgment = useCallback((type: JudgmentType, note: SpawnedNote | null) => {
    if (type === 'MISS') onMissSfx()
    else onHitSfx()
    judgeIdRef.current += 1
    setLastJudgment({ type, id: judgeIdRef.current })

    if (note) {
      note.hit = true
      note.hitType = type
      setNotes(prev => prev.map(n => (n.id === note.id ? { ...n, hit: true, hitType: type } : n)))
    }

    if (type === 'PERFECT' || type === 'GOOD') {
      progressRef.current += 1
      setProgress(progressRef.current)
      if (progressRef.current >= step.target && !step.missMode) markCleared()
    }

    if (type === 'MISS' && step.gaugeLoss) {
      const next = Math.max(0, gauge - 15)
      onGaugeChange(next)
    }
  }, [gauge, onGaugeChange, onHitSfx, onMissSfx, step.gaugeLoss, step.missMode, step.target, markCleared])

  // 노트 spawn 루프
  useEffect(() => {
    if (step.isReady || step.noteLoop.length === 0) return
    let spawnIndex = 0
    const spawn = () => {
      const now = performance.now()
      const syl = step.noteLoop[spawnIndex % step.noteLoop.length]
      spawnIndex += 1
      const note: SpawnedNote = {
        id: noteIdRef.current++,
        syllable: syl,
        spawnTime: now,
        arrivalTime: now + travelMs,
        hit: false,
      }
      notesRef.current.push(note)
      setNotes([...notesRef.current])
    }
    spawn()
    const id = setInterval(spawn, beatMs)
    return () => clearInterval(id)
  }, [step.id, step.isReady, step.noteLoop, beatMs, travelMs])

  // 노트 정리: 통과한 노트 자동 MISS (튜토리얼: 게이지 미차감) + 화면 밖 제거
  useEffect(() => {
    if (step.isReady) return
    const id = setInterval(() => {
      const now = performance.now()
      let changed = false
      let removedAny = false
      notesRef.current = notesRef.current.filter(n => {
        const t = (now - n.spawnTime) / travelMs
        const x = computeNoteX(t, trackWidth)
        if (!n.hit && now - n.arrivalTime > GOOD_WINDOW) {
          n.hit = true
          n.hitType = 'MISS'
          changed = true
          if (!step.missMode) {
            judgeIdRef.current += 1
            setLastJudgment({ type: 'MISS', id: judgeIdRef.current })
            onMissSfx()
          }
        }
        if (n.hit && x < JUDGMENT_X - 60) {
          removedAny = true
          return false
        }
        return true
      })
      if (changed || removedAny) setNotes([...notesRef.current])
    }, 16)
    return () => clearInterval(id)
  }, [step.id, step.isReady, step.missMode, travelMs, trackWidth, onMissSfx])

  // 키 입력
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      const codeMap: Record<string, string> = {
        KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f',
        KeyJ: 'j', KeyK: 'k', KeyL: 'l', Semicolon: ';',
      }
      const key = codeMap[e.code]
      if (!key) return
      setPressedKey(e.code)
      setTimeout(() => setPressedKey(undefined), 100)

      const km = step.keyMapping.find(k => k.key === key)
      if (!km) return

      // STEP 3 (missMode): D 누름 = MISS 시연
      if (step.missMode && key === 'd') {
        applyJudgment('MISS', null)
        progressRef.current += 1
        setProgress(progressRef.current)
        if (progressRef.current >= step.target) markCleared()
        return
      }

      // 가까운 노트 찾기
      const now = performance.now()
      let best: SpawnedNote | null = null
      let bestDelta = Infinity
      notesRef.current.forEach(n => {
        if (n.hit) return
        const delta = Math.abs(now - n.arrivalTime)
        if (delta < bestDelta && delta < GOOD_WINDOW * 1.5) {
          best = n
          bestDelta = delta
        }
      })
      if (!best) return

      const noteSyllable = (best as SpawnedNote).syllable
      if (km.type !== 'valid' || km.syllable !== noteSyllable) {
        applyJudgment('MISS', best)
      } else if (bestDelta <= PERFECT_WINDOW) {
        applyJudgment('PERFECT', best)
      } else if (bestDelta <= GOOD_WINDOW) {
        applyJudgment('GOOD', best)
      } else {
        applyJudgment('MISS', best)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step.keyMapping, step.missMode, step.target, applyJudgment, markCleared])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 노트 트랙 */}
      <div ref={trackRef} className="relative flex-1 overflow-hidden bg-base-300/40">
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <JudgmentDisplay judgment={lastJudgment} perfectCombo={0} />
        </div>
        {/* 판정선 박스 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-28 h-28 border-4 rounded z-10"
          style={{
            left: JUDGMENT_X,
            borderColor: 'rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        {/* 노트들 */}
        {notes.map(n => (
          <NoteView key={n.id} note={n} travelMs={travelMs} trackWidth={trackWidth} hintActive={step.hintKeys.length > 0} />
        ))}
      </div>

      {/* 키보드 */}
      <KeyboardDisplay
        keyMapping={step.keyMapping}
        pressedKey={pressedKey}
        highlightSyllable={undefined}
      />

      {/* hint key 깜빡 효과 — KeyboardDisplay 위에 inline override */}
      <style>{`
        ${step.hintKeys.map(k => `
          .tutorial-stage [data-key="${k}"], .tutorial-stage .hint-${k} {
            animation: tutorial-key-pulse 1s infinite;
          }
        `).join('\n')}
        @keyframes tutorial-key-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(0,180,255,0.5); }
          50% { box-shadow: 0 0 22px rgba(0,180,255,1); }
        }
      `}</style>

      {/* progress hidden in 상위에서 banner로 노출 */}
      <div data-tutorial-progress={progress} style={{ display: 'none' }} />
    </div>
  )
}

function computeNoteX(t: number, trackWidth: number): number {
  // t: 0 → spawn at right, 1 → at judgment line
  const startX = trackWidth - TRACK_RIGHT_MARGIN
  return startX - (startX - JUDGMENT_X) * t
}

function NoteView({ note, travelMs, trackWidth, hintActive }: {
  note: SpawnedNote
  travelMs: number
  trackWidth: number
  hintActive: boolean
}) {
  const [x, setX] = useState(() => computeNoteX(0, trackWidth))
  const [opacity, setOpacity] = useState(1)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = performance.now()
      const t = (now - note.spawnTime) / travelMs
      setX(computeNoteX(t, trackWidth))
      if (note.hit) {
        setOpacity(0.3)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [note.spawnTime, note.hit, travelMs, trackWidth])

  const borderColor =
    note.hitType === 'PERFECT' ? '#00ffaa' :
    note.hitType === 'GOOD' ? '#ffd700' :
    note.hitType === 'MISS' ? '#ff5577' :
    hintActive ? '#00b4ff' : 'rgba(255,255,255,0.5)'

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center rounded border-[3px] font-black text-4xl text-white"
      style={{
        left: x,
        borderColor,
        background: 'rgba(0,180,255,0.18)',
        boxShadow: note.hit ? 'none' : '0 0 14px rgba(0,180,255,0.4)',
        opacity,
        transition: 'opacity 0.2s, border-color 0.15s',
      }}
    >
      {note.syllable}
    </div>
  )
}
