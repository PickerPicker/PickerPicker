# 로그인 플로우 인플레이스 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 닉네임/PIN 입력을 overlay 모달 대신 StartScreen 내부 인플레이스 뷰로 전환한다.

**Architecture:** StartScreen의 내부 `screen` state를 확장해 `nickname`, `pin-login`, `pin-create`, `pin-confirm` 뷰를 추가. API 호출(checkNickname, createPlayer, verifyPin)을 StartScreen 내부로 이동하고, App.tsx는 `onLoginComplete(nickname)` 콜백만 받는다.

**Tech Stack:** React 19, TypeScript, DaisyUI/Tailwind, playerService (기존)

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `src/components/StartScreen.tsx` | NicknameView, PinView 추가, screen state 확장, playerService import |
| `src/App.tsx` | 모달 state/콜백 제거, `onLoginComplete` 추가 |
| `src/components/NicknameModal.tsx` | 삭제 (Task 4에서 사용자 확인 후) |
| `src/components/PinModal.tsx` | 삭제 (Task 4에서 사용자 확인 후) |

---

### Task 1: StartScreen — screen state 확장 및 NicknameView 추가

**Files:**
- Modify: `src/components/StartScreen.tsx`

- [ ] **Step 1: screen 타입 확장 및 로그인 관련 state 추가**

`StartScreen.tsx` 상단 타입 및 props 변경:

```tsx
// 기존
type Screen = 'home' | 'settings' | 'credits'

// 변경 후
type Screen = 'home' | 'settings' | 'credits' | 'nickname' | 'pin-login' | 'pin-create' | 'pin-confirm'
```

`StartScreen` props에 추가:
```tsx
interface StartScreenProps {
  // ... 기존 props 유지 ...
  onLoginComplete: (nickname: string) => void
}
```

함수 시그니처:
```tsx
export function StartScreen({
  onRanking, onStart, onPractice, onTutorial, hasPlayedBefore,
  bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset,
  nickname, onLogout, onLoginComplete,
}: StartScreenProps) {
```

내부 state 추가 (기존 `const [screen, setScreen] = useState<Screen>('home')` 아래):
```tsx
const [loginNickname, setLoginNickname] = useState('')
const [pendingPin, setPendingPin] = useState('')
const [pinError, setPinError] = useState('')
const [loginLoading, setLoginLoading] = useState(false)
```

- [ ] **Step 2: NicknameView 컴포넌트 추가 (StartScreen.tsx 내부)**

`SettingsView` 위에 추가:

```tsx
function NicknameView({
  onConfirm,
  onBack,
}: {
  onConfirm: (name: string) => Promise<void>
  onBack: () => void
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    await onConfirm(trimmed)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        닉네임 입력
      </h2>
      <input
        type="text"
        placeholder="닉네임을 입력하세요"
        className="input input-bordered w-full"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
        autoFocus
        maxLength={20}
      />
      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={!value.trim() || loading}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
        </SoundButton>
        <SoundButton
          className="btn btn-sm w-full"
          style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={onBack}
          disabled={loading}
        >
          ← BACK
        </SoundButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: StartScreen 본체에서 닉네임 핸들러 및 screen 분기 추가**

`StartScreen` 함수 내부 (state 선언 아래):

```tsx
const handleNicknameConfirm = async (name: string) => {
  setLoginLoading(true)
  const exists = await checkNickname(name)
  setLoginLoading(false)
  setLoginNickname(name)
  setScreen(exists ? 'pin-login' : 'pin-create')
}

const resetLogin = () => {
  setLoginNickname('')
  setPendingPin('')
  setPinError('')
}
```

`onStart` 처리 변경 — StartScreen 내부에서 분기:
```tsx
// props의 onStart 대신 내부 handleStart 사용
const handleStartClick = () => {
  if (nickname) {
    onStart() // 이미 로그인 → App.tsx가 게임 진입 처리
    return
  }
  resetLogin()
  setScreen('nickname')
}
```

`screen === 'home'` 블록의 시작 버튼:
```tsx
<SoundButton className="btn btn-primary btn-lg w-full text-lg" onClick={handleStartClick}>
  {nickname ? '플레이하기' : '시작'}
</SoundButton>
```

JSX 분기에 추가:
```tsx
{screen === 'nickname' && (
  <NicknameView
    onConfirm={handleNicknameConfirm}
    onBack={() => { resetLogin(); setScreen('home') }}
  />
)}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/suhsaechan/Desktop/Programming/project/PickerPicker
npx -p typescript tsc --noEmit
```

타입 에러 없어야 함.

- [ ] **Step 5: 커밋**

```bash
git add src/components/StartScreen.tsx
git commit -m "로그인 플로우 인플레이스 전환 : feat : NicknameView 인플레이스 추가, screen state 확장 https://github.com/PickerPicker/PickerPicker/issues/55"
```

---

### Task 2: StartScreen — PinView 추가

**Files:**
- Modify: `src/components/StartScreen.tsx`

- [ ] **Step 1: playerService import 추가**

`StartScreen.tsx` 상단:
```tsx
import { checkNickname, createPlayer, verifyPin } from '../services/playerService'
```

- [ ] **Step 2: PinView 컴포넌트 추가**

`NicknameView` 아래:

```tsx
function PinView({
  mode,
  nickname,
  onConfirm,
  onBack,
  error,
}: {
  mode: 'login' | 'create' | 'confirm'
  nickname: string
  onConfirm: (pin: string) => Promise<void>
  onBack: () => void
  error: string
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const title =
    mode === 'login'
      ? `${nickname}님, PIN 입력`
      : mode === 'create'
      ? 'PIN 설정 (4자리 숫자)'
      : 'PIN 확인 (다시 입력)'

  const handleConfirm = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    await onConfirm(pin)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        {title}
      </h2>

      {/* 신규 PIN 설정 시 가이드라인 (create, confirm 공통) */}
      {(mode === 'create' || mode === 'confirm') && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(255,180,0,0.10)',
            border: '1px solid rgba(255,180,0,0.4)',
            color: 'rgba(255,210,80,0.95)',
          }}
        >
          {mode === 'create'
            ? '⚠️ 이 PIN은 다음 로그인 시 필요합니다. 꼭 기억해 두세요!'
            : '⚠️ PIN을 다시 한번 입력하세요. 잊어버리면 재설정이 불가합니다.'}
        </div>
      )}

      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="● ● ● ●"
        className="input input-bordered w-full text-center tracking-widest text-2xl"
        value={pin}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(digits)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
        autoFocus
      />

      {error && <p className="text-error text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
        </SoundButton>
        <SoundButton
          className="btn btn-sm w-full"
          style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={onBack}
          disabled={loading}
        >
          ← BACK
        </SoundButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: PIN 핸들러 및 JSX 분기 추가**

`handleNicknameConfirm` 아래:

```tsx
const handlePinConfirm = async (pin: string) => {
  if (screen === 'pin-login') {
    setLoginLoading(true)
    const ok = await verifyPin(loginNickname, pin)
    setLoginLoading(false)
    if (!ok) {
      setPinError('PIN이 틀렸습니다')
      return
    }
    resetLogin()
    setScreen('home')
    onLoginComplete(loginNickname)
  } else if (screen === 'pin-create') {
    setPendingPin(pin)
    setPinError('')
    setScreen('pin-confirm')
  } else if (screen === 'pin-confirm') {
    if (pin !== pendingPin) {
      setPinError('PIN이 일치하지 않습니다')
      setPendingPin('')
      setScreen('pin-create')
      return
    }
    setLoginLoading(true)
    await createPlayer(loginNickname, pin)
    setLoginLoading(false)
    resetLogin()
    setScreen('home')
    onLoginComplete(loginNickname)
  }
}
```

JSX 분기 추가 (`screen === 'nickname'` 블록 아래):

```tsx
{(screen === 'pin-login' || screen === 'pin-create' || screen === 'pin-confirm') && (
  <PinView
    mode={
      screen === 'pin-login' ? 'login'
      : screen === 'pin-create' ? 'create'
      : 'confirm'
    }
    nickname={loginNickname}
    onConfirm={handlePinConfirm}
    onBack={() => {
      setPinError('')
      setPendingPin('')
      setScreen('nickname')
    }}
    error={pinError}
  />
)}
```

- [ ] **Step 4: 빌드 확인**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/StartScreen.tsx
git commit -m "로그인 플로우 인플레이스 전환 : feat : PinView 인플레이스 추가, PIN 핸들러 구현 https://github.com/PickerPicker/PickerPicker/issues/55"
```

---

### Task 3: App.tsx — 모달 제거 및 onLoginComplete 연결

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsx 모달 관련 state/콜백 제거**

제거 대상:
- `const [showNicknameModal, setShowNicknameModal] = useState(false)`
- `const [pinStep, setPinStep] = useState<PinStep | null>(null)`
- `const [pendingPin, setPendingPin] = useState('')`
- `const [isNewPlayer, setIsNewPlayer] = useState(true)`
- `handleNicknameConfirm`, `handlePinSuccess`, `handleBack` 함수
- `PinStep` 타입
- `NicknameModal`, `PinModal` import

- [ ] **Step 2: handleLoginComplete 추가**

`handleLogout` 아래:

```tsx
const handleLoginComplete = (name: string) => {
  setNickname(name)
  localStorage.setItem(LS_NICKNAME_KEY, name)
  goToGameOrTutorial('game')
}
```

- [ ] **Step 3: handleStart 단순화**

```tsx
const handleStart = () => {
  audio.ensureAudioCtx()
  if (nickname) {
    goToGameOrTutorial('game')
  }
  // 비로그인 시 StartScreen 내부에서 처리
}
```

- [ ] **Step 4: StartScreen JSX에 onLoginComplete 전달, 모달 렌더링 제거**

```tsx
{currentScreen === 'start' && (
  <StartScreen
    onRanking={() => setCurrentScreen('ranking')}
    onStart={handleStart}
    onPractice={() => {
      audio.ensureAudioCtx()
      setCurrentScreen('practice')
    }}
    onTutorial={handleTutorialOpen}
    hasPlayedBefore={hasPlayedBefore}
    bgmVolume={audio.bgmVolume}
    sfxOn={audio.sfxOn}
    onBgmVolume={audio.setBgmVol}
    onToggleSfx={audio.toggleSfx}
    offset={offset}
    onOffset={handleOffset}
    nickname={nickname}
    onLogout={handleLogout}
    onLoginComplete={handleLoginComplete}
  />
)}
```

JSX 하단에서 `NicknameModal`, `PinModal` 블록 전체 제거.

- [ ] **Step 5: 빌드 확인**

```bash
npx -p typescript tsc --noEmit
```

에러 없어야 함.

- [ ] **Step 6: 커밋**

```bash
git add src/App.tsx
git commit -m "로그인 플로우 인플레이스 전환 : refactor : App.tsx 모달 state 제거, onLoginComplete 연결 https://github.com/PickerPicker/PickerPicker/issues/55"
```

---

### Task 4: 미사용 모달 파일 삭제

**Files:**
- Delete: `src/components/NicknameModal.tsx`
- Delete: `src/components/PinModal.tsx`

- [ ] **Step 1: 잔여 참조 확인**

```bash
grep -r "NicknameModal\|PinModal" /Users/suhsaechan/Desktop/Programming/project/PickerPicker/src
```

결과가 없어야 함 (0 matches).

- [ ] **Step 2: 파일 삭제 (사용자 확인 후 진행)**

> ⚠️ 파일 삭제는 사용자 확인 필수 (CLAUDE.md 규정)

```bash
rm src/components/NicknameModal.tsx
rm src/components/PinModal.tsx
```

- [ ] **Step 3: 빌드 확인**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add -u src/components/NicknameModal.tsx src/components/PinModal.tsx
git commit -m "로그인 플로우 인플레이스 전환 : chore : 미사용 NicknameModal, PinModal 삭제 https://github.com/PickerPicker/PickerPicker/issues/55"
```

---

### Task 5: 수동 QA

- [ ] **비로그인 상태에서 시작 클릭** → nickname 뷰 표시 확인
- [ ] **닉네임 뷰 ← BACK** → 홈 복귀 확인
- [ ] **신규 닉네임 입력** → pin-create 뷰 + 가이드라인 문구 표시 확인
- [ ] **기존 닉네임 입력** → pin-login 뷰 (가이드라인 없음) 확인
- [ ] **pin-create ← BACK** → nickname 뷰 복귀 확인
- [ ] **pin-create 확인** → pin-confirm 뷰 + 재강조 문구 확인
- [ ] **pin-confirm 불일치** → pin-create 복귀 + 에러 없음 확인
- [ ] **pin-confirm 일치** → 게임 진입 확인
- [ ] **pin-login 틀린 PIN** → 에러 메시지 표시 확인
- [ ] **pin-login 올바른 PIN** → 게임 진입 확인
- [ ] **로그인 상태에서 플레이하기** → 바로 게임 진입 (닉네임 뷰 건너뜀) 확인
