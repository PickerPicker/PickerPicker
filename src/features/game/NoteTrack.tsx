import { useEffect, useRef, useState } from 'react'
import type { JudgmentType } from '../../types'

const JUDGMENT_X = 80
const NOTE_TRAVEL_BEATS = 4
const NOTE_END_X_ABS = 200
const GLOW_DURATION = 200

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  pendingIndex: number
  lastJudgment?: { type: JudgmentType; id: number } | null
  isPaused?: boolean
}

const JUDGMENT_GLOW: Record<JudgmentType, string> = {
  PERFECT: 'border-yellow-400 shadow-[0_0_16px_4px_rgba(250,204,21,0.7)]',
  GOOD: 'border-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.7)]',
  MISS: 'border-red-400 shadow-[0_0_16px_4px_rgba(248,113,113,0.7)]',
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  pendingIndex,
  lastJudgment,
  isPaused = false,
}: NoteTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const apply = (width: number) => {
      const startX = Math.max(0, width - JUDGMENT_X)
      el.style.setProperty('--note-start-x', `${startX}px`)
      el.style.setProperty('--note-end-x', `-${NOTE_END_X_ABS}px`)
      setTrackWidth(width)
    }

    apply(el.offsetWidth)

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        apply(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const travelDuration = NOTE_TRAVEL_BEATS * beatMs
  const startToJudgment = Math.max(1, trackWidth - JUDGMENT_X)
  const totalDistance = startToJudgment + NOTE_END_X_ABS
  const totalDuration = Math.round((travelDuration * totalDistance) / startToJudgment)

  const [activeJudgment, setActiveJudgment] = useState<JudgmentType | null>(null)
  useEffect(() => {
    if (!lastJudgment) return
    setActiveJudgment(lastJudgment.type)
    const t = setTimeout(() => setActiveJudgment(null), GLOW_DURATION)
    return () => clearTimeout(t)
  }, [lastJudgment?.id])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-36 h-36 rounded border-4 z-10 transition-all duration-150
          ${activeJudgment ? JUDGMENT_GLOW[activeJudgment] : 'border-base-content/20 bg-base-300/40'}
        `}
        style={{ left: JUDGMENT_X }}
      />

      {trackWidth > 0 &&
        inputSyllables.map((syllable, i) => {
          if (i < pendingIndex - 1) return null

          const delay = i * beatMs

          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: JUDGMENT_X,
                animation: `note-slide ${totalDuration}ms linear`,
                animationDelay: `${delay}ms`,
                animationFillMode: 'both',
                animationPlayState: isPaused ? 'paused' : 'running',
                opacity: i === pendingIndex ? 1 : 0.4,
              }}
            >
              <div
                className={`
                w-36 h-36 flex items-center justify-center rounded border-4 font-bold text-6xl
                ${
                  i === pendingIndex
                    ? 'border-primary bg-primary/30 text-primary'
                    : 'border-base-content/30 bg-base-300 text-base-content/60'
                }
              `}
              >
                {syllable}
              </div>
            </div>
          )
        })}
    </div>
  )
}
