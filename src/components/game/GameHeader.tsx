interface GameHeaderProps {
  stage: number
  word: string
  gauge: number
  score: number
}

export function GameHeader({ stage, word, gauge, score }: GameHeaderProps) {
  const gaugePercent = Math.max(0, Math.min(100, gauge))
  const gaugeColor =
    gaugePercent > 50 ? 'bg-primary' : gaugePercent > 25 ? 'bg-warning' : 'bg-error'

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 shrink-0">
      <span className="text-lg font-bold text-base-content w-24">
        Stage {stage}
      </span>

      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-base-content/50">이번 단어</span>
        <div className="flex gap-1">
          {word.split('').map((ch, i) => (
            <div
              key={i}
              className="w-8 h-8 flex items-center justify-center border border-primary/50 rounded text-base-content font-bold text-sm bg-base-300"
            >
              {ch}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 w-40">
        <div className="w-full h-3 bg-base-300 rounded-full overflow-hidden">
          <div
            className={`h-full ${gaugeColor} transition-all duration-300`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
        <span className="text-sm font-mono text-base-content/80">
          Score: {score.toString().padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
