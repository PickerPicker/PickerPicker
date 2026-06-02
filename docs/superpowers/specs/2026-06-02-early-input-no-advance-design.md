# 조기 입력 시 pendingIndex advance 차단 설계

**날짜:** 2026-06-02
**상태:** 검토중
**관련 이슈:** [#131](https://github.com/PickerPicker/PickerPicker/issues/131)

---

## 개요

`PlayStage` / `PracticePlayStage` 키 핸들러가 GOOD_WINDOW(±250ms) 밖 입력에도 `pendingIndex`를 advance시켜 화면상 note와 판정 대상 note가 어긋나는 문제를 수정한다.

**Stepmania/BMS 표준**을 따라 signed delta 기준 비대칭 처리:

- **도착 전 (signed delta < -GOOD_WINDOW)**: EarlyMiss — MISS 사운드 + 게이지 감소, `pendingIndex` 유지. note 살아있음.
- **GOOD_WINDOW 안**: 현재처럼 PERFECT/GOOD/MISS 판정 + advance.
- **도착 후 (signed delta > +GOOD_WINDOW)**: 키 입력 무시. 곧 interval이 자동 MISS 처리 → advance.

---

## 현재 동작 (버그)

`src/components/game/PlayStage.tsx` 라인 176~205:

```ts
const arrivalTime = startTimeRef.current + idx * beatMs + offset + totalPausedRef.current
const delta = Math.abs(Date.now() - arrivalTime)

if (km.syllable !== expectedSyllable) {
  applyJudgment('MISS')
} else if (delta <= PERFECT_WINDOW) {
  applyJudgment('PERFECT')
} else if (delta <= GOOD_WINDOW) {
  applyJudgment('GOOD')
} else {
  applyJudgment('MISS')   // ← 도착 전/후 GOOD_WINDOW 밖 입력도 advance 발생
}
```

`applyJudgment` (라인 89~132) 마지막에 `advancePending()` 무조건 호출 → 어떤 입력이든 `pendingIndex` +1.

### 불일치 시나리오

1. note A 등장, 사용자가 도착 전(delta > GOOD_WINDOW)에 키 누름
2. `applyJudgment('MISS')` 실행 → `advancePending()` 호출 → `pendingIndex` = 1 (B 대상)
3. 화면에서는 A가 여전히 흘러가고 있음
4. 사용자가 A 도착 시점에 다시 키 누름 → 시스템은 B를 평가 → 시각·판정 불일치

---

## 변경 내용

### 1. 키 핸들러 분기 추가 — `PlayStage.tsx`

`delta`의 절댓값이 아닌 **부호 있는 delta**로 도착 전/후 구분.

```ts
const arrivalTime = startTimeRef.current + idx * beatMs + offset + totalPausedRef.current
const signedDelta = Date.now() - arrivalTime   // 음수: 도착 전, 양수: 도착 후
const absDelta = Math.abs(signedDelta)

if (km.syllable !== expectedSyllable) {
  // 키 자체가 잘못 → 현재 동작 유지 (advance)
  applyJudgment('MISS')
} else if (absDelta <= PERFECT_WINDOW) {
  applyJudgment('PERFECT')
} else if (absDelta <= GOOD_WINDOW) {
  applyJudgment('GOOD')
} else if (signedDelta < 0) {
  // 도착 전 GOOD_WINDOW 밖 → 조기 입력
  applyEarlyMiss()   // advance 없는 MISS, note 살아있음
}
// signedDelta > 0 (도착 후 GOOD_WINDOW 밖): 무시. interval이 곧 자동 MISS 처리.
```

### 2. 신규 함수 `applyEarlyMiss()` 추가 — `PlayStage.tsx`

기존 `applyJudgment('MISS')`에서 `advancePending()` 호출만 빼고, MISS 통계는 별도 집계하지 않는 형태:

```ts
const applyEarlyMiss = useCallback(() => {
  if (gameOverRef.current) return
  onMissSfxRef.current()
  judgeCountRef.current += 1
  setLastJudgment({ type: 'MISS', id: judgeCountRef.current })

  const current = statRef.current
  const newGauge = Math.max(0, current.gauge - 15)
  const newStat: GameStat = {
    ...current,
    gauge: newGauge,
    perfectCombo: 0,
  }
  statRef.current = newStat
  setPerfectCombo(0)
  onStatUpdateRef.current(newStat)

  if (!practiceMode && newGauge <= 0) {
    gameOverRef.current = true
    onGameOverRef.current()
  }
  // advancePending 호출 안 함 — 같은 note 다시 노릴 수 있음
}, [practiceMode])
```

**핵심 차이점**:
- `missCount` 증가시키지 않음 (note는 아직 평가되지 않음 — 통계 보존)
- `pendingIndex` 그대로
- 게이지/콤보 패널티는 적용 (마구잡이 키 입력 방지)
- 게이지 0 도달 시 게임 오버는 정상 처리

### 3. PracticePlayStage 동일 처리

연습 모드는 게이지/게임오버 처리 없음. `applyEarlyMiss()` 단순화:

```ts
const applyEarlyMiss = useCallback(() => {
  onMissSfxRef.current()
  judgeCountRef.current += 1
  setLastJudgment({ type: 'MISS', id: judgeCountRef.current })

  const current = statRef.current
  const newStat: GameStat = { ...current, perfectCombo: 0 }
  statRef.current = newStat
  setPerfectCombo(0)
  onStatUpdateRef.current(newStat)
}, [])
```

콤보만 리셋. `missCount`/`pendingIndex` 변동 없음.

### 4. TutorialStage — 변경 없음

`TutorialStage`는 spawn 기반 풀에서 best-note 탐색 방식 (라인 184~194):

```ts
notesRef.current.forEach(n => {
  if (n.hit) return
  const delta = Math.abs(now - n.arrivalTime)
  if (delta < bestDelta && delta < GOOD_WINDOW * 1.5) {
    best = n
    bestDelta = delta
  }
})
```

`GOOD_WINDOW * 1.5` 이내만 best로 선택, MISS 시 `note.hit = true` 처리해 해당 note를 비활성화한다. pendingIndex 순차 advance 구조가 아니므로 본 이슈와 무관.

---

## 판정 매트릭스

| 키 정확성 | signed delta | 현재 동작 | 변경 후 |
|----------|-------------|----------|---------|
| 잘못된 키 | 어디든 | MISS + advance | MISS + advance (동일) |
| 올바른 키 | `|delta| ≤ PERFECT_WINDOW` (40ms) | PERFECT + advance | PERFECT + advance (동일) |
| 올바른 키 | `|delta| ≤ GOOD_WINDOW` (100ms) | GOOD + advance | GOOD + advance (동일) |
| 올바른 키 | `delta < -GOOD_WINDOW` (도착 전) | MISS + advance | **EarlyMiss (사운드+게이지만, advance 안 함)** |
| 올바른 키 | `delta > +GOOD_WINDOW` (도착 후) | MISS + advance | **무시** (interval이 곧 자동 MISS 처리) |
| 도착 후 자동 (interval) | `delta > +GOOD_WINDOW` | MISS + advance | MISS + advance (동일) |

> 도착 후 GOOD_WINDOW 밖 키 입력은 무시. 어차피 16ms 후 interval이 자동 MISS + advance 처리. 중복 처리하면 같은 note에 MISS 사운드 2번 울리는 어색함 방지.

> 자동 MISS (interval에서 호출되는 `applyJudgment('MISS')`)는 변경 없음. note가 화면에서 사라지는 시점이 advance 발생 시점이라 자연스러움.

---

## 게이지 패널티 비교

| 케이스 | 게이지 변화 | 콤보 | missCount |
|--------|------------|------|-----------|
| 자동 MISS (도착 후 시간 경과) | -15 | 0 | +1 |
| 조기 MISS (도착 전 잘못 침) | -15 | 0 | **+0** |
| 잘못된 키 입력 | -15 | 0 | +1 |

조기 MISS는 `missCount` 증가 안 시킴. note 자체는 아직 평가되지 않았기 때문 — 도착 시점에 정타하면 PERFECT/GOOD로 카운트, 자동 MISS 되면 그때 +1.

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/components/game/PlayStage.tsx` | `applyEarlyMiss` 추가, 키 핸들러 분기 수정 |
| `src/components/practice/PracticePlayStage.tsx` | 동일 (게이지/게임오버 없는 버전) |

---

## 검증 시나리오

1. **조기 입력 후 정상 타격**: note 등장 직후 키 → 사운드만 MISS + 게이지 -15. note는 화면에 살아있음. 도착 시점에 다시 키 → PERFECT/GOOD 정상 판정.
2. **연속 조기 입력**: 같은 note에 대해 도착 전 10회 키 입력 → 게이지 0 도달 시 게임 오버. `pendingIndex`는 0 그대로.
3. **잘못된 키**: 다른 키 누름 → 현재대로 MISS + advance (기존 동작).
4. **도착 후 GOOD 밖 키 입력**: note 지나간 후 키 누름 → 무시. 곧 interval이 자동 MISS + advance 처리. MISS 사운드 한 번만.
5. **도착 후 자동 MISS**: 키 안 누르고 GOOD_WINDOW 지남 → 자동 MISS + advance (기존 동작).
6. **연습 모드**: 조기 입력 시 콤보만 리셋, missCount 변동 없음, 게이지 변화 없음.
