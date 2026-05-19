# 명예의 전당 (Hall of Fame) — 설계 스펙

**날짜:** 2026-05-19  
**상태:** 승인됨

---

## 개요

랭킹 화면에 "명예의 전당" 탭을 추가한다. 역대 1위 경험자를 CSS 픽셀아트 동상으로 표현하고, 재위 기간·스탯·한마디를 표시한다. 1등 달성 시 알림 모달이 뜨며 한마디를 입력할 수 있다.

---

## DB 변경

### 신규 테이블: `hall_of_fame`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL PK | |
| `nickname` | VARCHAR(50) | 1위 닉네임 |
| `score` | INTEGER | 달성 점수 |
| `started_at` | TIMESTAMP | 1위 달성 일시 |
| `ended_at` | TIMESTAMP NULL | 1위 종료 일시 (NULL = 현재 1위) |
| `motto` | VARCHAR(100) NULL | 본인 한마디 |

- `ended_at IS NULL` 레코드가 현재 챔피언. 항상 최대 1개.
- 새 챔피언 등극 시: 기존 레코드 `ended_at` 업데이트 → 새 레코드 INSERT.

### `players` 테이블 컬럼 추가

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `is_hall_of_famer` | BOOLEAN DEFAULT FALSE | 1위 경험 여부 |
| `motto` | VARCHAR(100) NULL | 한마디 (hall_of_fame 테이블과 동기화) |

### 초기 데이터 마이그레이션

- 서버 배포 시점 기준 현재 DB 1위 플레이어 1명을 `hall_of_fame`에 삽입 (`started_at = NOW()`, `ended_at = NULL`).
- `is_hall_of_famer = TRUE` 업데이트.

---

## 백엔드

### 1위 교체 트리거 (`save_game_result` 내부)

```
새 점수가 전체 1위(= 현재 best_score 최댓값 초과) 이면:
  1. hall_of_fame WHERE ended_at IS NULL → ended_at = NOW() 업데이트
  2. hall_of_fame INSERT (nickname, score, started_at=NOW(), ended_at=NULL)
  3. players SET is_hall_of_famer = TRUE WHERE nickname = 닉네임
```

`save_game_result` 응답에 `is_new_champion: bool` 필드 추가.

### 신규 API

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/hall-of-fame` | 불필요 | 전체 목록 (현 1위 + 역대, `ended_at IS NULL` 먼저) |
| PATCH | `/hall-of-fame/motto` | Bearer 필수 | 한마디 수정 (`is_hall_of_famer` 검증) |

**GET `/hall-of-fame` 응답:**
```json
[
  {
    "nickname": "SUHCHAN",
    "score": 99840,
    "started_at": "2026-03-31T12:00:00",
    "ended_at": null,
    "motto": "리듬은 마음으로 타는 거야",
    "days": 48
  },
  ...
]
```
`days` = `ended_at - started_at` (현재 1위는 `NOW() - started_at`), 서버에서 계산.

**PATCH `/hall-of-fame/motto` 요청:**
```json
{ "motto": "한마디 텍스트" }
```
- 인증된 플레이어가 `is_hall_of_famer = FALSE`이면 403.
- `hall_of_fame` 테이블에서 해당 닉네임의 **가장 최근** 레코드 `motto` 업데이트.
- `players.motto`도 동기화.

---

## 프론트엔드

### 1. `RankingScreen` 탭 추가

```
[ RANKING ] [ HALL OF FAME ]
```

탭 상태(`activeTab: 'ranking' | 'hall'`)로 컴포넌트 전환.

### 2. `HallOfFameScreen` 컴포넌트 (신규)

**레이아웃 (위 → 아래):**

1. `👑 CURRENT CHAMPION` 레이블
2. CSS 픽셀아트 동상 (부유 애니메이션 + 반짝이 파티클)
3. 챔피언 닉네임 (보라/핑크 글로우)
4. 재위 기간 (`1위 달성 후 N일째`)
5. 스탯 뱃지 (점수·스테이지·콤보·플레이수)
6. 한마디 박스 (없으면 `"-"`)
7. 구분선
8. `HALL OF FAME RECORD` — 역대 목록 (닉네임·재위일수·한마디)

**픽셀아트 동상:**
- CSS `box-shadow` grid 방식 (11×20 셀, 셀 크기 10px)
- 색상: 보라/핑크 계열 갑옷 + 황금 왕관 + 피부색 얼굴
- 애니메이션: 상하 부유 (`translateY` 3s loop) + 주변 sparkle 파티클

### 3. 1등 달성 알림 모달

`GameScreen`에서 `save_game_result` 응답에 `is_new_champion: true` 포함 시 표시.

**모달 내용:**
- "🏆 명예의 전당에 등록되었습니다!" 메시지
- 한마디 입력 textarea (선택사항, 스킵 가능)
- [등록하기] / [나중에] 버튼

[등록하기] 클릭 시 `PATCH /hall-of-fame/motto` 호출 (세션 토큰 사용).

### 4. 서비스 레이어

`src/services/playerService.ts`에 추가:
```ts
getHallOfFame(): Promise<HallOfFameEntry[]>
updateMotto(motto: string, token: string): Promise<void>
```

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| `hall_of_fame` 데이터 없음 | "아직 챔피언이 없습니다" 안내 문구 |
| motto 수정 권한 없음 (403) | "1위 경험자만 한마디를 남길 수 있습니다" 토스트 |
| 네트워크 오류 | 기존 랭킹과 동일한 스피너 → 오류 문구 처리 |

---

## 범위 외 (이번 구현 제외)

- 댓글/방명록 (다른 플레이어가 챔피언에게 댓글) → 추후 확장
- 닉네임별 동상 색상 커스터마이징
- 2·3위 포디움 표시
