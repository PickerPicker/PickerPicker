# 게임 화면 playCount가 DB 값이 아닌 로컬 실행 횟수로 표시되는 문제

## 개요

게임오버 화면의 플레이 횟수가 DB에 저장된 누적 플레이 횟수가 아닌 localStorage 기반 로컬 카운터로 표시되던 문제와, 랭킹 화면에 플레이 횟수 컬럼 자체가 없던 문제를 동시에 수정했다. 백엔드는 정상 동작 중이었고 프론트엔드에서 서버 응답을 무시하는 단방향 버그였다.

## 원인 분석

| 레이어 | 상태 |
|--------|------|
| 백엔드 DB `play_count += 1` | ✅ 정상 |
| 백엔드 `/players/result` 응답에 `play_count` 포함 | ✅ 정상 |
| 백엔드 `/ranking` 응답에 `play_count` 포함 | ✅ 정상 |
| FE `saveGameResult` 응답 처리 (`.catch`만 있고 `.then` 없음) | ❌ 버그 |
| FE 게임오버 화면 — 로컬 `best.playCount` 렌더 | ❌ 버그 |
| FE 랭킹 테이블 — `play_count` 컬럼 누락 | ❌ 버그 |

**결론**: 프론트엔드 단독 버그. 백엔드 / DB 변경 불필요.

## 변경 사항

### 타입 정의
- `src/types/index.ts`: `BestRecord` 인터페이스에서 `playCount` 필드 제거. 서버를 진실 소스로 단일화

### 게임 화면
- `src/components/GameScreen.tsx`:
  - 로컬 `playCount: prev.playCount + 1` 증가 로직 제거
  - `serverPlayCount` 상태 추가
  - `saveGameResult` 응답의 `play_count`를 받아 화면에 표시
  - `handleRestart` 시 `serverPlayCount` 초기화
  - 서버 응답 도착 전 `...` placeholder 표시

### 랭킹 화면
- `src/components/RankingScreen.tsx`: thead/tbody에 "플레이" 컬럼 추가, `entry.play_count` 회 단위로 렌더

## 주요 구현 내용

게임 종료 시점에 `saveGameResult` API를 호출하면 백엔드가 갱신된 `play_count`를 응답으로 반환한다. 기존 코드는 이 응답을 `.catch(() => {})` 로 버리고 있어, 화면에는 localStorage에 누적된 로컬 실행 횟수만 표시되고 있었다.

수정 후에는 응답의 `play_count` 값을 `serverPlayCount` 상태로 저장하여 게임오버 화면에 표시한다. 같은 닉네임으로 다른 브라우저/기기에서 플레이한 횟수도 정확히 반영된다.

랭킹 화면도 백엔드 응답에는 `play_count`가 포함되어 있었으나 테이블에서 렌더하지 않고 있었다. 컬럼 헤더와 셀을 추가하여 표시한다.

## 주의사항

- DB 스키마 변경 없음. 마이그레이션 불필요
- localStorage는 점수/스테이지/콤보 등 오프라인 캐시 용도로만 유지
- 서버 응답 실패 시 `...` 가 계속 표시될 수 있음 → 향후 재시도 로직 또는 명시적 에러 표시 검토

## 배포

- 커밋: `ed5586c`
- Deploy PR: #60
- 배포 흐름: main → deploy PR → AUTO-CHANGELOG-CONTROL → 시놀로지 자동 배포

Closes #40
