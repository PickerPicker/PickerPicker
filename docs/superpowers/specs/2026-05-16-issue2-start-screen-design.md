# 이슈 #2 — 시작화면 · 닉네임 입력 · 기존/신규 확인 팝업 설계

## 개요

게임 진입 시 사용자를 식별하는 시작 화면과 닉네임 입력 흐름을 구현한다.
라우터 없이 React state로 화면을 전환하며, 닉네임 존재 여부는 mock 함수로 처리한다 (추후 FastAPI 교체).

---

## 파일 구조

```
src/
  components/
    StartScreen.tsx       # 게임 제목, 랭킹/시작 버튼
    NicknameModal.tsx     # 닉네임 입력 팝업
    PlayerTypeModal.tsx   # 기존/신규 확인 팝업
  services/
    playerService.ts      # checkNickname() mock
  types/
    index.ts              # Screen, PlayerType 타입
  App.tsx                 # screen + 팝업 상태 관리
```

---

## 상태 설계 (App.tsx)

```ts
type Screen = 'start' | 'game' | 'ranking'

const [currentScreen, setCurrentScreen] = useState<Screen>('start')
const [showNicknameModal, setShowNicknameModal] = useState(false)
const [showPlayerTypeModal, setShowPlayerTypeModal] = useState(false)
const [nickname, setNickname] = useState('')
```

---

## 데이터 흐름

```
StartScreen
  랭킹 버튼 → currentScreen = 'ranking'
  시작 버튼 → showNicknameModal = true

NicknameModal
  확인 버튼
    checkNickname() === true  → showPlayerTypeModal = true  (기존 닉네임)
    checkNickname() === false → currentScreen = 'game'      (신규 닉네임)

PlayerTypeModal
  기존 플레이어로 플레이 → currentScreen = 'game'
  신규 플레이어로 플레이 → currentScreen = 'game'
```

`game`, `ranking`은 이번 이슈 범위 밖 — 빈 placeholder 컴포넌트로 둔다.

---

## 컴포넌트 Props

| 컴포넌트 | Props |
|---|---|
| `StartScreen` | `onRanking: () => void`, `onStart: () => void` |
| `NicknameModal` | `onConfirm: (nickname: string) => void`, `onClose: () => void` |
| `PlayerTypeModal` | `nickname: string`, `onExisting: () => void`, `onNew: () => void`, `onClose: () => void` |

---

## Mock 서비스

```ts
// src/services/playerService.ts
// FastAPI 연결 시 이 함수만 교체
export async function checkNickname(name: string): Promise<boolean> {
  const mockExistingPlayers = ['test', 'admin', 'player1']
  return mockExistingPlayers.includes(name.toLowerCase())
}
```

---

## UI 스타일링

- 테마: `pickerpicker` dark (primary #1E90FF, secondary #5f5f5f)
- DaisyUI 컴포넌트 사용

| 요소 | DaisyUI 클래스 |
|---|---|
| 시작화면 레이아웃 | `flex flex-col items-center justify-center min-h-screen` |
| 게임 제목 | `text-primary` bold 대형 텍스트 |
| 랭킹 버튼 | `btn btn-outline` |
| 시작 버튼 | `btn btn-primary` |
| 팝업 | `dialog` (DaisyUI modal) + `backdrop` |
| 닉네임 입력 | `input input-bordered` |
| 기존 플레이어 버튼 | `btn btn-secondary` |
| 신규 플레이어 버튼 | `btn btn-primary` |

---

## 범위 외 (이번 이슈 미포함)

- 게임 화면 구현
- 랭킹 화면 구현
- FastAPI 실제 연동
- 닉네임 유효성 검사 (길이 제한 등)
