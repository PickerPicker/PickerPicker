import { useCallback, useEffect, useRef, useState } from 'react'
import { TUTORIAL_STEPS } from './tutorialSteps'
import { TutorialBanner } from './TutorialBanner'
import { TutorialStage } from './TutorialStage'

interface TutorialScreenProps {
  onComplete: () => void
  onHitSfx: () => void
  onMissSfx: () => void
}

export function TutorialScreen({ onComplete, onHitSfx, onMissSfx }: TutorialScreenProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [cleared, setCleared] = useState(false)
  const [gauge, setGauge] = useState(100)
  const [progress, setProgress] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const clearedRef = useRef(false)
  const stepIdxRef = useRef(0)

  const step = TUTORIAL_STEPS[stepIdx]

  useEffect(() => {
    stepIdxRef.current = stepIdx
    clearedRef.current = false
    setCleared(false)
    setProgress(0)
    if (stepIdx === 0) setGauge(100)
  }, [stepIdx])

  const handleStepCleared = useCallback(() => {
    if (clearedRef.current) return
    clearedRef.current = true
    setCleared(true)
  }, [])

  const handleGaugeChange = useCallback((next: number) => {
    setGauge(next)
  }, [])

  // STEP 진행도 추적 (TutorialStage가 progress 자체 관리하므로 banner용 별도 tick으로 DOM에서 읽기)
  useEffect(() => {
    if (step.isReady) return
    const id = setInterval(() => {
      const el = document.querySelector('[data-tutorial-progress]') as HTMLElement | null
      if (el) {
        const v = Number(el.dataset.tutorialProgress ?? '0')
        setProgress(v)
      }
    }, 100)
    return () => clearInterval(id)
  }, [step.isReady])

  // READY 카운트다운
  useEffect(() => {
    if (!step.isReady) return
    setCountdown(step.countdownSec ?? 3)
    let sec = step.countdownSec ?? 3
    const id = setInterval(() => {
      sec -= 1
      setCountdown(sec)
      if (sec <= 0) {
        clearInterval(id)
        onComplete()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [step.isReady, step.countdownSec, onComplete])

  // 글로벌 키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setStepIdx(TUTORIAL_STEPS.length - 1)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setStepIdx(i => Math.max(0, i - 1))
        return
      }
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (step.isReady) {
          onComplete()
          return
        }
        if (clearedRef.current) {
          setStepIdx(i => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step.isReady, onComplete])

  const progressLabel = step.missMode
    ? `시도: ${progress} / ${step.target}`
    : step.target > 0
      ? `진행: ${progress} / ${step.target} 성공`
      : ''

  const gaugeColor = gauge <= 25 ? 'linear-gradient(90deg, #ff5577, #ffaa00)'
    : gauge <= 50 ? 'linear-gradient(90deg, #ffaa00, #ffd700)'
    : 'linear-gradient(90deg, #00b4ff, #00ffaa)'

  return (
    <div className="tutorial-stage flex flex-col h-screen bg-base-100">
      <TutorialBanner
        label={step.label}
        message={step.message}
        progress={progressLabel}
        cleared={cleared}
      />

      {/* 미니 HUD: 게이지 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-base-200 border-b border-base-300">
        <span className="font-mono text-xs text-base-content/60 tracking-widest">LIFE</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden bg-base-300 border border-base-content/20">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${gauge}%`, background: gaugeColor, boxShadow: '0 0 8px rgba(0,180,255,0.5)' }}
          />
        </div>
        <span className="font-mono text-xs text-base-content/60">{gauge}</span>
        {step.word && (
          <>
            <span className="font-mono text-xs text-base-content/40">|</span>
            <span className="font-mono text-xs text-base-content/60">단어:</span>
            <span className="font-bold text-base-content text-sm">{step.word}</span>
          </>
        )}
      </div>

      {step.isReady ? (
        <ReadyView countdown={countdown} />
      ) : (
        <TutorialStage
          step={step}
          gauge={gauge}
          onStepCleared={handleStepCleared}
          onGaugeChange={handleGaugeChange}
          onHitSfx={onHitSfx}
          onMissSfx={onMissSfx}
        />
      )}

      <KeyHintBar canPrev={stepIdx > 0} canNext={cleared || Boolean(step.isReady)} />
    </div>
  )
}

function ReadyView({ countdown }: { countdown: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/40">
      <div
        className="font-mono font-black tracking-[8px]"
        style={{
          fontSize: 56,
          color: '#00ffaa',
          textShadow: '0 0 30px rgba(0,255,170,0.7)',
        }}
      >
        READY!
      </div>
      <div
        className="font-mono font-black"
        style={{
          fontSize: 88,
          color: '#00b4ff',
          lineHeight: 1,
          textShadow: '0 0 30px rgba(0,180,255,0.8)',
        }}
      >
        {Math.max(0, countdown)}
      </div>
      <p className="font-mono text-xs tracking-widest text-base-content/50 mt-2">
        15개 스테이지 연속 진행 · 게이지 0 = GAME OVER
      </p>
    </div>
  )
}

function KeyHintBar({ canPrev, canNext }: { canPrev: boolean; canNext: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-t border-base-300 font-mono text-xs">
      <span className={`flex items-center gap-2 ${canPrev ? 'text-base-content/70' : 'text-base-content/25'}`}>
        <Kbd>←</Kbd> 이전
      </span>
      <span className="flex items-center gap-2 text-base-content/70">
        <Kbd>ESC</Kbd> 건너뛰기
      </span>
      <span className={`flex items-center gap-2 ${canNext ? 'text-base-content/70' : 'text-base-content/25'}`}>
        <Kbd primary>SPACE</Kbd> / <Kbd primary>→</Kbd> 다음
      </span>
    </div>
  )
}

function Kbd({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <kbd
      className="px-2 py-0.5 border border-b-2 rounded text-xs font-bold"
      style={{
        background: primary ? 'rgba(0,180,255,0.3)' : 'rgba(255,255,255,0.08)',
        borderColor: primary ? 'rgba(0,180,255,0.6)' : 'rgba(255,255,255,0.25)',
        color: '#fff',
        boxShadow: primary ? '0 0 8px rgba(0,180,255,0.5)' : 'none',
      }}
    >
      {children}
    </kbd>
  )
}
