# 노트 위치 반응형 + 자동 pause 카운트다운 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임 화면 노트 위치를 트랙 폭에 비례한 반응형 좌표로 전환하고(이슈 #123), 리사이즈/포커스아웃/탭전환 자동 pause + 모든 pause 재개에 3-2-1-GO! 카운트다운을 추가한다(이슈 #124).

**Architecture:** CSS keyframe을 CSS 변수(`--note-start-x`, `--note-end-x`) 기반으로 변경하고, `NoteTrack`에서 ResizeObserver로 트랙 폭을 측정해 변수를 동적 세팅한다. 자동 pause/카운트다운은 GameScreen 레벨에서 `isPaused || isCountingDown` 통합 상태로 PlayStage에 전달, 기존 `totalPausedRef` 흐름이 카운트다운 시간을 자동 누적한다.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, DaisyUI, CSS animations, ResizeObserver API.

**Constraints (내부망 환경):**
- `npm install`, `flutter pub get` 등 외부 패키지 다운로드 명령 금지
- 코드 수정 후 외부 연결 명령(`flutter analyze`, `dart format` 등) 금지
- 타입 체크만 로컬에서 수행 (`npx -p typescript tsc --noEmit`)
- lint/build/runtime 검증은 사용자가 별도 환경에서 수행

**Spec:** `docs/superpowers/specs/2026-05-21-note-responsive-and-auto-pause-countdown-design.md`

**커밋 분리:**
- 이슈 #123 커밋 (Task 1~4)
- 이슈 #124 커밋 (Task 5~9)

---

## File Structure

| 파일 | 변경 | 담당 책임 | 이슈 |
|------|------|----------|------|
| `src/index.css` | 수정 | `@keyframes note-slide`를 CSS 변수 기반으로 변경 | #123 |
| `src/components/game/NoteTrack.tsx` | 수정 | ResizeObserver로 트랙 폭 측정 → CSS 변수 갱신, `totalDuration` 재계산 | #123 |
| `src/components/game/CountdownOverlay.tsx` | 신규 | 3 → 2 → 1 → GO! 1초 간격 표시 후 `onComplete` 호출 | #124 |
| `src/components/GameScreen.tsx` | 수정 | `isCountingDown` 상태 추가, 자동 pause effect, ESC 확장, `onResume` 변경, CountdownOverlay 렌더 | #124 |
| `src/components/game/PauseModal.tsx` | 변경 없음 | — | — |
| `src/components/game/PlayStage.tsx` | 변경 없음 | — | — |

---

## Task 1: keyframe CSS 변수화

**Files:**
- Modify: `src/index.css:28-31`

- [ ] **Step 1: keyframe을 CSS 변수 기반으로 변경**

`src/index.css`의 28~31 라인을 다음으로 교체:

```css
@keyframes note-slide {
  from { transform: translateX(var(--note-start-x, 2000px)); }
  to   { transform: translateX(var(--note-end-x, -500px)); }
}
```

변수 미설정 시 기존 값으로 fallback 유지 (안전망).

- [ ] **Step 2: 잔여 참조 확인**

Run (Grep tool 사용): `2000px` 및 `-500px` 가 `src/`, `docs/` 외 다른 곳에 남았는지 확인.

Expected: `src/index.css` 에만 존재 (fallback 값으로).

---

## Task 2: NoteTrack — ResizeObserver + CSS 변수 갱신

**Files:**
- Modify: `src/components/game/NoteTrack.tsx` (전체 재작성)

- [ ] **Step 1: NoteTrack 전체 재작성**

기존 파일을 다음 내용으로 교체:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { JudgmentType } from '../../types'

const JUDGMENT_X = 80
const NOTE_TRAVEL_BEATS = 4
const NOTE_END_X_ABS = 200  // 판정선 좌측으로 빠지는 거리(px)
const GLOW_DURATION = 200 // ms

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  pendingIndex: number
  lastJudgment?: { type: JudgmentType; id: number } | null
}

const JUDGMENT_GLOW: Record<JudgmentType, string> = {
  PERFECT: 'border-yellow-400 shadow-[0_0_16px_4px_rgba(250,204,21,0.7)]',
  GOOD:    'border-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.7)]',
  MISS:    'border-red-400 shadow-[0_0_16px_4px_rgba(248,113,113,0.7)]',
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  pendingIndex,
  lastJudgment,
}: NoteTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)

  // ResizeObserver로 트랙 폭 측정 → CSS 변수 갱신
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const apply = (width: number) => {
      const startX = Math.max(0, width - JUDGMENT_X)
      el.style.setProperty('--note-start-x', `${startX}px`)
      el.style.setProperty('--note-end-x', `-${NOTE_END_X_ABS}px`)
      setTrackWidth(width)
    }

    apply(el.offsetWidth)

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        apply(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const travelDuration = NOTE_TRAVEL_BEATS * beatMs
  // 시작점(width - JUDGMENT_X) ~ 판정선 도착에 travelDuration, 판정선 ~ 종점(-NOTE_END_X_ABS)까지 추가 이동.
  // 총 이동거리 / 시작~판정선 거리 비율로 totalDuration 산출.
  const startToJudgment = Math.max(1, trackWidth - JUDGMENT_X)
  const totalDistance = startToJudgment + NOTE_END_X_ABS
  const totalDuration = Math.round(travelDuration * totalDistance / startToJudgment)

  // 판정 후 GLOW_DURATION ms 뒤 자동 리셋
  const [activeJudgment, setActiveJudgment] = useState<JudgmentType | null>(null)
  useEffect(() => {
    if (!lastJudgment) return
    setActiveJudgment(lastJudgment.type)
    const t = setTimeout(() => setActiveJudgment(null), GLOW_DURATION)
    return () => clearTimeout(t)
  }, [lastJudgment?.id])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {/* 판정 위치 placeholder — 판정 결과에 따라 테두리 glow */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-36 h-36 rounded border-4 z-10 transition-all duration-150
          ${activeJudgment ? JUDGMENT_GLOW[activeJudgment] : 'border-base-content/20 bg-base-300/40'}
        `}
        style={{ left: JUDGMENT_X }}
      />

      {/* 트랙 폭 측정 전에는 노트 렌더 보류 → 초기 우측 뭉침 방지 */}
      {trackWidth > 0 && inputSyllables.map((syllable, i) => {
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
```

핵심 변경 사항:
- `containerRef` 추가 → trackWidth 측정
- `ResizeObserver` 로 폭 변화 감지 → CSS 변수 `--note-start-x`, `--note-end-x` 갱신
- `totalDuration` 계산을 `trackWidth - JUDGMENT_X + NOTE_END_X_ABS` 비율로 동적화
- `trackWidth > 0` 가드 — 첫 페인트 직전 초기 뭉침 방지

- [ ] **Step 2: 타입 체크**

Run: `npx -p typescript tsc --noEmit`
Expected: 에러 없음.

---

## Task 3: 잔여 참조 grep — 이슈 #123 변경 검증

- [ ] **Step 1: 노트 관련 하드코딩 잔존 확인**

Grep tool 사용:
- 패턴 `2000px` → `src/index.css` 만 매칭 (fallback)
- 패턴 `-500px` → `src/index.css` 만 매칭 (fallback)
- 패턴 `note-slide` → `src/index.css`, `src/components/game/NoteTrack.tsx` 매칭

Expected: 위 위치 외 잔존 없음.

---

## Task 4: 이슈 #123 커밋

- [ ] **Step 1: 변경 파일 스테이징 + 커밋**

```bash
git add src/index.css src/components/game/NoteTrack.tsx
git commit -m "$(cat <<'EOF'
게임화면 창크기 변경시 노트 위치/속도 깨짐 : fix : CSS keyframe 변수화 및 ResizeObserver로 트랙 폭 기반 노트 시작/종료 좌표 동적 설정 https://github.com/PickerPicker/PickerPicker/issues/123

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: 커밋 확인**

Run: `git log --oneline -1`
Expected: 위 커밋 메시지 첫 줄 표시.

---

## Task 5: CountdownOverlay 컴포넌트 신규 작성

**Files:**
- Create: `src/components/game/CountdownOverlay.tsx`

- [ ] **Step 1: CountdownOverlay 파일 신규 작성**

다음 내용으로 새 파일 생성:

```tsx
import { useEffect, useRef, useState } from 'react'

type CountValue = 3 | 2 | 1 | 'GO!'
const SEQUENCE: CountValue[] = [3, 2, 1, 'GO!']
const STEP_MS = 1000

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
          // 마지막 GO! 를 1초 유지 후 onComplete
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
```

핵심:
- `SEQUENCE` 배열로 3 → 2 → 1 → GO! 순서 진행
- 1초 간격 setInterval, 마지막 단계는 `setTimeout(STEP_MS)` 후 `onComplete`
- `mountedRef` 가드로 unmount race 방지
- `onCompleteRef` 로 stale closure 방지
- `pointer-events-none` — 입력 차단은 PlayStage `isPausedRef` 가 담당
- `z-[60]` — PauseModal `z-50` 보다 위

- [ ] **Step 2: 타입 체크**

Run: `npx -p typescript tsc --noEmit`
Expected: 에러 없음.

---

## Task 6: GameScreen — isCountingDown state + onResume 변경

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: import 추가**

`src/components/GameScreen.tsx:7` 의 PauseModal import 아래에 추가:

```tsx
import { PauseModal } from './game/PauseModal'
import { CountdownOverlay } from './game/CountdownOverlay'
```

- [ ] **Step 2: isCountingDown state 추가**

`src/components/GameScreen.tsx:77` (`const [isPaused, setIsPaused] = useState(false)` 다음 줄)에 추가:

```tsx
const [isPaused, setIsPaused] = useState(false)
const [isCountingDown, setIsCountingDown] = useState(false)
```

- [ ] **Step 3: ESC 핸들러 확장**

`src/components/GameScreen.tsx:100-109` ESC handler useEffect를 다음으로 교체:

```tsx
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'result') return
      e.preventDefault()
      if (isCountingDown) {
        // 카운트다운 중 ESC → pause 복귀
        setIsCountingDown(false)
        setIsPaused(true)
        return
      }
      setIsPaused(prev => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, isCountingDown])
```

- [ ] **Step 4: PlayStage isPaused prop 통합값으로 변경**

`src/components/GameScreen.tsx` 의 `<PlayStage ... isPaused={isPaused} />` 부분을 찾아 다음으로 교체:

```tsx
        <PlayStage
          stageData={stageWithShuffle!}
          stat={stat}
          onStatUpdate={handleStatUpdate}
          onStageComplete={handleStageComplete}
          onGameOver={handleGameOver}
          onHitSfx={onHitSfx}
          onMissSfx={onMissSfx}
          offset={offset}
          isPaused={isPaused || isCountingDown}
        />
```

- [ ] **Step 5: PauseModal onResume 변경**

`src/components/GameScreen.tsx` 의 `<PauseModal ... />` 블록에서 `onResume={() => setIsPaused(false)}` 부분을 다음으로 교체:

```tsx
          onResume={() => {
            setIsPaused(false)
            setIsCountingDown(true)
          }}
```

- [ ] **Step 6: CountdownOverlay 렌더 추가**

`src/components/GameScreen.tsx` 의 `<PauseModal ... />` 블록 직후, return JSX 닫는 `</div>` 직전에 추가:

```tsx
      {isCountingDown && (phase as string) !== 'result' && (
        <CountdownOverlay onComplete={() => setIsCountingDown(false)} />
      )}
```

- [ ] **Step 7: 타입 체크**

Run: `npx -p typescript tsc --noEmit`
Expected: 에러 없음.

---

## Task 7: GameScreen — 자동 pause effect 추가

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: 자동 pause effect 추가**

기존 ESC 핸들러 useEffect 다음 줄에 새 useEffect 추가:

```tsx
  // 리사이즈/포커스아웃/탭전환 자동 pause (playing 단계에서만)
  useEffect(() => {
    if (phase !== 'playing') return
    if (isPaused || isCountingDown) return

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const triggerPause = () => setIsPaused(true)
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(triggerPause, 300)
    }
    const onBlur = () => triggerPause()
    const onVisibility = () => { if (document.hidden) triggerPause() }

    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase, isPaused, isCountingDown])
```

가드 동작:
- `phase !== 'playing'` → preview/result 단계에서 자동 pause 미발동
- `isPaused || isCountingDown` → 이미 멈춰있으면 리스너 미등록 (재트리거 무의미)

- [ ] **Step 2: 타입 체크**

Run: `npx -p typescript tsc --noEmit`
Expected: 에러 없음.

---

## Task 8: handleRestart / handleGiveUp에서 isCountingDown 정리

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: handleGiveUp 보강**

`src/components/GameScreen.tsx:232-235` 의 `handleGiveUp` 함수를 다음으로 교체:

```tsx
  const handleGiveUp = () => {
    setIsPaused(false)
    setIsCountingDown(false)
    handleGameOver()
  }
```

- [ ] **Step 2: handleRestart 보강**

`src/components/GameScreen.tsx:237` 의 `handleRestart` 함수 본문 첫 줄(`setIsPaused(false)`) 다음에 한 줄 추가:

```tsx
  const handleRestart = () => {
    setIsPaused(false)
    setIsCountingDown(false)
    resultSavedRef.current = false
    // ... 기존 코드 유지
```

- [ ] **Step 3: 타입 체크 + 잔여 참조 grep**

Run: `npx -p typescript tsc --noEmit`
Expected: 에러 없음.

Grep tool: 패턴 `setIsPaused(false)` 검색 → onResume 콜백, ESC 핸들러, handleGiveUp, handleRestart 외 다른 곳에 남아있지 않은지 확인.

---

## Task 9: 이슈 #124 커밋

- [ ] **Step 1: 변경 파일 스테이징 + 커밋**

```bash
git add src/components/game/CountdownOverlay.tsx src/components/GameScreen.tsx
git commit -m "$(cat <<'EOF'
리사이즈 포커스아웃 자동 pause + 재개 카운트다운 : feat : window resize blur visibilitychange 자동 pause 트리거 추가 및 모든 pause 재개에 3-2-1 GO 카운트다운 적용 https://github.com/PickerPicker/PickerPicker/issues/124

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: 커밋 확인**

Run: `git log --oneline -2`
Expected: 최근 두 커밋(#123, #124) 모두 표시.

---

## Task 10: 수동 검증 체크리스트 (사용자 수행)

내부망 환경상 자동 실행 불가. 사용자가 별도 환경에서 다음을 직접 확인:

- [ ] `npm run dev` 로 로컬 서버 띄움
- [ ] 좁은 화면(예: 800px)에서 게임 시작 → 노트가 트랙 우측 끝에서 등장
- [ ] 게임 도중 창 크기 변경 → 자동 pause + PauseModal 표시
- [ ] "계속하기" 클릭 → 3 → 2 → 1 → GO! 카운트다운 후 정상 재개
- [ ] 카운트다운 중 ESC → PauseModal 복귀
- [ ] 카운트다운 중 창 크기 변경 → PauseModal 복귀
- [ ] 탭 전환 → 자동 pause
- [ ] 다른 창 클릭으로 포커스 아웃 → 자동 pause
- [ ] ESC 수동 pause → "계속하기" → 카운트다운 후 재개
- [ ] preview 단계에서 창 크기 변경 → 자동 pause 미발생, 노트 미리보기 위치 정상
- [ ] result 단계에서 창 크기 변경 → 자동 pause 미발생
- [ ] 박자 검증: BGM과 노트 도착 시각 동기 (청각 확인)
- [ ] 카운트다운 후 첫 노트 정확한 박자에 도착 (totalPaused 자동 보정 확인)

---

## Self-Review 결과

**Spec coverage:**
- 노트 위치 반응형 (CSS 변수 + ResizeObserver) → Task 1, 2
- `JUDGMENT_X` 유지 → Task 2
- `totalDuration` 재계산 → Task 2
- `isCountingDown` state → Task 6
- 자동 pause 트리거 (resize/blur/visibilitychange) → Task 7
- CountdownOverlay 신규 → Task 5
- ESC 카운트다운 중 pause 복귀 → Task 6
- onResume 변경 → Task 6
- `PlayStage isPaused = isPaused || isCountingDown` → Task 6
- handleGiveUp/handleRestart 정리 → Task 8
- 커밋 분리 (#123, #124) → Task 4, 9
- 수동 검증 → Task 10

**Placeholder scan:** TBD/TODO 없음. 모든 step 실제 코드/명령 포함.

**Type consistency:**
- `CountdownOverlayProps.onComplete: () => void` — Task 5 정의 / Task 6 사용 일치
- `setIsCountingDown` — 모든 task에서 동일 이름
- `JUDGMENT_X`, `NOTE_END_X_ABS`, `NOTE_TRAVEL_BEATS` — Task 2 내부 일관
- `isPaused`, `isCountingDown` — GameScreen 전반 일관
