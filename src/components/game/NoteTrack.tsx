import { useEffect, useState } from 'react'
import type { JudgmentType } from '../../types'

const JUDGMENT_X = 80
const NOTE_TRAVEL_BEATS = 4
const GLOW_DURATION = 200 // ms

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  pendingIndex: number
  lastJudgment?: { type: JudgmentType; id: number } | null
}

const JUDGMENT_GLOW: Record<JudgmentType, string> = {
  PERFECT: 'border-yellow-400 shadow-[0_0_16px_4px_rgba(250,204,21,0.7)]',
  GOOD:    'border-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.7)]',
  MISS:    'border-red-400 shadow-[0_0_16px_4px_rgba(248,113,113,0.7)]',
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  pendingIndex,
  lastJudgment,
}: NoteTrackProps) {
  const travelDuration = NOTE_TRAVEL_BEATS * beatMs
  // 2000px → -500px (총 2500px), 판정선(0) 도달 시각 = travelDuration 유지
  const totalDuration = Math.round(travelDuration * 2500 / 2000)

  // 판정 후 GLOW_DURATION ms 뒤 자동 리셋
  const [activeJudgment, setActiveJudgment] = useState<JudgmentType | null>(null)
  useEffect(() => {
    if (!lastJudgment) return
    setActiveJudgment(lastJudgment.type)
    const t = setTimeout(() => setActiveJudgment(null), GLOW_DURATION)
    return () => clearTimeout(t)
  }, [lastJudgment?.id])

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* 판정 위치 placeholder — 판정 결과에 따라 테두리 glow */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-36 h-36 rounded border-4 z-10 transition-all duration-150
          ${activeJudgment ? JUDGMENT_GLOW[activeJudgment] : 'border-base-content/20 bg-base-300/40'}
        `}
        style={{ left: JUDGMENT_X }}
      />

      {inputSyllables.map((syllable, i) => {
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
              opacity: i === pendingIndex ? 1 : 0.4,
            }}
          >
            <div
              className={`
                w-36 h-36 flex items-center justify-center rounded border-4 font-bold text-6xl
                ${i === pendingIndex
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
