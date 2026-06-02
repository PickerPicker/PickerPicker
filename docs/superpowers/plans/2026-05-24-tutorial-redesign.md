# Tutorial 5 STEP 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 튜토리얼을 4 STEP → 5 STEP으로 재설계하여 "흘려보내기" 개념(invalid 노트는 통과시켜야 한다)을 사용자가 체득하게 한다.

**Architecture:** `tutorialSteps.ts`에 STEP 데이터 하드코딩 + `warnInvalidNotes` 플래그 추가. `TutorialStage.tsx`의 `NoteView`에 `isInvalid` prop 추가하여 색상 분기. STEP 4에서 invalid 노트 근처에서 아무 키나 누르면 MISS 처리하는 판정 로직 추가.

**Tech Stack:** React 19, TypeScript, Vite

**Issue:** https://github.com/PickerPicker/PickerPicker/issues/129

---

## File Map

| 파일 | 변경 종류 | 책임 |
|------|---------|------|
| `src/components/tutorial/tutorialSteps.ts` | Modify | STEP 데이터 재정의, 타입 확장 |
| `src/components/tutorial/TutorialStage.tsx` | Modify | NoteView 색상 분기, STEP 4 MISS 판정 |

---

### Task 1: `tutorialSteps.ts` — 타입 + STEP 데이터 교체

**Files:**
- Modify: `src/components/tutorial/tutorialSteps.ts`

- [ ] **Step 1: `TutorialStep` 타입에 `warnInvalidNotes` 필드 추가 + STEP id 범위 확장**

`tutorialSteps.ts` 상단 인터페이스를 아래로 교체한다:

```typescript
export interface TutorialStep {
  id: 1 | 2 | 3 | 4 | 5
  label: string
  message: string
  hintKeys: string[]
  word: string
  validSyllables: string[]
  noteLoop: string[]
  keyMapping: KeyMapping[]
  target: number
  gaugeLoss: boolean
  missMode: boolean
  warnInvalidNotes?: boolean   // true이면 invalid 노트를 주황/빨강으로 렌더
  isReady?: boolean
  countdownSec?: number
}
```

- [ ] **Step 2: `TUTORIAL_STEPS` 배열 전체 교체**

`PAD_INVALID` 상수와 `TUTORIAL_STEPS` 배열을 아래 내용으로 전체 교체한다:

```typescript
const PAD_INVALID: KeyMapping[] = [
  { key: 's', syllable: '-', type: 'invalid' },
  { key: 'd', syllable: '-', type: 'invalid' },
  { key: 'f', syllable: '-', type: 'invalid' },
  { key: 'j', syllable: '-', type: 'invalid' },
  { key: 'k', syllable: '-', type: 'invalid' },
  { key: 'l', syllable: '-', type: 'invalid' },
  { key: ';', syllable: '-', type: 'invalid' },
]

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── STEP 1/5: 기초 타격 ──────────────────────────────
  {
    id: 1,
    label: 'STEP 1 / 5',
    message: 'A 키 = "피" 입니다. "피" 노트가 오면 A를 누르세요',
    hintKeys: ['a'],
    word: '피커',
    validSyllables: ['피'],
    noteLoop: ['피'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      ...PAD_INVALID,
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
  },

  // ── STEP 2/5: 두 키 교대 ─────────────────────────────
  {
    id: 2,
    label: 'STEP 2 / 5',
    message: 'A = "피", S = "커". 교대로 누르세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '-', type: 'invalid' },
      { key: 'f', syllable: '-', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '-', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
  },

  // ── STEP 3/5: 흘려보내기 연습 (패널티 없음) ───────────
  {
    id: 3,
    label: 'STEP 3 / 5',
    message: '"비", "코" 같은 노트는 내 꺼가 아닙니다. 누르지 말고 흘려보내세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커', '비', '피', '커', '코'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '비', type: 'invalid' },
      { key: 'f', syllable: '코', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '-', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
    warnInvalidNotes: true,
  },

  // ── STEP 4/5: 실전 혼합 (패널티 있음) ────────────────
  {
    id: 4,
    label: 'STEP 4 / 5',
    message: '실전! "비", "코", "퍼" 노트를 누르면 MISS. 침착하게 흘려보내세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커', '비', '피', '커', '코', '피', '퍼'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '비', type: 'invalid' },
      { key: 'f', syllable: '코', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '퍼', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 6,
    gaugeLoss: true,
    missMode: false,
    warnInvalidNotes: true,
  },

  // ── STEP 5/5: READY ──────────────────────────────────
  {
    id: 5,
    label: 'STEP 5 / 5',
    message: 'READY!',
    hintKeys: [],
    word: '',
    validSyllables: [],
    noteLoop: [],
    keyMapping: [],
    target: 0,
    gaugeLoss: false,
    missMode: false,
    isReady: true,
    countdownSec: 3,
  },
]
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
npx -p typescript tsc --noEmit
```

에러 없으면 OK. `id: 1 | 2 | 3 | 4 | 5` 타입 오류 있으면 인터페이스 수정.

- [ ] **Step 4: 커밋**

```bash
git add src/components/tutorial/tutorialSteps.ts
git commit -m "튜토리얼 흘려보내기 개념 추가 및 5 STEP 재설계 : feat : tutorialSteps 5 STEP 재정의, 피커 단어, warnInvalidNotes 타입 추가 https://github.com/PickerPicker/PickerPicker/issues/129"
```

---

### Task 2: `TutorialStage.tsx` — NoteView 색상 분기

**Files:**
- Modify: `src/components/tutorial/TutorialStage.tsx`

- [ ] **Step 1: `NoteView` 컴포넌트 시그니처에 `isInvalid` prop 추가**

`TutorialStage.tsx` 하단 `NoteView` 함수 시그니처를 찾아 아래로 교체한다:

```typescript
function NoteView({ note, travelMs, trackWidth, hintActive, isInvalid }: {
  note: SpawnedNote
  travelMs: number
  trackWidth: number
  hintActive: boolean
  isInvalid: boolean   // warnInvalidNotes 활성 시 invalid 노트 색상 분기용
}) {
```

- [ ] **Step 2: `NoteView` 내부 `borderColor` 계산 로직 교체**

기존 `borderColor` 계산 블록을 찾아 아래로 교체한다:

```typescript
  const borderColor =
    note.hitType === 'PERFECT' ? '#00ffaa' :
    note.hitType === 'GOOD'    ? '#ffd700' :
    note.hitType === 'MISS'    ? '#ff5577' :
    isInvalid                  ? '#ff7744' :   // 주황-빨강: 흘려보내야 할 노트
    hintActive                 ? '#00b4ff' :
    'rgba(255,255,255,0.5)'
```

- [ ] **Step 3: `NoteView` 렌더에서 `boxShadow` 색상도 분기**

기존 `boxShadow` 속성을 찾아 아래로 교체한다 (`style` 객체 안):

```typescript
boxShadow: note.hit
  ? 'none'
  : isInvalid
    ? '0 0 16px rgba(255,119,68,0.45)'   // 주황 glow
    : '0 0 22px rgba(0,180,255,0.55)',    // 파란 glow
```

- [ ] **Step 4: `TutorialStage` 렌더에서 `NoteView`에 `isInvalid` prop 전달**

`notes.map(...)` 안의 `<NoteView ... />` 호출을 찾아 `isInvalid` prop 추가:

```typescript
{notes.map(n => (
  <NoteView
    key={n.id}
    note={n}
    travelMs={travelMs}
    trackWidth={trackWidth}
    hintActive={step.hintKeys.length > 0}
    isInvalid={
      !!step.warnInvalidNotes &&
      step.keyMapping.find(m => m.syllable === n.syllable)?.type === 'invalid'
    }
  />
))}
```

- [ ] **Step 5: TypeScript 컴파일 확인**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
git add src/components/tutorial/TutorialStage.tsx
git commit -m "튜토리얼 흘려보내기 개념 추가 및 5 STEP 재설계 : feat : NoteView isInvalid prop 추가, invalid 노트 주황 색상 분기 https://github.com/PickerPicker/PickerPicker/issues/129"
```

---

### Task 3: `TutorialStage.tsx` — STEP 4 invalid 노트 MISS 판정 로직

**Files:**
- Modify: `src/components/tutorial/TutorialStage.tsx`

현재 키 입력 핸들러 흐름:
1. `best` 노트 탐색 (가장 가까운 미처리 노트)
2. `km.type !== 'valid'` 또는 `km.syllable !== noteSyllable` → MISS

STEP 4 추가 조건: **`best` 노트가 invalid 타입이면 어떤 키를 눌러도 MISS**

- [ ] **Step 1: 키 입력 핸들러에서 `best` 판정 직후 invalid 노트 체크 추가**

`TutorialStage.tsx`의 `useEffect` 키 입력 핸들러 안, `if (!best) return` 직후에 아래 블록을 삽입한다:

```typescript
      if (!best) return

      // STEP 4: invalid 노트가 판정선 근처에 있을 때 아무 키나 눌러도 MISS
      const bestKm = step.keyMapping.find(m => m.syllable === (best as SpawnedNote).syllable)
      if (step.gaugeLoss && bestKm?.type === 'invalid') {
        applyJudgment('MISS', best)
        return
      }
```

- [ ] **Step 2: 동작 원리 확인**

`step.gaugeLoss`를 조건으로 쓰는 이유:
- STEP 3: `gaugeLoss: false` → 이 블록 스킵 → invalid 노트 근처에서 키 눌러도 아무 일 없음
- STEP 4: `gaugeLoss: true` → 이 블록 실행 → MISS + 게이지 감소

별도 플래그(`penalizeInvalidPress` 등) 없이 기존 `gaugeLoss`로 충분히 구분됨.

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/tutorial/TutorialStage.tsx
git commit -m "튜토리얼 흘려보내기 개념 추가 및 5 STEP 재설계 : feat : STEP 4 invalid 노트 접근 시 키 입력 MISS 판정 로직 추가 https://github.com/PickerPicker/PickerPicker/issues/129"
```

---

### Task 4: `TutorialScreen.tsx` — STEP 수 변경 확인 및 수동 테스트

**Files:**
- Modify: `src/components/tutorial/TutorialScreen.tsx` (필요 시)

- [ ] **Step 1: `TutorialScreen.tsx` STEP 관련 하드코딩 확인**

아래 항목 확인. 모두 `TUTORIAL_STEPS.length`를 동적으로 참조하므로 변경 불필요:
- `Math.min(TUTORIAL_STEPS.length - 1, i + 1)` ✓
- `step.isReady` 체크로 READY STEP 감지 ✓
- `stepIdx === 0` 초기화 조건 ✓

hardcode된 숫자 `4` 가 있으면 제거. 없으면 넘어간다.

- [ ] **Step 2: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 3: 브라우저에서 튜토리얼 전체 플로우 수동 검증**

체크리스트:
- [ ] STEP 1/5: "피" 노트만 날아옴. A 키 4회 성공 → STEP 2 자동 진행
- [ ] STEP 2/5: "피"/"커" 교대. A/S 4회 성공 → STEP 3 자동 진행
- [ ] STEP 3/5: "비"(주황), "코"(주황) 노트가 섞여 날아옴. 흘려보내도 MISS 없음. valid 4회 성공 → STEP 4
- [ ] STEP 3/5: "비" 노트 근처에서 아무 키나 눌러도 MISS 안 뜸 (패널티 없음 확인)
- [ ] STEP 4/5: "비"/"코"/"퍼" 노트 주황색. 해당 노트 근처에서 아무 키나 누르면 MISS + 게이지 감소
- [ ] STEP 4/5: valid 노트는 정상 타격 가능. 6회 성공 → STEP 5
- [ ] STEP 5/5: READY 카운트다운 or 시작 화면 복귀 정상 동작

- [ ] **Step 4: 최종 커밋**

```bash
git add src/components/tutorial/TutorialScreen.tsx  # 변경 없으면 생략
git commit -m "튜토리얼 흘려보내기 개념 추가 및 5 STEP 재설계 : feat : 튜토리얼 5 STEP 재설계 완료, 흘려보내기 연습/실전 STEP 추가 https://github.com/PickerPicker/PickerPicker/issues/129"
```
