# 튜토리얼 개선 설계 — 2026-05-24

## 배경 및 문제

PickerPicker 게임의 핵심 메카닉:
- 8개 키(a s d f j k l ;)에 음절이 매핑됨
- **valid 음절** 노트가 오면 해당 키를 눌러야 함
- **invalid 음절** 노트가 오면 아무 키도 누르지 않고 통과시켜야 함

현재 튜토리얼 문제:
- invalid 음절 노트가 화면을 가로질러 날아오는 상황을 **한 번도 보여주지 않음**
- "틀린 키를 누르면 MISS"만 가르치고, "날아오는 노트를 흘려보내야 한다"는 개념 없음
- 사용자가 `쿠`, `퍼` 등 invalid 노트가 오면 눌러야 하는지 몰라 혼란

## 튜토리얼 단어

**"피커"** 사용

| 키 | 음절 | 타입 |
|----|------|------|
| a | 피 | valid |
| s | 커 | valid |
| d | 비 | invalid |
| f | 코 | invalid |
| j | 프 | invalid |
| k | 퍼 | invalid |
| l | 키 | invalid |
| ; | 포 | invalid |

## STEP 구조 (5 STEP)

### STEP 1/5 — 기초 타격
- **목표**: 키 매핑 개념 이해 + 첫 타격 경험
- **메시지**: `A 키 = "피" 입니다. "피" 노트가 오면 A를 누르세요`
- noteLoop: `['피']`
- 유효 키: `a=피(valid)`, 나머지 `-`(invalid)
- target: 4, gaugeLoss: false, missMode: false
- 키보드 UI: `a`만 강조

### STEP 2/5 — 두 키 교대
- **목표**: valid 두 키 패턴 습득
- **메시지**: `A = "피", S = "커". 교대로 누르세요`
- noteLoop: `['피', '커']`
- 유효 키: `a=피(valid)`, `s=커(valid)`, 나머지 `-`(invalid)
- target: 4, gaugeLoss: false, missMode: false
- 키보드 UI: `a`, `s` 둘 다 강조

### STEP 3/5 — 흘려보내기 연습 (패널티 없음) ★신규★
- **목표**: invalid 노트가 오면 통과시킨다는 개념 체득
- **메시지**: `"비", "코" 같은 노트는 내 꺼가 아닙니다. 누르지 말고 흘려보내세요`
- noteLoop: `['피', '커', '비', '피', '커', '코']`
- 유효 키: `a=피(valid)`, `s=커(valid)`, `d=비(invalid)`, `f=코(invalid)`, 나머지 `-`
- **핵심**: invalid 노트가 통과해도 MISS 없음 — 패널티 없이 경험만
- **노트 색상**: invalid 노트는 빨강/주황 계열로 시각 구분 (`warnInvalidNotes: true`)
- target: valid 4회, gaugeLoss: false, missMode: false

### STEP 4/5 — 실전 혼합 (패널티 있음) ★신규★
- **목표**: 흘려보내기 실패 시 결과 체험
- **메시지**: `실전! "비", "코", "퍼" 노트를 누르면 MISS. 침착하게 흘려보내세요`
- noteLoop: `['피', '커', '비', '피', '커', '코', '피', '퍼']`
- 유효 키: `a=피(valid)`, `s=커(valid)`, `d=비(invalid)`, `f=코(invalid)`, `k=퍼(invalid)`, 나머지 `-`
- **핵심 로직**: invalid 노트 접근 중 아무 키나 누르면 → MISS + 게이지 감소
- target: valid 6회, gaugeLoss: true, missMode: false

### STEP 5/5 — READY
- 기존 STEP 4와 동일 (카운트다운 or 시작 화면 복귀)

## 구현 변경 포인트

### 1. `tutorialSteps.ts`
- `TutorialStep` 타입에 `warnInvalidNotes?: boolean` 필드 추가
- STEP 1~5 새로 정의 (기존 4 STEP 교체)
- STEP id: 1~5, label: `STEP 1/5` ~ `STEP 5/5`

### 2. `TutorialStage.tsx` — 노트 색상 구분
- `NoteView`에 `isInvalid` prop 추가
- invalid 노트: 테두리 `#ff7744` (주황-빨강), glow 없음 또는 붉은 glow
- valid 노트: 기존 파란 `#00b4ff` 유지
- `step.warnInvalidNotes` true일 때만 색상 분리 적용 (STEP 1~2는 구분 불필요)

### 3. `TutorialStage.tsx` — STEP 4 MISS 판정 로직
현재 키 입력 로직:
```
km.type !== 'valid' || km.syllable !== noteSyllable → MISS
```
STEP 4 추가 조건: **invalid 노트가 판정선 근처에 있을 때 아무 키나 누르면 MISS**

구체적으로:
- 가장 가까운 노트 `best`가 invalid 타입이고 delta < GOOD_WINDOW * 1.5 이면
  → 어떤 키를 눌러도 MISS 처리

### 4. `KeyboardDisplay` (변경 없음)
- 기존 `hintKeys` + `hintTone` 로직으로 충분

## 제약 조건
- `noteLoop`에 invalid 음절 포함 → 노트가 실제로 날아와야 함 (spawn 로직 변경 없음)
- invalid 노트 통과 시 조용히 사라지는 현재 동작 유지 (STEP 3 학습에 활용)
- BPM: 기존 `TUTORIAL_BPM = 90` 유지

## 성공 기준
- 튜토리얼 완료 후 사용자가 스테이지 1에서 `코`, `포`, `키` 노트가 날아올 때 당황하지 않음
- "흘려보내기" 개념을 STEP 3에서 패널티 없이 먼저 경험 → STEP 4에서 실전 적용
