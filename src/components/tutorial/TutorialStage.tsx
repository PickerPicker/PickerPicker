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
  progressLabel: string
  cleared: boolean
  onStepCleared: () => void
  onGaugeChange: (next: number) => void
  onHitSfx: () => void
  onMissSfx: () => void
}

export function TutorialStage({
  step,
  gauge,
  progressLabel,
  cleared,
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

  // 노트 spawn 루프 — step 진입 700ms 후 시작 (메시지 페이드인 + 사용자 준비 시간), cleared 되면 즉시 정지
  useEffect(() => {
    if (step.isReady || step.noteLoop.length === 0 || cleared) return
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
    let intervalId: ReturnType<typeof setInterval> | null = null
    const startDelay = setTimeout(() => {
      spawn()
      intervalId = setInterval(spawn, beatMs)
    }, 700)
    return () => {
      clearTimeout(startDelay)
      if (intervalId) clearInterval(intervalId)
    }
  }, [step.id, step.isReady, step.noteLoop, beatMs, travelMs, cleared])

  // 노트 정리: 튜토리얼은 통과해도 MISS 안 띄움 — 그냥 조용히 사라짐 (학습 부담 X)
  useEffect(() => {
    if (step.isReady) return
    const id = setInterval(() => {
      const now = performance.now()
      let removedAny = false
      notesRef.current = notesRef.current.filter(n => {
        const t = (now - n.spawnTime) / travelMs
        const x = computeNoteX(t, trackWidth)
        if (!n.hit && now - n.arrivalTime > GOOD_WINDOW) {
          n.hit = true
        }
        if (n.hit && x < JUDGMENT_X - 60) {
          removedAny = true
          return false
        }
        return true
      })
      if (removedAny) setNotes([...notesRef.current])
    }, 16)
    return () => clearInterval(id)
  }, [step.id, step.isReady, travelMs, trackWidth])

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

  // hint 키 색상 tone: invalid 키면 빨강(이건 틀린 키), valid 키면 파랑(눌러라)
  const hintIsInvalid = step.hintKeys.some(k => {
    const km = step.keyMapping.find(m => m.key === k)
    return km?.type === 'invalid'
  })
  const hintTone: 'primary' | 'error' = hintIsInvalid ? 'error' : 'primary'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 노트 트랙 */}
      <div ref={trackRef} className="relative flex-1 overflow-hidden bg-base-300/40">
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <JudgmentDisplay judgment={lastJudgment} perfectCombo={0} />
        </div>
        {/* 판정선 박스 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-32 h-32 border-4 rounded-lg z-10"
          style={{
            left: JUDGMENT_X,
            borderColor: 'rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        {notes.map(n => (
          <NoteView key={n.id} note={n} travelMs={travelMs} trackWidth={trackWidth} hintActive={step.hintKeys.length > 0} />
        ))}
      </div>

      {/* 키보드 바로 위 안내 메시지 (STEP 배지 + 메시지 + 진행도, 페이드 in) */}
      <div
        key={`${step.id}-${cleared ? 'done' : 'play'}`}
        className={`flex items-center justify-center gap-4 px-4 py-4 border-t border-base-300 tutorial-fade ${cleared ? 'bg-success/15' : 'bg-base-200'}`}
      >
        {cleared ? (
          <span className="text-2xl font-black tracking-wide text-success">
            ✓ 잘했어요!
          </span>
        ) : (
          <>
            <span
              className="px-3 py-1 rounded font-mono text-xs font-black tracking-[2px]"
              style={{
                background: 'rgba(0,180,255,0.2)',
                border: '1px solid rgba(0,180,255,0.5)',
                color: '#00b4ff',
              }}
            >
              {step.label}
            </span>
            <span className="text-lg font-bold tracking-wide text-base-content">
              {step.message}
            </span>
            {progressLabel && (
              <span className="font-mono text-base font-bold text-primary">
                {progressLabel}
              </span>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes tutorial-fade-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .tutorial-fade { animation: tutorial-fade-in 0.45s ease-out; }
      `}</style>

      <KeyboardDisplay
        keyMapping={step.keyMapping}
        pressedKey={pressedKey}
        hintKeys={step.hintKeys}
        hintTone={hintTone}
      />

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
      className="absolute top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center rounded-lg border-4 font-black text-6xl text-white"
      style={{
        left: x,
        borderColor,
        background: 'rgba(0,180,255,0.22)',
        boxShadow: note.hit ? 'none' : '0 0 22px rgba(0,180,255,0.55)',
        opacity,
        transition: 'opacity 0.2s, border-color 0.15s',
      }}
    >
      {note.syllable}
    </div>
  )
}
