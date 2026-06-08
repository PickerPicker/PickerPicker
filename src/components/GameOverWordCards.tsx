import type { StageResultItem } from '../services/playerService'

interface Props {
  results: StageResultItem[]
  wordsLookup: Record<number, { word: string; difficulty_level: number }>
}

export function GameOverWordCards({ results, wordsLookup }: Props) {
  if (results.length === 0) {
    return <p className="text-base-content/50 text-sm">기록된 단어가 없습니다.</p>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto pr-1">
      {results.map((r, i) => {
        const word = wordsLookup[r.word_id]
        const total = r.perfect_count + r.good_count + r.miss_count
        const myAcc = total > 0 ? (r.perfect_count + r.good_count * 0.5) / total : 0
        return (
          <div
            key={i}
            className="rounded-lg p-2 text-xs backdrop-blur text-white/90"
            style={{ background: 'rgba(8,12,28,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">{word?.word ?? '?'}</span>
              <span className="badge badge-xs">Lv {word?.difficulty_level ?? '?'}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              <div>점수: <b>{r.stage_score}</b></div>
              {total > 0 && <div>정확도: <b>{(myAcc * 100).toFixed(0)}%</b></div>}
              {total > 0 && (
                <div className="flex gap-1">
                  <span className="badge badge-success badge-xs">P {r.perfect_count}</span>
                  <span className="badge badge-info badge-xs">G {r.good_count}</span>
                  <span className="badge badge-error badge-xs">M {r.miss_count}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
