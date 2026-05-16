import { useEffect, useRef } from 'react'
import type { StageData } from '../../types'
import { KeyboardDisplay } from './KeyboardDisplay'

const PREVIEW_DURATION_MS = 2000

interface PreviewStageProps {
  stageData: StageData
  onPreviewEnd: () => void
}

function getSyllableLayout(count: number): { size: string; maxWidth: string; gap: string } {
  if (count <= 16) return { size: 'w-20 h-20 text-3xl', maxWidth: 'max-w-2xl', gap: 'gap-2' }
  if (count <= 32) return { size: 'w-16 h-16 text-2xl', maxWidth: 'max-w-4xl', gap: 'gap-2' }
  return { size: 'w-12 h-12 text-xl', maxWidth: 'max-w-5xl', gap: 'gap-1.5' }
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

  const { size, maxWidth, gap } = getSyllableLayout(inputSyllables.length)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 min-h-0 overflow-hidden">
        <span className="text-xs text-base-content/40 uppercase tracking-widest">
          리듬 큐
        </span>
        <div className={`flex flex-wrap ${gap} justify-center ${maxWidth}`}>
          {inputSyllables.map((syl, i) => (
            <div
              key={i}
              className={`${size} flex items-center justify-center rounded border-2 font-bold border-base-content/30 text-base-content bg-base-300`}
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
