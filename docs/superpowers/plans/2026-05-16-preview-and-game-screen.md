# 스테이지 미리보기 & 본게임 화면 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리듬게임 미리보기 화면(BPM 동기화 자동 애니메이션)과 본게임 화면(오른쪽→왼쪽 노트 이동 + 판정 시스템)을 구현한다.

**Architecture:** `GameScreen`이 상태(스테이지, 게임 페이즈, 게이지, 점수)를 관리하고, `PreviewStage` / `PlayStage` 두 서브 화면에 props로 전달한다. 노트는 CSS `animation-delay`(음수 포함)로 정확한 박자에 판정선에 도달하도록 구현한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, DaisyUI v5, Vite

---

## 파일 구조

| 파일 | 상태 | 역할 |
|------|------|------|
| `public/rhythm_stages_001_015.json` | 신규(복사) | fetch로 로드할 스테이지 데이터 |
| `src/types/index.ts` | 수정 | StageData, GamePhase, GameStat 타입 추가 |
| `src/index.css` | 수정 | `@keyframes note-slide` 추가 |
| `src/components/GameScreen.tsx` | 수정 | stub → 상태 관리 컨테이너 |
| `src/components/game/GameHeader.tsx` | 신규 | 상단 바 (Stage, 단어, 게이지, Score) |
| `src/components/game/KeyboardDisplay.tsx` | 신규 | 하단 8키 매핑 (Preview/Play 공통) |
| `src/components/game/PreviewStage.tsx` | 신규 | BPM 박자 자동 강조 미리보기 |
| `src/components/game/JudgmentDisplay.tsx` | 신규 | PERFECT/GOOD/MISS + N combo 텍스트 |
| `src/components/game/NoteTrack.tsx` | 신규 | 노트 오른쪽→왼쪽 이동 트랙 |
| `src/components/game/PlayStage.tsx` | 신규 | 본게임 화면 조립 + 판정 로직 |

---

## Task 1: 타입 정의 + 데이터 파일 준비

**Files:**
- Modify: `src/types/index.ts`
- Copy: `docs/rhythm_stages_001_015.json` → `public/rhythm_stages_001_015.json`

- [ ] **Step 1: JSON 데이터를 public 폴더에 복사**

```bash
cp docs/rhythm_stages_001_015.json public/rhythm_stages_001_015.json
```

브라우저에서 `http://localhost:5173/rhythm_stages_001_015.json` 로 접근되면 성공.

- [ ] **Step 2: 타입 정의 추가**

`src/types/index.ts`를 아래로 교체:

```ts
export type Screen = 'start' | 'game' | 'ranking'

export type GamePhase = 'preview' | 'playing' | 'result'

export interface KeyMapping {
  key: string
  syllable: string
  type: 'valid' | 'invalid'
}

export interface StageData {
  stage: number
  difficultyLevel: number
  bpm: number
  word: string
  validSyllables: string[]
  invalidSyllables: string[]
  inputLength: number
  inputSyllables: string[]
  keyMapping: KeyMapping[]
}

export interface GameData {
  gameTitle: string
  version: string
  keyLayout: string[]
  rules: {
    totalStages: number
    difficultyGroupSize: number
    baseBpm: number
    bpmIncreasePerDifficulty: number
    baseInputLength: number
    inputLengthIncreasePerDifficulty: number
    validSyllableRatioMin: number
  }
  stages: StageData[]
}

export interface GameStat {
  score: number
  gauge: number
  perfectCombo: number
  perfectCount: number
  goodCount: number
  missCount: number
}

export type JudgmentType = 'PERFECT' | 'GOOD' | 'MISS'
```

- [ ] **Step 3: 커밋**

```bash
git add public/rhythm_stages_001_015.json src/types/index.ts
git commit -m "feat: 게임 타입 정의 및 스테이지 데이터 준비 https://github.com/PickerPicker/PickerPicker/issues/11"
```

---

## Task 2: CSS 애니메이션 추가

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: note-slide 키프레임 추가**

`src/index.css` 파일 끝에 추가:

```css
@keyframes note-slide {
  from {
    transform: translateX(2000px);
    opacity: 1;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes judgment-fade {
  0%   { opacity: 1; transform: scale(1.2); }
  70%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}

@keyframes preview-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.15); }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/index.css
git commit -m "feat: 게임 CSS 애니메이션 키프레임 추가"
```

---

## Task 3: GameHeader 컴포넌트

**Files:**
- Create: `src/components/game/GameHeader.tsx`

- [ ] **Step 1: GameHeader 작성**

```tsx
// src/components/game/GameHeader.tsx
interface GameHeaderProps {
  stage: number
  word: string
  gauge: number
  score: number
}

export function GameHeader({ stage, word, gauge, score }: GameHeaderProps) {
  const gaugePercent = Math.max(0, Math.min(100, gauge))
  const gaugeColor =
    gaugePercent > 50 ? 'bg-primary' : gaugePercent > 25 ? 'bg-warning' : 'bg-error'

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 shrink-0">
      {/* 스테이지 */}
      <span className="text-lg font-bold text-base-content w-24">
        Stage {stage}
      </span>

      {/* 이번 단어 */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-base-content/50">이번 단어</span>
        <div className="flex gap-1">
          {word.split('').map((ch, i) => (
            <div
              key={i}
              className="w-8 h-8 flex items-center justify-center border border-primary/50 rounded text-base-content font-bold text-sm bg-base-300"
            >
              {ch}
            </div>
          ))}
        </div>
      </div>

      {/* 게이지 + 점수 */}
      <div className="flex flex-col items-end gap-1 w-40">
        <div className="w-full h-3 bg-base-300 rounded-full overflow-hidden">
          <div
            className={`h-full ${gaugeColor} transition-all duration-300`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
        <span className="text-sm font-mono text-base-content/80">
          Score: {score.toString().padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 브라우저 확인**

`npm run dev` 후 게임화면에서 헤더가 렌더링되는지 확인 (Task 8에서 연결하므로 지금은 import 체크만).

- [ ] **Step 3: 커밋**

```bash
git add src/components/game/GameHeader.tsx
git commit -m "feat: GameHeader 컴포넌트 구현"
```

---

## Task 4: KeyboardDisplay 컴포넌트

**Files:**
- Create: `src/components/game/KeyboardDisplay.tsx`

- [ ] **Step 1: KeyboardDisplay 작성**

```tsx
// src/components/game/KeyboardDisplay.tsx
import type { KeyMapping } from '../../types'

interface KeyboardDisplayProps {
  keyMapping: KeyMapping[]
  highlightSyllable?: string   // 미리보기: 현재 강조 음절
  pressedKey?: string          // 본게임: 눌린 event.code
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/game/KeyboardDisplay.tsx
git commit -m "feat: KeyboardDisplay 컴포넌트 구현"
```

---

## Task 5: PreviewStage 컴포넌트

**Files:**
- Create: `src/components/game/PreviewStage.tsx`

- [ ] **Step 1: PreviewStage 작성**

```tsx
// src/components/game/PreviewStage.tsx
import { useEffect, useRef, useState } from 'react'
import type { StageData } from '../../types'
import { KeyboardDisplay } from './KeyboardDisplay'

interface PreviewStageProps {
  stageData: StageData
  onPreviewEnd: () => void
}

export function PreviewStage({ stageData, onPreviewEnd }: PreviewStageProps) {
  const { bpm, inputSyllables, keyMapping } = stageData
  const beatMs = Math.round(60_000 / bpm)

  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCurrentIndex(0)
    let idx = 0

    timerRef.current = setInterval(() => {
      idx += 1
      if (idx >= inputSyllables.length) {
        clearInterval(timerRef.current!)
        // 마지막 음절 강조 후 1 beat 대기 → 본게임 전환
        setTimeout(onPreviewEnd, beatMs)
      } else {
        setCurrentIndex(idx)
      }
    }, beatMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stageData]) // stageData가 바뀌면 재시작

  const currentSyllable = inputSyllables[currentIndex]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 리듬 큐 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <span className="text-xs text-base-content/40 uppercase tracking-widest">
          리듬 큐 — 미리보기
        </span>
        <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
          {inputSyllables.map((syl, i) => {
            const isCurrent = i === currentIndex
            const isDone = i < currentIndex
            return (
              <div
                key={i}
                className={`
                  w-12 h-12 flex items-center justify-center rounded border-2 font-bold text-lg
                  transition-all duration-100
                  ${isDone
                    ? 'border-base-content/10 text-base-content/20 bg-base-300/30'
                    : isCurrent
                    ? 'border-primary bg-primary/20 text-primary scale-110'
                    : 'border-base-content/30 text-base-content bg-base-300'
                  }
                `}
                style={isCurrent ? { animation: 'preview-pulse 0.3s ease-in-out' } : {}}
              >
                {syl}
              </div>
            )
          })}
        </div>
      </div>

      {/* 키보드 매핑 */}
      <KeyboardDisplay
        keyMapping={keyMapping}
        highlightSyllable={currentSyllable}
      />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/game/PreviewStage.tsx
git commit -m "feat: PreviewStage 컴포넌트 구현 (BPM 자동 강조)"
```

---

## Task 6: JudgmentDisplay 컴포넌트

**Files:**
- Create: `src/components/game/JudgmentDisplay.tsx`

- [ ] **Step 1: JudgmentDisplay 작성**

```tsx
// src/components/game/JudgmentDisplay.tsx
import { useEffect, useState } from 'react'
import type { JudgmentType } from '../../types'

interface JudgmentDisplayProps {
  judgment: { type: JudgmentType; id: number } | null
  perfectCombo: number
}

const JUDGMENT_COLOR: Record<JudgmentType, string> = {
  PERFECT: 'text-yellow-400',
  GOOD: 'text-green-400',
  MISS: 'text-red-400',
}

export function JudgmentDisplay({ judgment, perfectCombo }: JudgmentDisplayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!judgment) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 600)
    return () => clearTimeout(t)
  }, [judgment?.id])

  return (
    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
      {visible && judgment && (
        <span
          className={`text-3xl font-black ${JUDGMENT_COLOR[judgment.type]}`}
          style={{ animation: 'judgment-fade 0.6s ease-out forwards' }}
          key={judgment.id}
        >
          {judgment.type}
        </span>
      )}
      {perfectCombo >= 2 && (
        <span className="text-lg font-bold text-primary/80">
          {perfectCombo} combo
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/game/JudgmentDisplay.tsx
git commit -m "feat: JudgmentDisplay 컴포넌트 구현"
```

---

## Task 7: NoteTrack 컴포넌트

**Files:**
- Create: `src/components/game/NoteTrack.tsx`

- [ ] **Step 1: NoteTrack 작성**

```tsx
// src/components/game/NoteTrack.tsx
const JUDGMENT_X = 80       // 판정선 위치 (px, 좌측에서)
const NOTE_TRAVEL_BEATS = 4 // 노트가 스폰 → 판정선까지 걸리는 beat 수

interface NoteTrackProps {
  inputSyllables: string[]
  beatMs: number
  startTime: number        // 게임 시작 timestamp (Date.now())
  pendingIndex: number     // 현재 판정 대상 노트 인덱스
}

export function NoteTrack({
  inputSyllables,
  beatMs,
  startTime,
  pendingIndex,
}: NoteTrackProps) {
  const travelDuration = NOTE_TRAVEL_BEATS * beatMs

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* 판정선 */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-10"
        style={{ left: JUDGMENT_X }}
      />
      <div
        className="absolute top-2 text-xs text-primary/40 select-none"
        style={{ left: JUDGMENT_X + 4 }}
      >
        판정선
      </div>

      {/* 노트 */}
      {inputSyllables.map((syllable, i) => {
        // pendingIndex - 1 이하 = 이미 판정 완료 → 렌더 생략
        if (i < pendingIndex - 1) return null

        // 노트 i의 판정 시각 = startTime + i * beatMs
        // 스폰 시각 = 판정 시각 - travelDuration
        // animationDelay = spawnTime - now = (startTime + i * beatMs - travelDuration) - startTime
        //                = i * beatMs - travelDuration  (음수이면 이미 이동 중)
        const delay = i * beatMs - travelDuration

        return (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: JUDGMENT_X,
              animation: `note-slide ${travelDuration}ms linear`,
              animationDelay: `${delay}ms`,
              animationFillMode: 'backwards',
              opacity: i === pendingIndex ? 1 : 0.4,
            }}
          >
            <div
              className={`
                w-12 h-12 flex items-center justify-center rounded border-2 font-bold text-lg
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

- [ ] **Step 2: 커밋**

```bash
git add src/components/game/NoteTrack.tsx
git commit -m "feat: NoteTrack 컴포넌트 구현 (CSS animation-delay 방식)"
```

---

## Task 8: PlayStage 컴포넌트

**Files:**
- Create: `src/components/game/PlayStage.tsx`

- [ ] **Step 1: PlayStage 작성**

```tsx
// src/components/game/PlayStage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameStat, JudgmentType, StageData } from '../../types'
import { JudgmentDisplay } from './JudgmentDisplay'
import { KeyboardDisplay } from './KeyboardDisplay'
import { NoteTrack } from './NoteTrack'

const PERFECT_WINDOW = 70
const GOOD_WINDOW = 140

interface PlayStageProps {
  stageData: StageData
  stat: GameStat
  onStatUpdate: (update: Partial<GameStat>) => void
  onStageComplete: () => void
  onGameOver: () => void
}

export function PlayStage({
  stageData,
  stat,
  onStatUpdate,
  onStageComplete,
  onGameOver,
}: PlayStageProps) {
  const { bpm, inputSyllables, keyMapping } = stageData
  const beatMs = Math.round(60_000 / bpm)

  const [pendingIndex, setPendingIndex] = useState(0)
  const [lastJudgment, setLastJudgment] = useState<{ type: JudgmentType; id: number } | null>(null)
  const [pressedKey, setPressedKey] = useState<string | undefined>()
  const [perfectCombo, setPerfectCombo] = useState(0)

  const startTimeRef = useRef(Date.now())
  const pendingIndexRef = useRef(0)
  const statRef = useRef(stat)
  const judgeCountRef = useRef(0)

  // stat ref sync
  useEffect(() => { statRef.current = stat }, [stat])
  useEffect(() => { pendingIndexRef.current = pendingIndex }, [pendingIndex])
  useEffect(() => { statRef.current = { ...statRef.current, perfectCombo } }, [perfectCombo])

  const applyJudgment = useCallback((type: JudgmentType) => {
    judgeCountRef.current += 1
    setLastJudgment({ type, id: judgeCountRef.current })

    const current = statRef.current
    let { score, gauge, perfectCombo: combo, perfectCount, goodCount, missCount } = current

    if (type === 'PERFECT') {
      combo += 1
      score += combo >= 5 ? 200 : 100
      gauge = Math.min(100, gauge + (combo >= 5 ? 2 : 1))
      perfectCount += 1
    } else if (type === 'GOOD') {
      combo = 0
      score += 50
      goodCount += 1
    } else {
      combo = 0
      gauge = Math.max(0, gauge - 15)
      missCount += 1
    }

    setPerfectCombo(combo)
    onStatUpdate({ score, gauge, perfectCombo: combo, perfectCount, goodCount, missCount })

    if (gauge <= 0) {
      onGameOver()
      return
    }

    const next = pendingIndexRef.current + 1
    setPendingIndex(next)
    pendingIndexRef.current = next

    if (next >= inputSyllables.length) {
      onStageComplete()
    }
  }, [inputSyllables.length, onStatUpdate, onGameOver, onStageComplete])

  // 자동 MISS: 판정 창 초과 후 MISS 처리
  useEffect(() => {
    startTimeRef.current = Date.now()
    setPendingIndex(0)
    pendingIndexRef.current = 0

    const interval = setInterval(() => {
      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return
      const arrivalTime = startTimeRef.current + idx * beatMs
      const delta = Date.now() - arrivalTime
      if (delta > GOOD_WINDOW) {
        applyJudgment('MISS')
      }
    }, 16)

    return () => clearInterval(interval)
  }, [stageData, beatMs, applyJudgment, inputSyllables.length])

  // 키 입력 처리
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      const km = keyMapping.find(k => {
        const codeMap: Record<string, string> = {
          a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF',
          j: 'KeyJ', k: 'KeyK', l: 'KeyL', ';': 'Semicolon',
        }
        return codeMap[k.key] === e.code
      })
      if (!km) return

      setPressedKey(e.code)
      setTimeout(() => setPressedKey(undefined), 100)

      const idx = pendingIndexRef.current
      if (idx >= inputSyllables.length) return

      const arrivalTime = startTimeRef.current + idx * beatMs
      const delta = Math.abs(Date.now() - arrivalTime)
      const expectedSyllable = inputSyllables[idx]

      if (km.syllable !== expectedSyllable) {
        applyJudgment('MISS')
      } else if (delta <= PERFECT_WINDOW) {
        applyJudgment('PERFECT')
      } else if (delta <= GOOD_WINDOW) {
        applyJudgment('GOOD')
      } else {
        applyJudgment('MISS')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stageData, keyMapping, inputSyllables, beatMs, applyJudgment])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 relative flex flex-col">
        {/* 판정 결과 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <JudgmentDisplay judgment={lastJudgment} perfectCombo={perfectCombo} />
        </div>

        {/* 노트 트랙 */}
        <NoteTrack
          inputSyllables={inputSyllables}
          beatMs={beatMs}
          startTime={startTimeRef.current}
          pendingIndex={pendingIndex}
        />
      </div>

      <KeyboardDisplay keyMapping={keyMapping} pressedKey={pressedKey} />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/game/PlayStage.tsx
git commit -m "feat: PlayStage 컴포넌트 구현 (판정 로직 포함)"
```

---

## Task 9: GameScreen 컨테이너

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: GameScreen 전면 교체**

```tsx
// src/components/GameScreen.tsx
import { useEffect, useState } from 'react'
import type { GameData, GamePhase, GameStat, StageData } from '../types'
import { GameHeader } from './game/GameHeader'
import { PlayStage } from './game/PlayStage'
import { PreviewStage } from './game/PreviewStage'

interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
}

const INITIAL_STAT: GameStat = {
  score: 0,
  gauge: 100,
  perfectCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  missCount: 0,
}

export function GameScreen({ nickname }: GameScreenProps) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('preview')
  const [stat, setStat] = useState<GameStat>(INITIAL_STAT)

  // 스테이지 데이터 로드
  useEffect(() => {
    fetch('/rhythm_stages_001_015.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!gameData || gameData.stages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-error">
        스테이지 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const currentStage: StageData = gameData.stages[stageIndex]

  const handlePreviewEnd = () => setPhase('playing')

  const handleStatUpdate = (update: Partial<GameStat>) => {
    setStat(prev => ({ ...prev, ...update }))
  }

  const handleStageComplete = () => {
    const nextIndex = stageIndex + 1
    if (nextIndex >= gameData.stages.length) {
      setPhase('result')
    } else {
      setStageIndex(nextIndex)
      setPhase('preview')
    }
  }

  const handleGameOver = () => {
    // TODO: RESULT 화면 (별도 이슈) — 현재는 시작화면으로 복귀 불가, 결과 메시지만 표시
    setPhase('result')
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h2 className="text-4xl font-black text-primary">
          {stageIndex >= gameData.stages.length - 1 ? 'ALL CLEAR' : 'GAME OVER'}
        </h2>
        <div className="text-center space-y-1 text-base-content/70">
          <p>Score: {stat.score}</p>
          <p>PERFECT: {stat.perfectCount} / GOOD: {stat.goodCount} / MISS: {stat.missCount}</p>
          <p>{nickname}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setStageIndex(0)
            setStat(INITIAL_STAT)
            setPhase('preview')
          }}
        >
          다시 하기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <GameHeader
        stage={currentStage.stage}
        word={currentStage.word}
        gauge={stat.gauge}
        score={stat.score}
      />

      {phase === 'preview' && (
        <PreviewStage
          stageData={currentStage}
          onPreviewEnd={handlePreviewEnd}
        />
      )}

      {phase === 'playing' && (
        <PlayStage
          stageData={currentStage}
          stat={stat}
          onStatUpdate={handleStatUpdate}
          onStageComplete={handleStageComplete}
          onGameOver={handleGameOver}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 개발 서버 실행 + 전체 흐름 확인**

```bash
npm run dev
```

확인 체크리스트:
- [ ] 닉네임 입력 → 게임 화면 진입
- [ ] Stage 1 미리보기: `커 피 커 코 피...` 순서로 BPM(90)에 맞춰 강조
- [ ] 키보드 해당 키 동시 강조 확인
- [ ] 미리보기 종료 후 자동으로 본게임 전환
- [ ] 노트가 오른쪽→판정선으로 이동
- [ ] `A` 키 입력 시 PERFECT/GOOD/MISS 판정 표시
- [ ] 콤보 5 이상 시 강화 보상 적용
- [ ] 게이지 감소/증가 확인
- [ ] Stage 1 완료 후 Stage 2 미리보기로 전환

- [ ] **Step 3: 커밋**

```bash
git add src/components/GameScreen.tsx src/components/game/
git commit -m "feat: GameScreen 컨테이너 구현 (미리보기→본게임 전체 흐름) https://github.com/PickerPicker/PickerPicker/issues/11"
```

---

## Task 10: TypeScript 빌드 검증 + 최종 커밋

**Files:** 없음 (검증만)

- [ ] **Step 1: 빌드 확인**

```bash
npm run build
```

에러 없이 빌드 성공해야 함. 타입 오류 발생 시 해당 파일 수정.

- [ ] **Step 2: 최종 커밋**

```bash
git add -A
git commit -m "feat: 스테이지 미리보기 & 본게임 화면 구현 완료 https://github.com/PickerPicker/PickerPicker/issues/11"
```

---

## 검증 기준

| 항목 | 기준 |
|------|------|
| 미리보기 BPM | Stage 1 (90 BPM) = 667ms 간격으로 강조 |
| 노트 이동 | 판정선 도달 타이밍이 BPM 박자와 일치 |
| PERFECT 판정 | 박자에 정확히 맞추면 PERFECT 표시 |
| 게이지 유지 | Stage 전환 후에도 게이지/점수 유지 |
| 빌드 | `npm run build` 에러 없음 |
