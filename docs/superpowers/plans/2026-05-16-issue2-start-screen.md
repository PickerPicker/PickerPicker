# 시작화면 · 닉네임 입력 · 기존/신규 확인 팝업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React state 기반으로 시작화면 → 닉네임 입력 팝업 → 기존/신규 확인 팝업 흐름을 구현한다.

**Architecture:** App.tsx가 `currentScreen`과 팝업 표시 상태를 관리하며, 각 화면/팝업은 독립 컴포넌트로 분리된다. 닉네임 존재 여부는 mock 함수로 처리하며 FastAPI 연결 시 해당 함수만 교체한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, DaisyUI v5, Vite

---

## 파일 맵

| 파일 | 역할 | 작업 |
|---|---|---|
| `src/types/index.ts` | Screen · PlayerType 타입 정의 | 생성 |
| `src/services/playerService.ts` | checkNickname mock 함수 | 생성 |
| `src/components/StartScreen.tsx` | 게임 제목 · 랭킹/시작 버튼 | 생성 |
| `src/components/NicknameModal.tsx` | 닉네임 입력 팝업 | 생성 |
| `src/components/PlayerTypeModal.tsx` | 기존/신규 확인 팝업 | 생성 |
| `src/components/GameScreen.tsx` | 게임 화면 placeholder | 생성 |
| `src/components/RankingScreen.tsx` | 랭킹 화면 placeholder | 생성 |
| `src/App.tsx` | 상태 관리 · 화면 라우팅 | 수정 |

---

## Task 1: 타입 & 서비스 레이어

**Files:**
- Create: `src/types/index.ts`
- Create: `src/services/playerService.ts`

- [ ] **Step 1: 타입 파일 생성**

`src/types/index.ts`를 생성한다:

```ts
export type Screen = 'start' | 'game' | 'ranking'
```

- [ ] **Step 2: mock 서비스 생성**

`src/services/playerService.ts`를 생성한다:

```ts
const MOCK_EXISTING_PLAYERS = ['test', 'admin', 'player1']

export async function checkNickname(name: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return MOCK_EXISTING_PLAYERS.includes(name.toLowerCase())
}
```

`setTimeout` 300ms는 실제 API 응답 지연을 흉내 낸다. FastAPI 연결 시 이 함수 전체를 `fetch` 호출로 교체한다.

- [ ] **Step 3: 커밋**

```bash
git add src/types/index.ts src/services/playerService.ts
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : 타입 정의 및 닉네임 mock 서비스 추가 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## Task 2: StartScreen 컴포넌트

**Files:**
- Create: `src/components/StartScreen.tsx`

- [ ] **Step 1: 컴포넌트 생성**

`src/components/StartScreen.tsx`를 생성한다:

```tsx
interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
}

export function StartScreen({ onRanking, onStart }: StartScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-6xl font-black text-primary tracking-widest">
        PickerPicker
      </h1>
      <div className="flex gap-4">
        <button className="btn btn-outline btn-lg" onClick={onRanking}>
          랭킹
        </button>
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          시작
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 개발 서버에서 확인**

```bash
npm run dev
```

`App.tsx`를 임시로 수정해 `<StartScreen onRanking={() => {}} onStart={() => {}} />`를 렌더링하고 브라우저에서 레이아웃/컬러를 확인한다. 확인 후 `App.tsx`는 원상복구한다.

- [ ] **Step 3: 커밋**

```bash
git add src/components/StartScreen.tsx
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : StartScreen 컴포넌트 구현 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## Task 3: NicknameModal 컴포넌트

**Files:**
- Create: `src/components/NicknameModal.tsx`

- [ ] **Step 1: 컴포넌트 생성**

`src/components/NicknameModal.tsx`를 생성한다:

```tsx
import { useState } from 'react'

interface NicknameModalProps {
  onConfirm: (nickname: string) => void
  onClose: () => void
}

export function NicknameModal({ onConfirm, onClose }: NicknameModalProps) {
  const [value, setValue] = useState('')

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-4">
        <h3 className="font-bold text-lg">닉네임</h3>
        <input
          type="text"
          placeholder="닉네임을 입력하세요"
          className="input input-bordered w-full"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            확인
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/NicknameModal.tsx
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : NicknameModal 컴포넌트 구현 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## Task 4: PlayerTypeModal 컴포넌트

**Files:**
- Create: `src/components/PlayerTypeModal.tsx`

- [ ] **Step 1: 컴포넌트 생성**

`src/components/PlayerTypeModal.tsx`를 생성한다:

```tsx
interface PlayerTypeModalProps {
  nickname: string
  onExisting: () => void
  onNew: () => void
  onClose: () => void
}

export function PlayerTypeModal({ nickname, onExisting, onNew, onClose }: PlayerTypeModalProps) {
  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-6">
        <p className="text-base-content leading-relaxed">
          이미 존재하는 닉네임입니다.<br />
          <span className="text-primary font-bold">{nickname}</span>으로 계속 플레이하시겠습니까?
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary" onClick={onExisting}>
            기존 플레이어로 플레이
          </button>
          <button className="btn btn-primary" onClick={onNew}>
            신규 플레이어로 플레이
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/PlayerTypeModal.tsx
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : PlayerTypeModal 컴포넌트 구현 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## Task 5: Placeholder 화면

**Files:**
- Create: `src/components/GameScreen.tsx`
- Create: `src/components/RankingScreen.tsx`

- [ ] **Step 1: GameScreen placeholder 생성**

`src/components/GameScreen.tsx`를 생성한다:

```tsx
interface GameScreenProps {
  nickname: string
  isNewPlayer: boolean
}

export function GameScreen({ nickname, isNewPlayer }: GameScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-bold text-primary">{nickname}</h2>
      <p className="text-base-content/60">
        {isNewPlayer ? '신규 플레이어' : '기존 플레이어'}
      </p>
      <p className="text-base-content/40 text-sm">게임 화면 (미구현)</p>
    </div>
  )
}
```

- [ ] **Step 2: RankingScreen placeholder 생성**

`src/components/RankingScreen.tsx`를 생성한다:

```tsx
export function RankingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-bold text-primary">랭킹</h2>
      <p className="text-base-content/40 text-sm">랭킹 화면 (미구현)</p>
    </div>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/GameScreen.tsx src/components/RankingScreen.tsx
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : GameScreen · RankingScreen placeholder 추가 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## Task 6: App.tsx 통합

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsx 전체 교체**

`src/App.tsx`를 다음으로 교체한다:

```tsx
import { useState } from 'react'
import './index.css'
import type { Screen } from './types'
import { checkNickname } from './services/playerService'
import { StartScreen } from './components/StartScreen'
import { NicknameModal } from './components/NicknameModal'
import { PlayerTypeModal } from './components/PlayerTypeModal'
import { GameScreen } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('start')
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [showPlayerTypeModal, setShowPlayerTypeModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [isNewPlayer, setIsNewPlayer] = useState(true)

  const handleStart = () => setShowNicknameModal(true)

  const handleNicknameConfirm = async (name: string) => {
    setNickname(name)
    const exists = await checkNickname(name)
    if (exists) {
      setShowPlayerTypeModal(true)
    } else {
      setIsNewPlayer(true)
      setShowNicknameModal(false)
      setCurrentScreen('game')
    }
  }

  const handleExistingPlayer = () => {
    setIsNewPlayer(false)
    setShowNicknameModal(false)
    setShowPlayerTypeModal(false)
    setCurrentScreen('game')
  }

  const handleNewPlayer = () => {
    setIsNewPlayer(true)
    setShowNicknameModal(false)
    setShowPlayerTypeModal(false)
    setCurrentScreen('game')
  }

  return (
    <>
      {currentScreen === 'start' && (
        <StartScreen
          onRanking={() => setCurrentScreen('ranking')}
          onStart={handleStart}
        />
      )}
      {currentScreen === 'game' && (
        <GameScreen nickname={nickname} isNewPlayer={isNewPlayer} />
      )}
      {currentScreen === 'ranking' && <RankingScreen />}

      {showNicknameModal && (
        <NicknameModal
          onConfirm={handleNicknameConfirm}
          onClose={() => setShowNicknameModal(false)}
        />
      )}
      {showPlayerTypeModal && (
        <PlayerTypeModal
          nickname={nickname}
          onExisting={handleExistingPlayer}
          onNew={handleNewPlayer}
          onClose={() => setShowPlayerTypeModal(false)}
        />
      )}
    </>
  )
}

export default App
```

- [ ] **Step 2: 개발 서버에서 전체 흐름 확인**

```bash
npm run dev
```

브라우저에서 다음 시나리오를 직접 테스트한다:

1. **신규 닉네임 흐름:** 시작 → 닉네임 입력(예: `hello`) → 확인 → 게임화면 이동 + "신규 플레이어" 표시
2. **기존 닉네임 흐름:** 시작 → 닉네임 입력(`test` 또는 `admin` 또는 `player1`) → 확인 → PlayerTypeModal 표시
   - 기존 플레이어 버튼 → 게임화면 + "기존 플레이어" 표시
   - 신규 플레이어 버튼 → 게임화면 + "신규 플레이어" 표시
3. **랭킹 버튼:** 랭킹 클릭 → 랭킹 화면 이동
4. **빈 닉네임:** 확인 버튼 disabled 확인
5. **Enter 키:** 닉네임 입력 후 Enter로 확인 동작

- [ ] **Step 3: 타입 체크**

```bash
npm run build
```

에러 없이 빌드 완료 확인.

- [ ] **Step 4: 최종 커밋**

```bash
git add src/App.tsx
git commit -m "시작화면 닉네임 입력 기존/신규 확인 팝업 구현 : feat : App.tsx 화면 상태 관리 및 전체 흐름 연결 https://github.com/PickerPicker/PickerPicker/issues/2"
```

---

## 완료 기준

- [ ] 시작 화면에서 랭킹/시작 버튼이 동작한다
- [ ] 신규 닉네임 입력 시 바로 게임 화면으로 이동한다
- [ ] 기존 닉네임(`test`, `admin`, `player1`) 입력 시 PlayerTypeModal이 표시된다
- [ ] 기존/신규 선택 후 게임 화면으로 이동한다
- [ ] 빈 닉네임으로는 확인 버튼이 비활성화된다
- [ ] `npm run build`가 에러 없이 완료된다
