import { useEffect, useRef, useState } from 'react'

type CountValue = 3 | 2 | 1 | 'GO!'
const SEQUENCE: CountValue[] = [3, 2, 1, 'GO!']
const STEP_MS = 500

interface CountdownOverlayProps {
  onComplete: () => void
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [index, setIndex] = useState(0)
  const mountedRef = useRef(true)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    mountedRef.current = true
    const interval = setInterval(() => {
      if (!mountedRef.current) return
      setIndex(prev => {
        const next = prev + 1
        if (next >= SEQUENCE.length) {
          clearInterval(interval)
          setTimeout(() => {
            if (mountedRef.current) onCompleteRef.current()
          }, STEP_MS)
          return prev
        }
        return next
      })
    }, STEP_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  const value = SEQUENCE[index]
  const isGo = value === 'GO!'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none bg-black/40">
      <div
        className={`font-black tracking-widest drop-shadow-[0_0_24px_rgba(255,255,255,0.6)]
          ${isGo ? 'text-success text-9xl' : 'text-white text-[12rem] leading-none'}
        `}
      >
        {value}
      </div>
    </div>
  )
}
