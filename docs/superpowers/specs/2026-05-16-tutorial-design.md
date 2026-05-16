# 신규 유저 가이드 (튜토리얼) 설계

작성일: 2026-05-16

## 배경 / 문제

PickerPicker는 처음 보는 사용자에게 다음 정보가 한 화면에 없음:

- 8키 (`A S D F` / `J K L ;`) 매핑 개념
- 노트가 오른쪽 → 왼쪽으로 흘러오며 판정선에서 입력해야 한다는 점
- PERFECT / GOOD / MISS 판정 시스템
- 생존 게이지가 0이 되면 게임 오버

해커톤 게임 특성상 첫 진입 유저 비중이 크다. 인터랙티브 튜토리얼이 필요.

## 목표

- 첫 로그인 시 1회 자동 노출
- 시작화면에서 언제든 다시 볼 수 있음
- 본 게임 화면과 동일한 UI로 학습 → 본 게임 진입 시 인지 마찰 최소화
- 키보드만으로 진행 (마우스 불필요)

## 비목표

- 모든 스테이지/난이도 설명 (5콤보 보상, 길이별 게이지 조정 등은 본 게임에서 자연 학습)
- 사운드 옵션 / 오프셋 / 닉네임 / PIN 관련 설명 (시작화면에 별도 메뉴 존재)

## 화면 흐름

```
시작화면 (StartScreen home)
  ↓ [신규 로그인 + localStorage flag 없음]
  → 튜토리얼 자동 진입
  ↓
시작화면 (StartScreen home) ← [게임 방법] 버튼
  ↓ 클릭
  → 튜토리얼 진입
  ↓
튜토리얼 (STEP 1 → 2 → 3 → 4)
  ↓
시작화면 복귀 (또는 자동 진행 시 본 게임 진입)
```

자동 노출 1회는 localStorage `pickerpicker_tutorial_seen = 'true'` 플래그로 관리.

## STEP 구성

| STEP | 목적 | 사용 키 | 노트 | 클리어 조건 |
|------|------|---------|------|-------------|
| 1 / 4 | 1키 입력 익힘 | A | "커" 무한 반복 (BPM 90) | PERFECT/GOOD 4회 |
| 2 / 4 | 2키 교대 | A, S | "커" / "피" 교대 무한 반복 | PERFECT/GOOD 4회 |
| 3 / 4 | MISS · 게이지 | A(정답), D(오답) | "커" 노트는 시연용 1개 | D 키 1회 입력 |
| 4 / 4 | READY 카운트다운 | - | - | 3초 자동 진행 또는 SPACE/→ 즉시 |

### STEP별 동작 차이

- **STEP 1~2**: 게이지 미차감 (튜토리얼). 노트가 판정선을 지나가도 화면에 MISS 표시만 하고 게이지 변동 없음.
- **STEP 3**: 게이지 차감 ON. D 키(invalid) 누르면 MISS + 게이지 -15. 시각적으로 "이게 GAME OVER로 가는 길이다" 보여줌.
- **STEP 4**: 게임 진입 카운트다운 화면.

### 진입 조작

- `A` ~ `;`: 게임 키 입력
- `Space` / `→`: 다음 STEP (클리어 후 활성)
- `←`: 이전 STEP
- `ESC`: 건너뛰기 → STEP 4 즉시 점프

## 컴포넌트 구조

본 게임 컴포넌트 재사용 어려움 사유:

- `PlayStage`는 `stageData` 고정 길이로 `inputSyllables` 처리 + 자동 MISS/게이지 패널티 내장
- 튜토리얼은 무한 노트 spawn + 게이지 미차감 + N회 PERFECT 시 step 클리어 콜백 필요

→ `TutorialStage`를 별도 작성. 다음 작은 컴포넌트는 재사용:

- `KeyboardDisplay` (8키 표시)
- `JudgmentDisplay` (PERFECT/GOOD/MISS 라벨)
- `GameHeader`의 게이지 바 표현 (필요 시 별도 미니 헤더로 단순화)

### 파일 트리

```
src/
  components/
    tutorial/
      TutorialScreen.tsx    # 4 STEP 컨테이너 + 글로벌 키 핸들링 (SPACE/←/ESC)
      TutorialBanner.tsx    # 상단 파란 오버레이 (STEP 라벨 + 메시지 + 진행도)
      TutorialStage.tsx     # 노트 트랙 + 키보드 + 판정 처리
      tutorialSteps.ts      # STEP 정의 상수
  App.tsx                   # 'tutorial' 화면 상태 + flag 관리
  types/index.ts            # Screen 타입에 'tutorial' 추가
```

### TutorialScreen 책임

- 현재 STEP 인덱스 관리
- 글로벌 키 (Space / 화살표 / ESC) 처리
- STEP 4에서 카운트다운 → `onComplete()` 콜백 호출
- 각 STEP에 맞는 TutorialStage 인스턴스 마운트

### TutorialStage 책임

- 노트 spawn 루프 (BPM 기반)
- 노트 위치 애니메이션 (right → judgment line)
- 키 입력 판정 (PERFECT/GOOD/MISS)
- STEP 목표 도달 시 `onStepCleared()` 호출
- 게이지 차감 ON/OFF (`gaugeLoss` prop)

### tutorialSteps.ts 데이터

```ts
export interface TutorialStep {
  id: 1 | 2 | 3 | 4
  label: string                // 'STEP 1 / 4'
  message: string              // 안내 메시지
  hintKeys: string[]           // 깜빡이는 키 (예: ['a'])
  word: string                 // 단어 표시
  validSyllables: string[]
  noteLoop: string[]           // 반복할 음절 시퀀스
  keyMapping: KeyMapping[]     // 8키 매핑
  target: number               // 클리어 조건 수치
  gaugeLoss: boolean           // 게이지 차감 여부
  missMode: boolean            // D 키 시연 모드
  isReady?: boolean            // STEP 4 카운트다운 전용
  countdownSec?: number        // 카운트다운 초
}
```

## App.tsx 흐름 변경

```ts
type Screen = 'start' | 'tutorial' | 'game' | 'ranking'

const LS_TUTORIAL_KEY = 'pickerpicker_tutorial_seen'

// 신규 로그인 후 흐름
handlePinSuccess() {
  ...
  localStorage.setItem(LS_NICKNAME_KEY, nickname)
  if (!localStorage.getItem(LS_TUTORIAL_KEY)) {
    setCurrentScreen('tutorial')
    setAfterTutorial('game')  // 튜토리얼 종료 후 게임으로
  } else {
    setCurrentScreen('game')
  }
}

// 시작화면 [게임 방법] 버튼
onTutorial() {
  setAfterTutorial('start')  // 튜토리얼 종료 후 시작화면 복귀
  setCurrentScreen('tutorial')
}

// 튜토리얼 종료
handleTutorialComplete() {
  localStorage.setItem(LS_TUTORIAL_KEY, 'true')
  setCurrentScreen(afterTutorial)
}
```

## StartScreen 변경

home view 버튼 순서:

```
[플레이하기 / 시작]    ← 기존
[게임 방법]            ← 신규
[랭킹]
[설정]
[크레딧]
[로그아웃]             ← 로그인 시
```

## 게이지/판정 로직

본 게임과 동일한 상수 사용 (`PERFECT_WINDOW=40ms`, `GOOD_WINDOW=100ms` — 단 본 게임은 PlayStage 내부에 다른 값이 있을 수 있으므로 PlayStage 상수 직접 참조 가능하면 import, 어렵다면 동일 값 복제).

게이지 -15 (MISS), +1 (PERFECT), +2 (5콤보 PERFECT)는 본 게임 규칙 그대로. 튜토리얼 STEP 3에서만 MISS 패널티 적용.

## 미해결 / 후속

- STEP 3 게이지가 0 가까이 갈 가능성 거의 없지만 (D 1회만 받음), 만약 사용자가 여러 번 누르면 GAME OVER 트리거 → 튜토리얼 내에서는 GAME OVER 화면 띄우지 않고 게이지만 시각적으로 보여줌 (실제로는 -15만 1회 적용 후 잠금)
- 모바일/터치 인터페이스 미지원 (본 게임도 키보드 전용이므로 동일)

## 검증 방법

- 신규 닉네임으로 가입 → 튜토리얼 자동 노출 확인
- 같은 닉네임으로 재로그인 → 튜토리얼 미노출 확인
- 시작화면 [게임 방법] 버튼 클릭 → 튜토리얼 노출
- 각 STEP A/S/D 키 동작 확인
- ESC → STEP 4 점프
- 카운트다운 종료 후 본 게임 또는 시작화면 복귀

## 변경 영향 파일

- `src/App.tsx`
- `src/components/StartScreen.tsx`
- `src/types/index.ts`
- `src/components/tutorial/` (신규 디렉토리)
