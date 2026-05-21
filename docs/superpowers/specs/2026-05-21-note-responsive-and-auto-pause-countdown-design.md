# 노트 위치 반응형 + 자동 pause / 재개 카운트다운 설계

- 작성일: 2026-05-21
- 관련 이슈: #123 (버그), #124 (UX 개선)
- 작업 브랜치: `main` (두 이슈 동시 작업, 커밋만 분리)

## 1. 배경

### 이슈 #123 — 노트 위치 반응형 버그

게임 진행 중 또는 시작 전에 브라우저 창 크기를 변경하면 노트 블록이 화면 우측에 뭉치거나 왼쪽에서 하나씩 흘러오는 등 비정상 위치/속도로 렌더링된다.

원인:
- `src/index.css`의 `@keyframes note-slide`가 `translateX(2000px → -500px)` 픽셀 하드코딩
- `src/components/game/NoteTrack.tsx`의 `JUDGMENT_X = 80`, `totalDuration = travelDuration * 2500 / 2000` 도 트랙 폭 무관 절대 픽셀 기반
- 트랙은 `flex-1`로 반응형이지만 keyframe은 절대 픽셀 → 화면 폭이 작으면 시작점(2000px)이 화면 안쪽에 박혀 노트가 우측에 뭉쳐 보임

판정 로직(`src/components/game/PlayStage.tsx`)은 시간 기반(`Date.now() - arrivalTime`)이라 박자/정확도는 영향 없음. **시각적 거리만 깨짐.**

### 이슈 #124 — 자동 pause + 재개 카운트다운

- 게임 진행 중 의도하지 않은 화면 변경(창 리사이즈, 탭 전환, 포커스 아웃)에도 게임이 그대로 진행되어 노트를 놓침
- ESC 수동 pause 후 "계속하기"를 눌러도 카운트다운 없이 즉시 재개되어 첫 노트를 놓치는 경우가 잦음

## 2. 목표

- 창 크기와 무관하게 노트가 항상 트랙 우측 끝에서 등장해 판정선까지 트랙 폭에 비례한 거리를 이동
- 박자 도착 시각(시간 기반 판정)은 변경 없음. 리듬감/정확도 영향 0
- 리사이즈/포커스아웃/탭전환 시 자동 pause
- 모든 pause 재개 경로(자동/수동)에 3 → 2 → 1 → GO! 카운트다운 (1초/단계, 총 4초)
- 카운트다운 시간만큼 `totalPausedRef`에 누적 → 노트 도착 시각 자동 보정

## 3. 비목표 (Out of Scope)

- 카운트다운 효과음/비프음 (YAGNI — 무음으로 시작)
- 카운트다운 시각 효과 (애니메이션 펄스 등은 기본만)
- 자동 resume (포커스 복귀 시 자동 재개 없음. 사용자가 "계속하기"를 눌러야 함)
- preview/result phase의 자동 pause (입력 없음 → pause 무의미)
- 판정 로직 변경 (시간 기반 유지)

## 4. 아키텍처

### 4.1 상태 구조 (GameScreen 소유)

```ts
const [isPaused, setIsPaused] = useState(false)          // 기존
const [isCountingDown, setIsCountingDown] = useState(false)  // 신규
```

PlayStage에는 통합값 전달:
```tsx
<PlayStage isPaused={isPaused || isCountingDown} ... />
```

PlayStage의 기존 `useEffect[isPaused]`가 통합값 변화를 추적 → 카운트다운 시간이 자동으로 `totalPausedRef`에 누적됨. 별도 보정 로직 불필요.

### 4.2 핵심 흐름

```
playing 상태
  → [ESC | resize 디바운스 300ms | blur | visibilitychange(hidden)]
  → setIsPaused(true)
  → PauseModal 표시 (PlayStage 내부 pausedAtRef = now)
  → 사용자 "계속하기" 클릭
  → setIsPaused(false) + setIsCountingDown(true)
  → CountdownOverlay 표시 (3 → 2 → 1 → GO!, 각 1초)
  → onComplete 콜백
  → setIsCountingDown(false)
  → PlayStage: isPaused prop = false → totalPausedRef 누적, 게임 재개
```

### 4.3 타이밍 예시

```
T=0    게임 시작, startTimeRef = now + 4*beatMs
T=5s   ESC 또는 resize
       setIsPaused(true) → PlayStage: pausedAtRef = 5s
T=10s  "계속하기" 클릭
       setIsPaused(false) + setIsCountingDown(true)
       PlayStage: isPaused prop = true (변화 없음, pausedAtRef 유지)
T=14s  CountdownOverlay onComplete (3→2→1→GO! 종료)
       setIsCountingDown(false)
       PlayStage: isPaused prop = false → totalPausedRef += (14 - 5) = 9000ms
       arrivalTime = startTime + idx*beatMs + offset + 9000ms
```

## 5. 컴포넌트 분해

### 5.1 `src/index.css` — keyframe 변수화

```css
@keyframes note-slide {
  from { transform: translateX(var(--note-start-x, 2000px)); }
  to   { transform: translateX(var(--note-end-x, -500px)); }
}
```

CSS 변수 미설정 시 기존 fallback 동작 유지 (안전망).

### 5.2 `src/components/game/NoteTrack.tsx` — ResizeObserver + CSS 변수

- 트랙 컨테이너 ref + `ResizeObserver`로 폭(`offsetWidth`) 측정
- 폭 변화 시 컨테이너의 CSS 변수 업데이트:
  - `--note-start-x` = `trackWidth - JUDGMENT_X` (트랙 우측 끝에서 등장)
  - `--note-end-x` = `-200` (판정선 좌측으로 빠짐)
- `JUDGMENT_X = 80` 유지 (판정 placeholder 위치는 좌측 80px 고정)
- `totalDuration` 재계산:
  - 시작점 ~ 판정선 거리 = `trackWidth - JUDGMENT_X` (`note-start-x` 절대값)
  - 판정선 ~ 종점 거리 = `200`
  - 총 거리 = `trackWidth - JUDGMENT_X + 200`
  - `totalDuration = travelDuration * 총거리 / (trackWidth - JUDGMENT_X)`
- 판정선 도착 시각 = `travelDuration` 유지 (박자 동기 보장)
- 초기 마운트 시 ResizeObserver가 1회 발화 → 첫 노트 등장 전 변수 세팅 완료

### 5.3 `src/components/game/CountdownOverlay.tsx` — 신규

```tsx
interface CountdownOverlayProps {
  onComplete: () => void
}
```

- 내부 state: `count: 3 | 2 | 1 | 'GO!'`
- 1초 간격 `setInterval` 로 진행
- 4번째 tick(`GO!`) 표시 후 1초 뒤 `onComplete()` 호출
- 표시: `fixed inset-0`, `z-index: 60` (PauseModal `z-50` 보다 위), 화면 중앙 큰 숫자 (예: `text-8xl font-black`)
- 언마운트 시 `clearInterval` + 진행 중 setState 방지 (`mountedRef`)
- `pointer-events-none` (입력 차단은 PlayStage의 `isPausedRef` 가드가 담당)

### 5.4 `src/components/game/PauseModal.tsx` — 시그니처 동일

변경 없음. `onResume` 콜백의 의미만 GameScreen 측에서 "isPaused=false + isCountingDown=true" 로 해석.

### 5.5 `src/components/GameScreen.tsx` — 오케스트레이션

신규 state:
```ts
const [isCountingDown, setIsCountingDown] = useState(false)
```

자동 pause 트리거 effect:
```ts
useEffect(() => {
  if (phase !== 'playing') return
  if (isPaused || isCountingDown) return  // 이미 멈춰있으면 추가 트리거 의미 없음

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

ESC 핸들러 확장 (기존 핸들러 수정):
```ts
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
```

onResume 변경:
```ts
onResume={() => {
  setIsPaused(false)
  setIsCountingDown(true)
}}
```

JSX:
```tsx
<PlayStage ... isPaused={isPaused || isCountingDown} />
{isPaused && phase !== 'result' && <PauseModal ... />}
{isCountingDown && <CountdownOverlay onComplete={() => setIsCountingDown(false)} />}
```

### 5.6 `src/components/game/PlayStage.tsx` — 변경 없음

기존 `isPaused` prop / `pausedAtRef` / `totalPausedRef` 로직 그대로 사용. 통합값 변화를 그대로 추적.

## 6. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 카운트다운 중 ESC | `setIsCountingDown(false) + setIsPaused(true)` → PauseModal 재표시 |
| 카운트다운 중 resize/blur | 트리거 effect 의존성에 `isCountingDown` 포함 → 동일하게 pause 복귀 |
| PauseModal 표시 중 또 resize | 이미 `isPaused=true` → 트리거 effect 가드로 no-op |
| `phase === 'preview'` 중 resize | 트리거 effect의 `phase !== 'playing'` 가드로 차단. NoteTrack 반응형으로 시각 깨짐 자체 방지 |
| `phase === 'result'` 중 resize/blur | 동일 가드로 차단 |
| 카운트다운 컴포넌트 빠른 unmount | `clearInterval` + `mountedRef` 가드로 setState race 방지 |
| 짧은 alt-tab (blur 즉시 복귀) | blur → pause. 자동 resume 없음. 사용자 통제 우선 |
| 디바운스 300ms 내 다발 resize | debounce → 마지막 1회만 pause |
| 게임 종료 시점 카운트다운 진행 중 | PlayStage의 `isPausedRef` 가드로 MISS 인터벌 미동작. 안전 |

## 7. 테스트 전략

수동 시각 검증 위주 (리듬게임 자동화 어려움):

- [ ] 좁은 화면(예: 800px) 게임 시작 → 노트가 트랙 우측 끝에서 등장, 박자에 맞춰 판정선 도달
- [ ] 게임 중 창 크기 변경 → 자동 pause + PauseModal 표시
- [ ] "계속하기" 클릭 → 3 → 2 → 1 → GO! 카운트다운 후 정상 재개
- [ ] 카운트다운 중 ESC → PauseModal 복귀
- [ ] 카운트다운 중 창 크기 변경 → PauseModal 복귀
- [ ] 탭 전환 → 자동 pause
- [ ] 다른 창 클릭으로 포커스 아웃 → 자동 pause
- [ ] ESC 수동 pause → "계속하기" → 카운트다운 후 재개
- [ ] preview 단계에서 창 크기 변경 → 자동 pause 미발생, 노트 미리보기 위치 정상
- [ ] result 단계에서 창 크기 변경 → 자동 pause 미발생
- [ ] 박자 검증: 메트로놈 비교 또는 BGM과 노트 도착 시각 동기 확인 (사용자 청각 검증)

자동 검증:
- `npx -p typescript tsc --noEmit` 통과
- 잔여 참조 grep: `2000px`, `-500px` (note-slide 외 잔존 없음 확인)

## 8. 커밋 분리

- **이슈 #123 커밋** (CSS keyframe + NoteTrack ResizeObserver 변경):
  ```
  게임화면 창크기 변경시 노트 위치/속도 깨짐 : fix : CSS keyframe 변수화 + ResizeObserver로 트랙 폭 기반 노트 시작/종료 좌표 동적 설정 https://github.com/PickerPicker/PickerPicker/issues/123
  ```
- **이슈 #124 커밋** (CountdownOverlay 신규 + GameScreen 자동 pause/카운트다운 통합):
  ```
  리사이즈 포커스아웃 자동 pause + 재개 카운트다운 : feat : window resize blur visibilitychange 자동 pause 트리거 추가 및 모든 pause 재개에 3-2-1 GO 카운트다운 적용 https://github.com/PickerPicker/PickerPicker/issues/124
  ```

순서: 노트 반응형 먼저(#123) → 자동 pause+카운트다운(#124). 그래야 #124 작업 중 리사이즈 검증 시 시각도 정상.

## 9. 영향 파일 요약

| 파일 | 변경 종류 | 이슈 |
|------|----------|------|
| `src/index.css` | 수정 (keyframe 변수화) | #123 |
| `src/components/game/NoteTrack.tsx` | 수정 (ResizeObserver, CSS 변수, totalDuration 재계산) | #123 |
| `src/components/game/CountdownOverlay.tsx` | 신규 | #124 |
| `src/components/GameScreen.tsx` | 수정 (자동 pause effect, isCountingDown state, ESC 확장) | #124 |
| `src/components/game/PauseModal.tsx` | 변경 없음 | — |
| `src/components/game/PlayStage.tsx` | 변경 없음 | — |
