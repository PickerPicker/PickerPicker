import type { KeyMapping } from '../../types'

interface KeyboardDisplayProps {
  keyMapping: KeyMapping[]
  highlightSyllable?: string
  pressedKey?: string
  /** 튜토리얼 전용: 누르라고 강조할 키 (펄스 ring) */
  hintKeys?: string[]
  /** 튜토리얼 전용: 강조 색상 (예: 'primary' | 'error') */
  hintTone?: 'primary' | 'error'
}

const KEY_CODE_MAP: Record<string, string> = {
  a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF',
  j: 'KeyJ', k: 'KeyK', l: 'KeyL', ';': 'Semicolon',
}

export function KeyboardDisplay({
  keyMapping,
  highlightSyllable,
  pressedKey,
  hintKeys,
  hintTone = 'primary',
}: KeyboardDisplayProps) {
  const left = keyMapping.slice(0, 4)
  const right = keyMapping.slice(4, 8)

  function renderKey(km: KeyMapping) {
    const code = KEY_CODE_MAP[km.key]
    const isHighlighted = highlightSyllable === km.syllable
    const isPressed = pressedKey === code
    const isHint = hintKeys?.includes(km.key)
    const hintBg = isHint
      ? hintTone === 'error'
        ? 'bg-error/40 text-white border-error animate-pulse'
        : 'bg-primary/60 text-primary-content border-primary animate-pulse'
      : ''

    return (
      <div
        key={km.key}
        className={`
          relative flex flex-col items-center justify-center w-20 h-20 rounded border-2 font-bold select-none
          transition-all duration-75
          ${km.type === 'valid' ? 'border-primary/70' : 'border-base-content/20'}
          ${isHighlighted || isPressed
            ? 'bg-primary text-primary-content scale-110 border-primary shadow-lg shadow-primary/40'
            : 'bg-base-300 text-base-content'
          }
          ${hintBg}
        `}
      >
        {isHint && (
          <span
            className="absolute -top-7 text-3xl"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              color: hintTone === 'error' ? '#ff5577' : '#00b4ff',
              textShadow: hintTone === 'error' ? '0 0 10px rgba(255,85,119,0.9)' : '0 0 10px rgba(0,180,255,0.9)',
              animation: 'tutorial-arrow-bounce 0.6s infinite alternate',
            }}
            aria-hidden
          >
            ▼
          </span>
        )}
        <span className="text-2xl">{km.syllable}</span>
        <span className="text-sm text-base-content/70 uppercase">[{km.key}]</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-4 bg-base-200 border-t border-base-300 shrink-0 relative">
      <style>{`
        @keyframes tutorial-arrow-bounce {
          from { transform: translateX(-50%) translateY(0); }
          to   { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
      <div className="flex gap-2">{left.map(renderKey)}</div>
      <div className="w-8" />
      <div className="flex gap-2">{right.map(renderKey)}</div>
    </div>
  )
}
