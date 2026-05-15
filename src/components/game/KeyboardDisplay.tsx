import type { KeyMapping } from '../../types'

interface KeyboardDisplayProps {
  keyMapping: KeyMapping[]
  highlightSyllable?: string
  pressedKey?: string
}

const KEY_CODE_MAP: Record<string, string> = {
  a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF',
  j: 'KeyJ', k: 'KeyK', l: 'KeyL', ';': 'Semicolon',
}

export function KeyboardDisplay({
  keyMapping,
  highlightSyllable,
  pressedKey,
}: KeyboardDisplayProps) {
  const left = keyMapping.slice(0, 4)
  const right = keyMapping.slice(4, 8)

  function renderKey(km: KeyMapping) {
    const code = KEY_CODE_MAP[km.key]
    const isHighlighted = highlightSyllable === km.syllable
    const isPressed = pressedKey === code

    return (
      <div
        key={km.key}
        className={`
          flex flex-col items-center justify-center w-16 h-16 rounded border-2 font-bold select-none
          transition-all duration-75
          ${km.type === 'valid' ? 'border-primary/70' : 'border-base-content/20'}
          ${isHighlighted || isPressed
            ? 'bg-primary text-primary-content scale-110 border-primary shadow-lg shadow-primary/40'
            : 'bg-base-300 text-base-content'
          }
        `}
      >
        <span className="text-lg">{km.syllable}</span>
        <span className="text-xs text-base-content/50 uppercase">[{km.key}]</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3 bg-base-200 border-t border-base-300 shrink-0">
      <div className="flex gap-2">{left.map(renderKey)}</div>
      <div className="w-8" />
      <div className="flex gap-2">{right.map(renderKey)}</div>
    </div>
  )
}
