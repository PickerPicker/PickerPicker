import { useEffect, useRef } from 'react'
import type { StageData } from '../../types'
import { KeyboardDisplay } from './KeyboardDisplay'

const PREVIEW_DURATION_MS = 2000

interface PreviewStageProps {
  stageData: StageData
  onPreviewEnd: () => void
}

export function PreviewStage({ stageData, onPreviewEnd }: PreviewStageProps) {
  const { inputSyllables, keyMapping } = stageData
  const onPreviewEndRef = useRef(onPreviewEnd)

  useEffect(() => {
    onPreviewEndRef.current = onPreviewEnd
  }, [onPreviewEnd])

  useEffect(() => {
    const t = setTimeout(() => onPreviewEndRef.current(), PREVIEW_DURATION_MS)
    return () => clearTimeout(t)
  }, [stageData])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <span className="text-xs text-base-content/40 uppercase tracking-widest">
          리듬 큐
        </span>
        <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
          {inputSyllables.map((syl, i) => (
            <div
              key={i}
              className="w-12 h-12 flex items-center justify-center rounded border-2 font-bold text-lg border-base-content/30 text-base-content bg-base-300"
            >
              {syl}
            </div>
          ))}
        </div>
      </div>

      <KeyboardDisplay keyMapping={keyMapping} />
    </div>
  )
}
