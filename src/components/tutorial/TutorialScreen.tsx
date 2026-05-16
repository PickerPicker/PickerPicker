import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseButton } from '../common/CloseButton'
import { TUTORIAL_STEPS } from './tutorialSteps'
import { TutorialStage } from './TutorialStage'

interface TutorialScreenProps {
  /** 마지막 STEP 완료 시 호출 (자동 노출 흐름에서 본 게임 진입) */
  onComplete: () => void
  /** ESC / 나가기 버튼으로 즉시 종료 */
  onExit: () => void
  /** 자동 노출 흐름이면 true — STEP 4에 READY 카운트다운 표시 */
  showReadyCountdown: boolean
  onHitSfx: () => void
  onMissSfx: () => void
}

export function TutorialScreen({ onComplete, onExit, showReadyCountdown, onHitSfx, onMissSfx }: TutorialScreenProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [cleared, setCleared] = useState(false)
  const [gauge, setGauge] = useState(100)
  const [progress, setProgress] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const clearedRef = useRef(false)

  const step = TUTORIAL_STEPS[stepIdx]

  useEffect(() => {
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

  // 클리어 후 자동 다음 STEP
  useEffect(() => {
    if (!cleared || step.isReady) return
    const id = setTimeout(() => {
      setStepIdx(i => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
    }, 1200)
    return () => clearTimeout(id)
  }, [cleared, step.isReady])

  const handleGaugeChange = useCallback((next: number) => {
    setGauge(next)
  }, [])

  // STEP 진행도 추적
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

  // STEP 4: 자동 노출이면 READY 카운트다운, 시작화면 진입이면 짧게 보여주고 복귀
  useEffect(() => {
    if (!step.isReady) return
    if (showReadyCountdown) {
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
    } else {
      const id = setTimeout(onExit, 1500)
      return () => clearTimeout(id)
    }
  }, [step.isReady, step.countdownSec, showReadyCountdown, onComplete, onExit])

  // 글로벌 키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
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
          if (showReadyCountdown) onComplete()
          else onExit()
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
  }, [step.isReady, showReadyCountdown, onComplete, onExit])

  const progressLabel = step.target > 0 ? `${progress}/${step.target}` : ''

  const gaugeColor = gauge <= 25 ? 'linear-gradient(90deg, #ff5577, #ffaa00)'
    : gauge <= 50 ? 'linear-gradient(90deg, #ffaa00, #ffd700)'
    : 'linear-gradient(90deg, #00b4ff, #00ffaa)'

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* 미니 HUD: 게이지 + 단어 + ESC 나가기 */}
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
            <span className="font-mono text-xs text-base-content/60">단어</span>
            <span className="font-bold text-base-content text-sm">{step.word}</span>
          </>
        )}
        <CloseButton onClick={onExit} className="ml-2" />
      </div>

      {step.isReady ? (
        <ReadyView countdown={countdown} showCountdown={showReadyCountdown} />
      ) : (
        <TutorialStage
          step={step}
          gauge={gauge}
          progressLabel={progressLabel}
          cleared={cleared}
          onStepCleared={handleStepCleared}
          onGaugeChange={handleGaugeChange}
          onHitSfx={onHitSfx}
          onMissSfx={onMissSfx}
        />
      )}

    </div>
  )
}

function ReadyView({ countdown, showCountdown }: { countdown: number; showCountdown: boolean }) {
  if (!showCountdown) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/40">
        <div
          className="font-mono font-black tracking-[6px]"
          style={{ fontSize: 42, color: '#00ffaa', textShadow: '0 0 24px rgba(0,255,170,0.6)' }}
        >
          TUTORIAL CLEAR
        </div>
        <p className="font-mono text-xs tracking-widest text-base-content/60">
          잠시 후 시작 화면으로 돌아갑니다
        </p>
      </div>
    )
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/40">
      <div
        className="font-mono font-black tracking-[8px]"
        style={{ fontSize: 56, color: '#00ffaa', textShadow: '0 0 30px rgba(0,255,170,0.7)' }}
      >
        READY!
      </div>
      <div
        className="font-mono font-black"
        style={{ fontSize: 88, color: '#00b4ff', lineHeight: 1, textShadow: '0 0 30px rgba(0,180,255,0.8)' }}
      >
        {Math.max(0, countdown)}
      </div>
      <p className="font-mono text-xs tracking-widest text-base-content/50 mt-2">
        15개 스테이지 연속 진행 · 게이지 0 = GAME OVER
      </p>
    </div>
  )
}

