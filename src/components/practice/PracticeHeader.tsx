import { CloseButton } from '../common/CloseButton'

interface PracticeHeaderProps {
  levelTitle: string
  stepIndex: number       // 0~2
  word: string
  score: number
  combo?: number
  onExit: () => void
}

export function PracticeHeader({ levelTitle, stepIndex, word, score, combo = 0, onExit }: PracticeHeaderProps) {
  return (
    <div className="flex flex-col bg-base-200 border-b border-base-300 shrink-0">
      <div className="flex items-center justify-between px-6 pt-4 pb-4">
        <div className="flex flex-col gap-1 w-40">
          <span className="text-[10px] tracking-widest text-primary/80" style={{  }}>
            [PRACTICE]
          </span>
          <span className="text-lg font-bold text-base-content leading-tight">
            {levelTitle}
          </span>
          <span className="text-xs text-base-content/50" style={{  }}>
            {stepIndex + 1} / 3
          </span>
        </div>

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

        <div className="flex flex-col items-end gap-2 w-40">
          <span className="text-lg font-mono text-base-content/80">
            Score: {score.toString().padStart(6, '0')}
          </span>
          {combo > 0 && (
            <span className="text-xs font-bold text-warning font-mono">
              {combo} COMBO
            </span>
          )}
          <CloseButton onClick={onExit} label="메뉴" />
        </div>
      </div>
    </div>
  )
}
