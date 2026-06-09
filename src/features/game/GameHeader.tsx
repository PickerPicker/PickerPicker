import { useScoreEffects } from './useScoreEffects'

interface GameHeaderProps {
  stage: number
  word: string
  gauge: number
  score: number
  combo?: number
  hideGauge?: boolean
  stageLabel?: string
}

export function GameHeader({
  stage,
  word,
  gauge,
  score,
  combo = 0,
  hideGauge = false,
  stageLabel,
}: GameHeaderProps) {
  const gaugePercent = Math.max(0, Math.min(100, gauge))
  const gaugeColor =
    gaugePercent > 50 ? 'bg-primary' : gaugePercent > 25 ? 'bg-warning' : 'bg-error'

  const { scoreKey, comboKey, feverEnterKey, isFever, comboScale } = useScoreEffects(score, combo)

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

        <div
          key={feverEnterKey}
          className={`relative flex flex-col items-end gap-0.5 w-48 rounded-lg px-2 ${
            feverEnterKey > 0 ? 'animate-fever-flash' : ''
          }`}
        >
          <div className="flex items-center gap-1.5">
            {isFever && (
              <span className="animate-fever-badge text-xs font-black tracking-wider text-warning">
                🔥 FEVER
              </span>
            )}
            <span className="text-xs font-semibold tracking-widest text-base-content/40">
              SCORE
            </span>
          </div>
          <span
            key={scoreKey}
            className={`animate-score-bump text-3xl font-bold font-mono leading-none origin-right tabular-nums ${
              isFever ? 'animate-fever-shift' : 'text-primary'
            }`}
          >
            {score.toLocaleString('en-US')}
          </span>
          {combo > 0 && (
            <span
              key={comboKey}
              className={`text-xs font-bold font-mono mt-1 origin-right text-warning ${
                comboKey > 0 ? 'animate-combo-pop' : ''
              }`}
              style={{ transform: `scale(${comboScale})` }}
            >
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
