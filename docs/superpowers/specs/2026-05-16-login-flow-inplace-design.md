# 로그인 플로우 인플레이스 전환 설계

**날짜**: 2026-05-16  
**이슈**: #55  
**상태**: 승인됨

---

## 개요

현재 닉네임 입력 + PIN 입력이 overlay `<dialog>` 모달로 처리됨.  
설정/크레딧 화면처럼 `StartScreen` 내부에서 인플레이스로 전환하도록 변경.

---

## 현재 구조

```
App.tsx
├── showNicknameModal: boolean  → NicknameModal (dialog overlay)
├── pinStep: 'login'|'create'|'confirm'|null  → PinModal (dialog overlay)
└── StartScreen (별도 상태)
```

---

## 목표 구조

```
StartScreen
└── screen: 'home'|'settings'|'credits'|'nickname'|'pin-login'|'pin-create'|'pin-confirm'
    ├── NicknameView   (인플레이스)
    └── PinView        (인플레이스)

App.tsx
└── showNicknameModal, pinStep 제거
    └── onLoginComplete(nickname) 콜백만 전달
```

---

## 화면 전환 흐름

```
home
 └─[시작 클릭, 비로그인]→ nickname
      ├─[← BACK]→ home
      └─[확인]→ (API 체크)
           ├─ 기존 유저 → pin-login
           └─ 신규 유저 → pin-create

pin-login
 ├─[← BACK]→ nickname
 └─[성공]→ App.onLoginComplete(nickname)

pin-create
 ├─[← BACK]→ nickname
 └─[확인]→ pin-confirm

pin-confirm
 ├─[← BACK]→ nickname
 ├─[불일치]→ pin-create  (에러 메시지 표시)
 └─[일치]→ App.onLoginComplete(nickname)
```

> 이미 로그인 상태(`nickname` 존재)면 시작 클릭 시 바로 게임 진입 (현재 동일).

---

## 컴포넌트 설계

### StartScreen props 변경

```ts
// 추가
onLoginComplete: (nickname: string) => void

// 제거 (App.tsx에서 더 이상 불필요)
// showNicknameModal, pinStep 관련 콜백 App.tsx에서 제거
```

### 내부 상태

```ts
type LoginScreen =
  | 'home' | 'settings' | 'credits'
  | 'nickname' | 'pin-login' | 'pin-create' | 'pin-confirm'

const [screen, setScreen] = useState<LoginScreen>('home')
const [loginNickname, setLoginNickname] = useState('')
const [pendingPin, setPendingPin] = useState('')
const [pinError, setPinError] = useState('')
const [loading, setLoading] = useState(false)
```

### NicknameView

- 닉네임 텍스트 입력 + Enter 지원
- `← BACK` → `setScreen('home')`
- 확인 시 `checkNickname(name)` API 호출 → 결과에 따라 `pin-login` or `pin-create`
- 로딩 스피너 표시

### PinView (mode별 분기)

**공통**:
- 4자리 숫자 입력 (password type)
- `← BACK` → `setScreen('nickname')` + 에러/pending 초기화

**pin-create 전용 가이드라인** (상단 강조 박스):
```
⚠️ 이 PIN은 다음 로그인 시 필요합니다. 꼭 기억해 두세요!
```
- 스타일: `rgba(255,180,0,0.15)` 배경, 노란 테두리

**pin-confirm 전용 가이드라인** (재강조):
```
⚠️ PIN을 다시 한번 입력하세요. 잊어버리면 재설정이 불가합니다.
```
- 스타일: 동일 (경고 박스)

**pin-login**: 가이드라인 없음, 기존 UX 동일

---

## App.tsx 변경 사항

### 제거
- `showNicknameModal` state
- `pinStep` state  
- `pendingPin` state
- `isNewPlayer` state (StartScreen 내부로 이동)
- `handleNicknameConfirm`, `handlePinSuccess`, `handleBack` 함수
- `NicknameModal`, `PinModal` import 및 렌더링

### 추가
- `handleLoginComplete(nickname: string)` — localStorage 저장 + 게임 진입

### StartScreen 호출 변경
```tsx
<StartScreen
  ...
  onLoginComplete={handleLoginComplete}
  // onStart 유지 (로그인 여부 분기는 StartScreen 내부)
/>
```

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/App.tsx` | 모달 state/콜백 제거, `onLoginComplete` 추가 |
| `src/components/StartScreen.tsx` | `NicknameView`, `PinView` 추가, screen state 확장 |
| `src/components/NicknameModal.tsx` | 삭제 (사용자 확인 후) |
| `src/components/PinModal.tsx` | 삭제 (사용자 확인 후) |
| `src/services/playerService.ts` | 변경 없음 |

---

## 비기능 요구사항

- 기존 `SettingsView`, `CreditsView`와 동일한 시각적 스타일 (픽셀 폰트, 반투명 카드)
- ESC 키로 홈 복귀는 현재 없으므로 구현 제외
- PIN 가이드라인 텍스트는 `pin-create`, `pin-confirm` 두 단계 모두 표시
