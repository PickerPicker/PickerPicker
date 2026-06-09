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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 새 판정(judgment.id 변경) 발생 시 판정 텍스트를 즉시 표시하고 600ms 후 사라지게 하는 애니메이션 타이밍 로직. 동기 setState가 의도된 동작이므로 변경 금지
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
        <span className="text-lg font-bold text-primary/80">{perfectCombo} combo</span>
      )}
    </div>
  )
}
