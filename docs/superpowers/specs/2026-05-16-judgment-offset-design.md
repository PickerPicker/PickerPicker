# 판정 타이밍 오프셋 설계

**날짜:** 2026-05-16  
**상태:** 승인됨

---

## 개요

기기마다 다른 입력 지연(input lag)을 보상하기 위해 판정 기준 시점을 앞뒤로 이동할 수 있는 오프셋 설정 기능을 추가한다.

---

## 요구사항

- 범위: ±100ms
- 단위: 1ms
- 기본값: 0ms
- 저장: localStorage (`pickerpicker_offset`)
- 접근: 홈 화면 → 설정 버튼 → 게임 설정 모달

---

## 데이터 흐름

오프셋은 `App.tsx`에서 `useState`로 관리하며 `localStorage`로 초기화한다.

```
App.tsx
  └─ offset state
       ├─ StartScreen → SettingsModal (읽기/쓰기)
       └─ GameScreen → PlayStage (판정 적용)
```

두 곳에 prop으로 전달해 설정 화면에서 바꾼 값이 즉시 게임에 반영된다.

---

## UI 변경

### AudioSettingsModal → SettingsModal

파일명과 컴포넌트명을 `SettingsModal`로 변경한다. 모달 헤더 텍스트도 "음향 설정" → "게임 설정"으로 변경.

기존 항목(BGM 볼륨, 효과음) 아래에 판정 오프셋 섹션 추가:

```
┌─────────────────────────────┐
│ 게임 설정              [✕]  │
├─────────────────────────────┤
│ BGM 볼륨         [슬라이더] │
│ 효과음           [토글]     │
├─────────────────────────────┤
│ 판정 오프셋                 │
│  [−]  [ -12ms ]  [+]        │
│  음수: 판정 앞당김          │
│  양수: 판정 늦춤            │
└─────────────────────────────┘
```

- `−` / `+` 버튼: 1ms씩 조절
- 값 표시: `font-mono` 고정폭, 항상 부호 표시 (`+5ms`, `-12ms`, `0ms`)
- ±100ms 초과 시 해당 방향 버튼 비활성화

### Props 변경 (SettingsModal)

```ts
interface SettingsModalProps {
  bgmVolume: number
  sfxOn: boolean
  offset: number          // 추가
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void  // 추가
  onClose: () => void
}
```

---

## 판정 적용 (PlayStage)

`PlayStage`에 `offset: number` prop 추가. 판정 시 노트 도착 시간에 오프셋을 더한다.

```ts
// 변경 전
const arrivalTime = startTimeRef.current + idx * beatMs

// 변경 후
const arrivalTime = startTimeRef.current + idx * beatMs + offset
```

적용 위치:
1. 자동 MISS 체크: `delta > GOOD_WINDOW` 비교 시
2. 키 입력 판정: `Math.abs(Date.now() - arrivalTime)` 비교 시

**오프셋 방향:**
- 양수(+): 도착 시간을 늦춤 → 입력 지연이 있는 기기 보상
- 음수(-): 도착 시간을 앞당김 → 더 빠르게 눌러야 판정 통과

---

## App.tsx 변경

```ts
const LS_OFFSET_KEY = 'pickerpicker_offset'

const [offset, setOffset] = useState(() => {
  const saved = localStorage.getItem(LS_OFFSET_KEY)
  return saved ? Number(saved) : 0
})

const handleOffset = (v: number) => {
  const clamped = Math.max(-100, Math.min(100, v))
  setOffset(clamped)
  localStorage.setItem(LS_OFFSET_KEY, String(clamped))
}
```

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/AudioSettingsModal.tsx` | → `SettingsModal.tsx` 로 이름 변경, offset props 추가 |
| `src/components/StartScreen.tsx` | import 경로 변경, offset props 전달 |
| `src/components/game/PlayStage.tsx` | offset prop 추가, arrivalTime 보정 |
| `src/components/GameScreen.tsx` | offset prop 받아서 PlayStage에 전달 |
| `src/App.tsx` | offset state 관리, localStorage 초기화 |
