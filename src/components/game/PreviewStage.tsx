import { useEffect, useRef, useState } from 'react'
import type { StageData } from '../../types'
import { KeyboardDisplay } from './KeyboardDisplay'

interface PreviewStageProps {
  stageData: StageData
  onPreviewEnd: () => void
}

export function PreviewStage({ stageData, onPreviewEnd }: PreviewStageProps) {
  const { bpm, inputSyllables, keyMapping } = stageData
  const beatMs = Math.round(60_000 / bpm)

  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPreviewEndRef = useRef(onPreviewEnd)

  useEffect(() => {
    onPreviewEndRef.current = onPreviewEnd
  }, [onPreviewEnd])

  useEffect(() => {
    setCurrentIndex(0)
    let idx = 0

    timerRef.current = setInterval(() => {
      idx += 1
      if (idx >= inputSyllables.length) {
        clearInterval(timerRef.current!)
        timeoutRef.current = setTimeout(() => onPreviewEndRef.current(), beatMs)
      } else {
        setCurrentIndex(idx)
      }
    }, beatMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [stageData, beatMs, inputSyllables.length])

  const currentSyllable = inputSyllables[currentIndex]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <span className="text-xs text-base-content/40 uppercase tracking-widest">
          리듬 큐 — 미리보기
        </span>
        <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
          {inputSyllables.map((syl, i) => {
            const isCurrent = i === currentIndex
            const isDone = i < currentIndex
            return (
              <div
                key={i}
                className={`
                  w-12 h-12 flex items-center justify-center rounded border-2 font-bold text-lg
                  transition-all duration-100
                  ${isDone
                    ? 'border-base-content/10 text-base-content/20 bg-base-300/30'
                    : isCurrent
                    ? 'border-primary bg-primary/20 text-primary scale-110'
                    : 'border-base-content/30 text-base-content bg-base-300'
                  }
                `}
                style={isCurrent ? { animation: 'preview-pulse 0.3s ease-in-out' } : {}}
              >
                {syl}
              </div>
            )
          })}
        </div>
      </div>

      <KeyboardDisplay
        keyMapping={keyMapping}
        highlightSyllable={currentSyllable}
      />
    </div>
  )
}
