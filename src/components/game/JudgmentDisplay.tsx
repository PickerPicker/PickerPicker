import { useEffect, useState } from 'react'
import type { JudgmentType } from '../../types'

interface JudgmentDisplayProps {
  judgment: { type: JudgmentType; id: number } | null
  perfectCombo: number
}

const JUDGMENT_COLOR: Record<JudgmentType, string> = {
  PERFECT: 'text-yellow-400',
  GOOD: 'text-green-400',
  MISS: 'text-red-400',
}

export function JudgmentDisplay({ judgment, perfectCombo }: JudgmentDisplayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!judgment) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 600)
    return () => clearTimeout(t)
  }, [judgment?.id])

  return (
    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
      {visible && judgment && (
        <span
          className={`text-3xl font-black ${JUDGMENT_COLOR[judgment.type]}`}
          style={{ animation: 'judgment-fade 0.6s ease-out forwards' }}
          key={judgment.id}
        >
          {judgment.type}
        </span>
      )}
      {perfectCombo >= 2 && (
        <span className="text-lg font-bold text-primary/80">
          {perfectCombo} combo
        </span>
      )}
    </div>
  )
}
