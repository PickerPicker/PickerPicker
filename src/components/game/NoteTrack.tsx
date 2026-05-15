const JUDGMENT_X = 80
const NOTE_TRAVEL_BEATS = 4

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  startTime: number
  pendingIndex: number
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  startTime,
  pendingIndex,
}: NoteTrackProps) {
  const travelDuration = NOTE_TRAVEL_BEATS * beatMs

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

        const delay = i * beatMs - travelDuration

        return (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: JUDGMENT_X,
              animation: `note-slide ${travelDuration}ms linear`,
              animationDelay: `${delay}ms`,
              animationFillMode: 'backwards',
              opacity: i === pendingIndex ? 1 : 0.4,
            }}
          >
            <div
              className={`
                w-12 h-12 flex items-center justify-center rounded border-2 font-bold text-lg
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
