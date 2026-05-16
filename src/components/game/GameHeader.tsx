interface GameHeaderProps {
  stage: number
  word: string
  gauge: number
  score: number
  combo?: number
  hideGauge?: boolean
  stageLabel?: string
}

export function GameHeader({ stage, word, gauge, score, combo = 0, hideGauge = false, stageLabel }: GameHeaderProps) {
  const gaugePercent = Math.max(0, Math.min(100, gauge))
  const gaugeColor =
    gaugePercent > 50 ? 'bg-primary' : gaugePercent > 25 ? 'bg-warning' : 'bg-error'

  return (
    <div className="flex flex-col bg-base-200 border-b border-base-300 shrink-0">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <span className="text-2xl font-bold text-base-content w-32">
          {stageLabel ?? `Stage ${stage}`}
        </span>

        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-base-content/50">이번 단어</span>
          <div className="flex gap-2">
            {word.split('').map((ch, i) => (
              <div
                key={i}
                className="w-14 h-14 flex items-center justify-center border-2 border-primary/50 rounded text-base-content font-bold text-2xl bg-base-300"
              >
                {ch}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 w-48">
          <span className="text-lg font-mono text-base-content/80">
            Score: {score.toString().padStart(6, '0')}
          </span>
          {combo > 0 && (
            <span className="text-xs font-bold text-warning">
              {combo} COMBO
            </span>
          )}
        </div>
      </div>

      {!hideGauge && (
        <div className="px-6 pb-4">
          <div className="w-full h-4 bg-base-300 rounded-full overflow-hidden">
            <div
              className={`h-full ${gaugeColor} rounded-full transition-all duration-300`}
              style={{ width: `${gaugePercent}%` }}
            />
          </div>
        </div>
      )}
      {hideGauge && <div className="pb-4" />}
    </div>
  )
}
