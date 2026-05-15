# 스테이지 미리보기 & 본게임 화면 설계

## 범위

기존 stub 상태인 `GameScreen.tsx`를 실제 게임 화면으로 구현한다.
두 개의 서브 화면(미리보기, 본게임)과 공통 컴포넌트(헤더, 키보드 매핑)로 구성된다.

---

## 화면 상태 흐름

```
PREVIEW  →  (리듬 큐 1회 자동 재생 완료)  →  PLAYING
                                                  ↓
                                          게이지 0 → 다음 스테이지로 (PREVIEW)
                                          15스테이지 완료 → RESULT
```

게임 오버(게이지 = 0)는 현재 스펙 외. RESULT 화면은 별도 이슈로 분리.

---

## 컴포넌트 구조

```
GameScreen                      (상태 관리: 스테이지, 게임 상태, 점수, 게이지)
├── GameHeader                  (공통 상단 바)
├── PreviewStage                (미리보기 서브 화면)
│   └── RhythmQueue             (음절 카드 배열 + BPM 강조 애니메이션)
├── PlayStage                   (본게임 서브 화면)
│   ├── NoteTrack               (노트 오른쪽 → 왼쪽 이동 + 판정선)
│   └── JudgmentDisplay         (PERFECT/GOOD/MISS 텍스트 + N combo)
└── KeyboardDisplay             (하단 8키 매핑, 두 화면 공통)
```

---

## 데이터 소스

`docs/rhythm_stages_001_015.json` → `public/` 에 복사 후 `fetch`로 로드.

Stage 객체 타입:
```ts
interface StageData {
  stage: number
  difficultyLevel: number
  bpm: number
  word: string
  validSyllables: string[]
  invalidSyllables: string[]
  inputLength: number
  inputSyllables: string[]  // 리듬 큐 (본게임 노트 순서)
  keyMapping: { key: string; syllable: string; type: 'valid' | 'invalid' }[]
}
```

---

## 타이밍 상수

```ts
const BEAT_MS = 60_000 / bpm          // BPM → ms per beat
const NOTE_TRAVEL_BEATS = 4           // 노트가 오른쪽 끝 → 판정선까지 4 beat
const PERFECT_WINDOW_MS = 70
const GOOD_WINDOW_MS = 140
```

---

## GameHeader

| 영역 | 내용 |
|------|------|
| 좌측 | Stage N |
| 중앙 | 이번 단어: [커][피] (validSyllables 카드) |
| 우측 | 게이지 바 (시각적 bar) + Score: NNNN |

- 게이지와 Score는 스테이지 넘어가도 유지 (GameScreen state)
- 게이지 bar: `gauge / 100` 비율로 너비 조정, 색상은 `primary`

---

## PreviewStage (미리보기)

### 레이아웃

```
[상단] GameHeader
[중간] 리듬 큐: [커][커][커][커][피][피]  ← BPM 박자에 맞춰 순서대로 강조
[하단] KeyboardDisplay
```

### 동작

1. 화면 진입 즉시 BPM 타이머 시작
2. `inputSyllables` 배열을 1 beat 간격으로 인덱스 0→끝까지 강조 (border/glow 효과)
3. 현재 강조 음절에 매핑된 키보드 키도 동시에 강조
4. 마지막 음절 강조 완료 후 `onPreviewEnd()` 호출 → `PLAYING` 전환

---

## PlayStage (본게임)

### 레이아웃

```
[상단] GameHeader
[중간] 판정선 (좌측 고정 세로선) | 노트 오른쪽→왼쪽 이동 | PERFECT/N combo 텍스트
[하단] KeyboardDisplay
```

### 노트 이동

- 각 노트는 `inputSyllables[i]` 음절 카드
- 스폰 위치: 화면 오른쪽 끝
- 도착 위치: 판정선
- 이동 시간: `NOTE_TRAVEL_BEATS * BEAT_MS`
- CSS `transform: translateX` + `transition` 으로 구현 (또는 requestAnimationFrame)

### 노트 스폰 타이밍

```
노트 i의 판정 시각 = startTime + i * BEAT_MS
노트 i의 스폰 시각 = 판정 시각 - NOTE_TRAVEL_BEATS * BEAT_MS
```

→ 게임 시작 직후 처음 4개는 이미 화면 밖에서 이동 중인 상태로 시작.

### 판정 처리

키 입력 시:
1. `event.code` → `keyMapping` 에서 syllable 조회
2. 현재 판정 대상 노트(`pendingIndex`)의 syllable과 비교
3. 타이밍 차이 = `|입력시각 - 노트 판정시각|`

| 조건 | 판정 |
|------|------|
| syllable 일치 + 타이밍 ≤ 70ms | PERFECT |
| syllable 일치 + 타이밍 ≤ 140ms | GOOD |
| syllable 불일치 또는 타이밍 초과 | MISS |

MISS는 노트가 판정선을 `GOOD_WINDOW_MS` 초과해서 지나갔을 때도 자동 발생.

### 판정 결과 적용

```ts
// PERFECT (콤보 < 5)
gauge = min(gauge + 1, 100)
score += 100
perfectCombo += 1

// PERFECT (콤보 ≥ 5)
gauge = min(gauge + 2, 100)
score += 200
perfectCombo += 1

// GOOD
score += 50
perfectCombo = 0

// MISS
gauge = max(gauge - 15, 0)
perfectCombo = 0
```

게이지 0 → `RESULT` 상태로 전환 (이번 이슈 범위에서는 시작화면으로 복귀로 대체).
`inputSyllables` 전체 처리 완료 → 다음 스테이지 PREVIEW로 전환 (15스테이지 완료 시 RESULT).

### JudgmentDisplay

- 판정 직후 PERFECT / GOOD / MISS 텍스트 0.6초 표시 후 fade out
- `{N} combo` 텍스트: perfectCombo ≥ 2일 때 표시

---

## KeyboardDisplay

```
[커/A] [쿠/S] [카/D] [피/F]    [푸/J] [퍼/K] [파/L] [포/;]
```

- `keyMapping` 배열에서 순서대로 렌더링
- 미리보기: 현재 강조 음절에 해당하는 키 border highlight
- 본게임: 사용자가 해당 키 누를 때 pressed 효과

---

## 타입 추가 (`src/types/index.ts`)

```ts
export type GamePhase = 'preview' | 'playing' | 'result'

export interface JudgmentResult {
  type: 'PERFECT' | 'GOOD' | 'MISS'
  timestamp: number
}

export interface GameStat {
  score: number
  gauge: number
  perfectCombo: number
  perfectCount: number
  goodCount: number
  missCount: number
}
```

---

## 파일 목록

| 파일 | 역할 |
|------|------|
| `src/components/GameScreen.tsx` | 기존 stub → 상태 관리 컨테이너로 교체 |
| `src/components/game/GameHeader.tsx` | 공통 상단 바 |
| `src/components/game/PreviewStage.tsx` | 미리보기 화면 |
| `src/components/game/PlayStage.tsx` | 본게임 화면 |
| `src/components/game/NoteTrack.tsx` | 노트 이동 트랙 |
| `src/components/game/JudgmentDisplay.tsx` | 판정 결과 표시 |
| `src/components/game/KeyboardDisplay.tsx` | 하단 키보드 매핑 |
| `src/types/index.ts` | 타입 추가 |
| `public/rhythm_stages_001_015.json` | 스테이지 데이터 (복사) |

---

## 제외 범위 (별도 이슈)

- RESULT(결과) 화면
- localStorage 최고 기록 저장
- 15스테이지 ALL CLEAR 처리
