const JUDGMENT_X = 80
const NOTE_TRAVEL_BEATS = 4

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  pendingIndex: number
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  pendingIndex,
}: NoteTrackProps) {
  const travelDuration = NOTE_TRAVEL_BEATS * beatMs
  // 2000px → -500px (총 2500px), 판정선(0) 도달 시각 = travelDuration 유지
  const totalDuration = Math.round(travelDuration * 2500 / 2000)

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-10"
        style={{ left: JUDGMENT_X }}
      />
      <div
        className="absolute top-2 text-xs text-primary/40 select-none"
        style={{ left: JUDGMENT_X + 4 }}
      >
        판정선
      </div>

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
