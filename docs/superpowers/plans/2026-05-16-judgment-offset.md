# 판정 타이밍 오프셋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면 설정 모달에 판정 타이밍 오프셋(±100ms, 1ms 단위) 조절 UI를 추가하고, 게임 판정 로직에 오프셋을 적용한다.

**Architecture:** `App.tsx`에서 offset state를 관리하고 localStorage에 영속화한다. StartScreen → SettingsModal 경로로 설정 UI를 제공하고, GameScreen → PlayStage 경로로 판정에 오프셋을 반영한다.

**Tech Stack:** React 19, TypeScript, DaisyUI (Tailwind), localStorage

---

## 파일 구조

| 파일 | 변경 |
|------|------|
| `src/App.tsx` | offset state, handleOffset, props 전달 |
| `src/components/AudioSettingsModal.tsx` | 삭제 후 `SettingsModal.tsx`로 대체 |
| `src/components/SettingsModal.tsx` | 신규 생성 — 기존 음향 설정 + 오프셋 UI |
| `src/components/StartScreen.tsx` | import 경로 변경, offset/onOffset props 추가 |
| `src/components/GameScreen.tsx` | offset prop 추가, PlayStage에 전달 |
| `src/components/game/PlayStage.tsx` | offset prop 추가, arrivalTime 보정 |

---

### Task 1: App.tsx — offset state 추가

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: offset state와 핸들러 추가**

`src/App.tsx`에서 `useState` import 아래에 상수를 추가하고, `App()` 함수 내 `audio` 선언 바로 아래에 추가한다.

```tsx
// 파일 상단 (import 아래, App 함수 밖)
const LS_OFFSET_KEY = 'pickerpicker_offset'
```

```tsx
// App() 함수 내부, audio 선언 바로 아래
const [offset, setOffset] = useState<number>(() => {
  const saved = localStorage.getItem(LS_OFFSET_KEY)
  return saved ? Number(saved) : 0
})

const handleOffset = (v: number) => {
  const clamped = Math.max(-100, Math.min(100, v))
  setOffset(clamped)
  localStorage.setItem(LS_OFFSET_KEY, String(clamped))
}
```

- [ ] **Step 2: StartScreen에 offset props 전달**

`App.tsx`의 `<StartScreen>` JSX를 다음으로 교체한다:

```tsx
<StartScreen
  onRanking={() => {
    audio.playButtonSfx()
    setCurrentScreen('ranking')
  }}
  onStart={handleStart}
  bgmVolume={audio.bgmVolume}
  sfxOn={audio.sfxOn}
  onBgmVolume={audio.setBgmVol}
  onToggleSfx={audio.toggleSfx}
  offset={offset}
  onOffset={handleOffset}
/>
```

- [ ] **Step 3: GameScreen에 offset prop 전달**

`App.tsx`의 `<GameScreen>` JSX에 `offset={offset}` 한 줄 추가한다:

```tsx
<GameScreen
  nickname={nickname}
  isNewPlayer={isNewPlayer}
  onHome={() => {
    audio.stopBgm()
    setCurrentScreen('start')
  }}
  onRanking={() => {
    audio.stopBgm()
    setCurrentScreen('ranking')
  }}
  onButtonSfx={audio.playButtonSfx}
  onClearSfx={audio.playClearSfx}
  onGameOverSfx={audio.playGameOverSfx}
  onHitSfx={audio.playHitSfx}
  onMissSfx={audio.playMissSfx}
  onGameBgm={audio.playGameBgm}
  offset={offset}
/>
```

---

### Task 2: SettingsModal 신규 생성

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Delete: `src/components/AudioSettingsModal.tsx` (Task 3에서 import 교체 후 삭제)

- [ ] **Step 1: SettingsModal.tsx 생성**

`src/components/SettingsModal.tsx` 파일을 생성한다:

```tsx
interface SettingsModalProps {
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  onClose: () => void
}

export function SettingsModal({ bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset, onClose }: SettingsModalProps) {
  const offsetLabel = offset === 0 ? '0ms' : offset > 0 ? `+${offset}ms` : `${offset}ms`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card bg-base-200 shadow-2xl w-80"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg tracking-wide">게임 설정</h2>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>✕</button>
          </div>

          {/* BGM 볼륨 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">BGM 볼륨</span>
              <span className="font-mono text-primary">{bgmVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={bgmVolume}
              className="range range-primary range-sm"
              onChange={e => onBgmVolume(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-base-content/40 px-0.5">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* 효과음 */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">효과음</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={sfxOn}
              onChange={onToggleSfx}
            />
          </div>

          {/* 판정 오프셋 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">판정 오프셋</span>
              <span className="font-mono text-primary w-16 text-right">{offsetLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                className="btn btn-sm btn-outline w-10"
                onClick={() => onOffset(offset - 1)}
                disabled={offset <= -100}
              >
                −
              </button>
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={offset}
                  className="range range-primary range-xs w-32"
                  onChange={e => onOffset(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs text-base-content/40 w-32 px-0.5">
                  <span>-100</span>
                  <span>0</span>
                  <span>+100</span>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline w-10"
                onClick={() => onOffset(offset + 1)}
                disabled={offset >= 100}
              >
                +
              </button>
            </div>
            <p className="text-xs text-base-content/40 text-center">
              음수: 판정 앞당김 · 양수: 판정 늦춤
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 3: StartScreen — import 교체 및 props 추가

**Files:**
- Modify: `src/components/StartScreen.tsx`
- Delete: `src/components/AudioSettingsModal.tsx`

- [ ] **Step 1: StartScreen.tsx 전체 교체**

`src/components/StartScreen.tsx`를 다음으로 교체한다:

```tsx
import { useState } from 'react'
import { SettingsModal } from './SettingsModal'

interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
}

export function StartScreen({ onRanking, onStart, bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset }: StartScreenProps) {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen gap-8"
      style={{
        backgroundImage: 'url(/bg-home.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="flex flex-col items-center gap-8 px-16 py-12 rounded-3xl w-[480px] max-w-[90vw]"
        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h1 className="text-5xl font-black text-primary tracking-widest text-center" style={{ textShadow: '0 2px 24px rgba(0,180,255,0.5)' }}>
          PickerPicker
        </h1>
        <div className="flex flex-col gap-3 w-full">
          <button className="btn btn-primary btn-lg w-full text-lg" onClick={onStart}>
            시작
          </button>
          <button
            className="btn btn-lg w-full text-lg border-0"
            style={{ background: 'rgba(120,60,200,0.55)', color: '#fff' }}
            onClick={onRanking}
          >
            랭킹
          </button>
          <button
            className="btn btn-lg w-full text-lg"
            style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={() => setShowSettings(true)}
          >
            설정
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          bgmVolume={bgmVolume}
          sfxOn={sfxOn}
          offset={offset}
          onBgmVolume={onBgmVolume}
          onToggleSfx={onToggleSfx}
          onOffset={onOffset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: AudioSettingsModal.tsx 삭제**

```bash
git rm src/components/AudioSettingsModal.tsx
```

---

### Task 4: GameScreen — offset prop 추가

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: GameScreenProps에 offset 추가**

`GameScreen.tsx`의 `GameScreenProps` 인터페이스에 `offset: number` 추가:

```tsx
interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
  onHome: () => void
  onRanking: () => void
  onButtonSfx: () => void
  onClearSfx: () => void
  onGameOverSfx: () => void
  onNoteSfx: () => void
  onGameBgm: (stageIndex: number) => void
  offset: number
}
```

- [ ] **Step 2: destructure에 offset 추가 후 PlayStage에 전달**

함수 시그니처를 수정한다 (`GameScreen.tsx` 60번째 줄 근처):

```tsx
export function GameScreen({ nickname, onHome, onRanking, onButtonSfx, onClearSfx, onGameOverSfx, onNoteSfx, onGameBgm, offset }: GameScreenProps) {
```

그리고 `<PlayStage>` JSX를 찾아서 `offset={offset}` prop을 추가한다. PlayStage가 렌더되는 부분 (phase === 'playing'):

```tsx
<PlayStage
  stageData={stageWithShuffle}
  stat={stat}
  onStatUpdate={handleStatUpdate}
  onStageComplete={handleStageComplete}
  onGameOver={handleGameOver}
  onHitSfx={onNoteSfx}
  onMissSfx={onNoteSfx}
  offset={offset}
/>
```

> **주의:** `GameScreen.tsx`에서 `onNoteSfx`가 prop으로 선언되어 있으나 실제 App.tsx에서는 `onHitSfx`/`onMissSfx`로 분리되어 있을 수 있다. 현재 코드에서 PlayStage에 전달하는 방식을 그대로 유지하고 `offset`만 추가한다.

---

### Task 5: PlayStage — arrivalTime 오프셋 적용

**Files:**
- Modify: `src/components/game/PlayStage.tsx`

- [ ] **Step 1: PlayStageProps에 offset 추가**

`PlayStage.tsx`의 `PlayStageProps` 인터페이스에 `offset: number` 추가:

```tsx
interface PlayStageProps {
  stageData: StageData
  stat: GameStat
  onStatUpdate: (update: Partial<GameStat>) => void
  onStageComplete: () => void
  onGameOver: () => void
  onHitSfx: () => void
  onMissSfx: () => void
  offset: number
}
```

- [ ] **Step 2: destructure에 offset 추가**

```tsx
export function PlayStage({
  stageData,
  stat,
  onStatUpdate,
  onStageComplete,
  onGameOver,
  onHitSfx,
  onMissSfx,
  offset,
}: PlayStageProps) {
```

- [ ] **Step 3: 자동 MISS 인터벌의 arrivalTime에 offset 적용**

`PlayStage.tsx`에서 `setInterval` 콜백 내부의 `arrivalTime` 계산을 수정한다 (약 128번째 줄):

```ts
// 변경 전
const arrivalTime = startTimeRef.current + idx * beatMs

// 변경 후
const arrivalTime = startTimeRef.current + idx * beatMs + offset
```

- [ ] **Step 4: 키 입력 판정의 arrivalTime에 offset 적용**

같은 파일에서 키 입력 핸들러 내부의 `arrivalTime` 계산도 동일하게 수정한다 (약 168번째 줄):

```ts
// 변경 전
const delta = Math.abs(Date.now() - arrivalTime)

// 위 코드보다 앞에 있는 arrivalTime 선언을 찾아 수정:
const arrivalTime = startTimeRef.current + idx * beatMs + offset
```

> `PlayStage.tsx`에는 `arrivalTime`이 두 군데 계산된다 — setInterval 안과 키 핸들러 안. **둘 다** 수정해야 한다.

- [ ] **Step 5: offset을 useCallback/useEffect 의존성에 포함 확인**

offset이 변경될 때 판정이 즉시 반영되어야 한다. `setInterval` 콜백과 키 핸들러가 `useCallback`으로 감싸진 경우 deps 배열에 `offset`을 추가한다.

`PlayStage.tsx`에서 `useCallback` deps를 확인하여 `offset`이 누락되면 추가:

```tsx
}, [offset, /* 기존 deps */])
```

---

### Task 6: 타입 체크 및 수동 검증 후 커밋

**Files:**
- 없음 (검증 단계)

- [ ] **Step 1: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음. 에러가 있으면 prop 타입 불일치를 수정한다.

- [ ] **Step 2: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 3: 수동 검증 체크리스트**

브라우저에서 `http://localhost:5173` 접속 후 확인:

1. **설정 모달 열기** — "설정" 버튼 클릭 → 모달 헤더가 "게임 설정"으로 표시되는지 확인
2. **오프셋 UI 표시** — 판정 오프셋 섹션, `−` / `+` 버튼, 슬라이더, 레이블(`0ms`) 표시 확인
3. **버튼 조절** — `+` 버튼 클릭 시 `+1ms`씩 증가, `−` 버튼 클릭 시 `-1ms`씩 감소 확인
4. **슬라이더 조절** — 슬라이더 드래그로 값 변경 확인
5. **경계 비활성화** — `+100ms`에서 `+` 버튼 비활성화, `-100ms`에서 `−` 버튼 비활성화 확인
6. **localStorage 저장** — 값 변경 후 새로고침 → 설정값이 유지되는지 확인
7. **게임 진입 후 판정 확인** — offset `+50ms` 설정 후 게임 진입. 평소보다 늦게 눌러도 PERFECT가 뜨는지 체감 확인
8. **기존 음향 설정 정상 동작** — BGM 볼륨, 효과음 토글이 여전히 작동하는지 확인

- [ ] **Step 4: 커밋**

```bash
git add src/App.tsx src/components/SettingsModal.tsx src/components/StartScreen.tsx src/components/GameScreen.tsx src/components/game/PlayStage.tsx
git commit -m "feat: 판정 타이밍 오프셋 설정 기능 추가 (±100ms, 설정 모달)"
```
