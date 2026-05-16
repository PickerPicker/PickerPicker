# 플레이어 통계 대시보드 + 백엔드 통계 로직 고도화 — 설계 문서

- **이슈**: [#78](https://github.com/PickerPicker/PickerPicker/issues/78)
- **작성일**: 2026-05-16
- **작성자**: SUH SAECHAN
- **상태**: Draft

---

## 1. 배경

현재 `players` 테이블은 `best_score / best_stage / best_combo / play_count` 등 **최고값 누적치**만 저장한다. 개별 플레이 기록(시계열, 평균, 분포)을 보존하지 않아 다음과 같은 사용자 가치를 제공할 수 없다.

- 본인 실력 추세 (7일/30일 평균, 일별 추이)
- 전체 대비 위치 (백분위, 상위 N%)
- 스테이지별 도달률 / 최고점 (다음 목표 설정 단서)
- 행동 패턴 (시간대별 플레이, 세션 간격)

본 작업으로 위 5종 지표를 한 화면(`StatsScreen`)에서 확인할 수 있도록 백엔드 데이터 모델과 API, 프론트엔드 화면을 신설한다.

## 2. 목표 / 비목표

### 목표
- 게임 결과를 세션 단위로 보존하고, 일별 집계 테이블을 갱신해 빠른 통계 조회 제공.
- 본인 통계는 인증(PIN → 세션 토큰)을 거쳐 조회. 전체 통계는 공개.
- 결과 화면과 메인 화면 양쪽에서 통계 진입 가능.
- 30일 보존 정책으로 DB 사이즈 통제. 일별 집계는 영구 보존.

### 비목표
- Redis / 별도 분석 DB(ClickHouse 등) 도입 — PostgreSQL 단일 인스턴스로 처리.
- JWT 표준 채택 — 단순 random UUID 토큰 + DB 검증으로 충분.
- 실시간 푸시 / WebSocket — 폴링 기반.
- 마이그레이션 도구(Alembic) 도입 — 기존 `Base.metadata.create_all` 자동 생성 패턴 유지 (신규 테이블만 추가하므로 충돌 없음).

## 3. 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 범위 | 본인 + 전체 비교 + 분포 |
| 데이터 모델 | 세션 테이블 + 일별 집계 테이블 + 스테이지별 JSONB |
| 보존 기간 | 세션 30일, 일별 집계 영구 |
| 인증 | PIN 검증 → 24h 세션 토큰 |
| 지표 | 기본 집계 / 시계열 / 분포 / 백분위 / 스테이지별 |
| UI 진입 | 결과 화면 버튼 + 메인 전용 버튼 (둘 다) |
| 일별 집계 갱신 | `POST /players/result` 호출 시 트랜잭션 내 UPSERT |
| 전체 집계 계산 | `player_stats_daily` 합산 조회 (5분 인메모리 캐시) |

## 4. 아키텍처

```
[FE GameScreen 종료]
   ↓ POST /players/result (score, stage, combo, stage_scores)
   ↓ (선택) Authorization: Bearer <session_token>
[BE player_router → player_service.save_game_result]
   단일 트랜잭션:
     ├─ INSERT game_sessions (snapshot 1행)
     ├─ UPDATE players (best_* max + play_count++)
     └─ UPSERT player_stats_daily (해당 날짜 합산)
   ↓ commit

[FE StatsScreen 진입]
   ├─ POST /auth/login (nickname + pin)
   │    → session_token (24h)
   ├─ GET  /players/{nickname}/stats   (본인 종합 — 토큰 필수)
   ├─ GET  /stats/global               (전체 — 익명 가능)
   └─ GET  /players/{nickname}/sessions?days=30 (시계열 — 토큰 필수)
[BE stats_router → stats_service]
   ├─ player_stats_daily 합산/평균/percentile_cont
   └─ global 통계는 5분 in-process 캐시
```

## 5. 데이터 모델

신규 테이블 3종. 모두 `backend/src/models/` 추가, `Base.metadata.create_all`로 자동 생성.

### 5.1 `game_sessions`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | `BigInteger`, PK, autoincrement | |
| `nickname` | `String(50)`, index, FK→`players.nickname` (논리적) | |
| `score` | `Integer` | 한 판 총점 |
| `stage` | `Integer` | 도달 최종 스테이지 (1~15+) |
| `combo` | `Integer` | 최대 콤보 |
| `stage_scores` | `JSONB` | `{"1": 1200, "2": 950, ...}` — 스테이지별 점수 |
| `played_at` | `DateTime`, default `now()`, index | 보존 정책 기준 |

- 인덱스: `(nickname, played_at DESC)` 복합 — 최근 N일 조회 최적화.
- `score`, `stage`, `combo`는 `players` 라우터의 상한 검증(`MAX_SCORE/STAGE/COMBO`) 재사용.
- `stage_scores`의 키는 string으로 저장 (JSONB 표준), 검증 시 1~`MAX_STAGE` 범위 정수 키만 허용.

### 5.2 `player_stats_daily`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `nickname` | `String(50)`, PK | 복합 PK 일부 |
| `date` | `Date`, PK | 복합 PK 일부 (UTC 기준 일자) |
| `play_count` | `Integer`, default 0 | |
| `sum_score` | `BigInteger`, default 0 | 평균 계산용 |
| `max_score` | `Integer`, default 0 | |
| `max_stage` | `Integer`, default 0 | |
| `max_combo` | `Integer`, default 0 | |
| `updated_at` | `DateTime`, onupdate `now()` | |

- 인덱스: PK가 `(nickname, date)`로 자동 인덱스 처리. `date` 단독 인덱스 추가 (전체 일별 집계용).
- UPSERT: `INSERT ... ON CONFLICT (nickname, date) DO UPDATE SET ...` (PostgreSQL `insert(...).on_conflict_do_update`).

### 5.3 `player_sessions`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `token` | `String(64)`, PK | `secrets.token_urlsafe(48)` |
| `nickname` | `String(50)`, index | |
| `expires_at` | `DateTime`, index | 24h 후 |
| `created_at` | `DateTime`, default `now()` | |

- 만료된 토큰은 인증 dependency에서 거부 + lazy delete (조회 시 만료 토큰 발견하면 삭제).
- 명시적 startup 클린업 작업도 병행 (`expires_at < now()` 삭제).

### 5.4 `players` 기존 테이블 — 변경 없음

기존 컬럼 그대로. `play_count`, `best_*`는 `save_game_result`에서 계속 갱신.

## 6. 마이그레이션 전략

기존 패턴 (`Base.metadata.create_all`) 그대로 활용. 신규 테이블만 추가되므로 **추가 SQL 스크립트 불필요**. 서버 재시작 시 자동 생성된다.

**예외 케이스**: 만약 `players` 컬럼 추가가 필요해지면 (예: `total_play_time`), 별도 ALTER SQL을 `docs/db/migrations/2026-05-16-add-X.sql`에 기록하고 시놀로지 DB에 수동 적용. 현 설계엔 없음.

**데이터 백필**: 기존 `players.play_count`만 있고 세션 히스토리 없음 → 통계는 신규 세션부터 누적. 기존 사용자는 "최근 플레이 데이터가 쌓이는 중" 안내 (선택).

## 7. API 설계

### 7.1 인증

**POST `/auth/login`**
- Body: `{ "nickname": str, "pin": str(4) }`
- 동작: `player_service.verify_pin` 호출 → 성공 시 토큰 생성 후 `player_sessions` INSERT.
- Response: `{ "token": str, "expires_at": datetime }`
- 실패: 401 (PIN 불일치), 404 (닉네임 없음).

**POST `/auth/logout`** (선택)
- Header: `Authorization: Bearer <token>`
- 토큰 row 삭제 후 204.

**`get_current_player` Dependency** (`core/security.py`)
- `Authorization` 헤더 파싱 → `player_sessions` 조회 → 만료 체크 → 닉네임 반환.
- 실패 시 401.

### 7.2 통계 조회

**GET `/players/{nickname}/stats`** (인증 필수, 본인만)
- 응답:
  ```json
  {
    "nickname": "x",
    "totals": {"play_count": 42, "best_score": 12345, "best_stage": 10, "best_combo": 88},
    "averages": {"avg_score": 8000, "median_score": 7500, "avg_stage": 7.2, "avg_combo": 45},
    "trend": {
      "last_7_days_avg_score": 8500,
      "last_30_days_avg_score": 8100,
      "last_7_days_play_count": 15
    },
    "percentile": {"score": 0.82, "rank_top_pct": 18.0},
    "stage_best": [
      {"stage": 1, "best_score": 1500, "reach_count": 42},
      {"stage": 2, "best_score": 1300, "reach_count": 40},
      ...
    ],
    "habit": {
      "by_hour": [{"hour": 0, "count": 2}, ...],
      "session_gap_minutes": {"avg": 120, "median": 90}
    }
  }
  ```
- 데이터 소스: `player_stats_daily` 합산 + `game_sessions` (시간대, stage_scores).

**GET `/stats/global`** (공개)
- 응답:
  ```json
  {
    "total_players": 42,
    "total_sessions": 3500,
    "avg_score": 7800,
    "median_score": 7500,
    "score_distribution": [{"bucket": "0-1000", "count": 12}, ...]
  }
  ```
- 5분 in-process 캐시 (`functools.lru_cache` + TTL 또는 `cachetools.TTLCache`).
- `nickname == "test"` 또는 비공개 닉네임 제외 (필요 시).

**GET `/players/{nickname}/sessions?days=30`** (인증 필수, 본인만)
- 일별 그룹 응답:
  ```json
  {
    "days": [
      {"date": "2026-05-15", "play_count": 5, "max_score": 9000, "avg_score": 7500},
      ...
    ]
  }
  ```

### 7.3 기존 결과 저장 확장

**POST `/players/result`** (인증 선택)
- Body 확장:
  ```json
  {
    "nickname": "x",
    "score": 8000, "stage": 10, "combo": 50,
    "stage_scores": {"1": 1200, "2": 950, ...}
  }
  ```
- `stage_scores`는 optional (기존 클라이언트 호환). 누락 시 빈 dict.
- 인증 토큰 있으면 `Authorization` 헤더의 닉네임과 body 닉네임 일치 검증. 없으면 기존 동작.

## 8. 서비스 계층

- `services/stats_service.py`
  - `get_player_stats(db, nickname) -> dict`
  - `get_global_stats(db) -> dict` (캐시 적용)
  - `get_player_sessions_by_day(db, nickname, days) -> list[dict]`
  - 내부 헬퍼: `_compute_percentile(db, nickname)`, `_compute_hourly_histogram(db, nickname)`
- `services/auth_service.py`
  - `login(db, nickname, pin) -> (token, expires_at)`
  - `logout(db, token)`
  - `resolve_token(db, token) -> str | None` (만료/없음 시 None)
- `core/security.py`
  - `get_current_player(authorization: str = Header(...))` Dependency

## 9. 프론트엔드

### 9.1 신규 파일
- `src/components/StatsScreen.tsx` — 통계 화면 본체
- `src/components/stats/MyStatsCards.tsx` — 기본 집계 카드 섹션
- `src/components/stats/TrendChart.tsx` — 7/30일 시계열
- `src/components/stats/RankingPanel.tsx` — 백분위
- `src/components/stats/StageBreakdown.tsx` — 1~15 스테이지표
- `src/components/stats/HabitHeatmap.tsx` — 시간대 히트맵
- `src/api/stats.ts` — `getMyStats`, `getGlobalStats`, `getMySessions`
- `src/api/auth.ts` — `login`, `logout`, `getStoredToken` (sessionStorage)

### 9.2 기존 파일 수정
- `App.tsx` — 라우팅 상태에 `'stats'` 추가
- `StartScreen.tsx` — "내 통계" 진입 버튼
- `GameScreen.tsx` 결과 영역 — "내 통계 보기" 버튼
- `src/api/players.ts`(또는 동등 파일) — `saveResult`에 `stageScores` 인자 추가
- Game 로직(`PlayStage` 등) — 스테이지 종료 시 점수를 누적해 `stage_scores` 객체 구성 후 결과 저장 시 전달

### 9.3 차트 라이브러리
- **Recharts** 채택 (React 19 호환, 가벼움). 이미 종속성 검토 필요.
- 대안: Chart.js + `react-chartjs-2`. 결정은 구현 단계에서 npm 사이즈 비교 후 확정.

### 9.4 인증 흐름
- 통계 화면 진입 → `sessionStorage.token` 확인 → 없거나 만료 시 PIN 입력 모달 → `/auth/login` → 토큰 저장.
- 토큰 만료(401 응답) 시 모달 재오픈.

## 10. 보존 / 클린업

- **세션 30일 보존**: FastAPI `lifespan` startup hook에서 `asyncio.create_task` 로 백그라운드 루프 실행. 매일 03:00 KST `DELETE FROM game_sessions WHERE played_at < now() - INTERVAL '30 days'`. 컨테이너 재시작이 잦으면 간격 누락 가능 — 안전망으로 `now() - INTERVAL '30 days'` 기준 매시간 한 번 추가 정리.
- **만료 토큰 클린업**: 동일 루프에서 `DELETE FROM player_sessions WHERE expires_at < now()`.
- **일별 집계는 영구**.

## 11. 보안 / 개인정보

- PAT/PIN 등 민감 정보는 응답에 절대 포함하지 않음.
- 토큰은 `secrets.token_urlsafe(48)` 생성, DB에 평문 저장(짧은 TTL이므로 허용). 더 강화 필요 시 SHA-256 해시 저장.
- 본인 통계 API는 토큰의 nickname과 path의 nickname 일치 검증.
- 전체 통계는 닉네임 단위 정보 노출 없음 (집계값만).
- CORS: 기존 `allow_origins=["*"]` 유지 — 토큰 헤더는 `Authorization`이라 자격증명 쿠키 아님.

## 12. 성능 / 부하

- 일별 집계 테이블이 통계 조회를 가볍게 만듦. 30일 시계열도 최대 30행/사용자.
- 전체 통계 = 일별 테이블 합산 + 5분 캐시 → 통계 화면 진입 비용 무시 가능.
- 백분위는 `percentile_cont`를 1회 SQL로 계산 (사용자별 best_score 분포 기준).
- 시간대 히트맵은 사용자별 최근 30일 `game_sessions` 스캔. PK 인덱스 + `played_at` 범위로 충분.

## 13. 테스트 계획

- 백엔드
  - `pytest` 신규: `tests/test_stats.py`, `tests/test_auth.py`
  - 시나리오: 세션 INSERT + 일별 UPSERT 트랜잭션, 만료 토큰 거부, 본인 외 닉네임 조회 거부, 30일 보존 클린업.
- 프론트엔드
  - 단위: `getMyStats` mock 응답 렌더.
  - 수동 QA: 결과 화면 → 통계 진입 → PIN → 차트 표시. 로그아웃 후 재진입.

## 14. 작업 단계 (구현 순서)

1. 백엔드 모델/마이그레이션 (`game_sessions`, `player_stats_daily`, `player_sessions`)
2. `save_game_result` 트랜잭션 확장 (세션 INSERT + 일별 UPSERT) + 상한 검증 재사용
3. `auth_service`, `auth_router`, `security.py` (토큰 발급/검증)
4. `stats_service`, `stats_router` (4개 엔드포인트)
5. 클린업 백그라운드 작업 (`lifespan` 내부)
6. 프론트 API 클라이언트 (`api/auth.ts`, `api/stats.ts`) + 토큰 보관
7. `StatsScreen` + 하위 컴포넌트 + 차트 라이브러리 도입
8. 결과 화면 / 메인 진입 버튼 연결
9. Game 로직에서 `stage_scores` 수집 → `saveResult` 호출 시 전달
10. CLAUDE.md API 표 업데이트, README 버전 정보 갱신

## 15. 오픈 이슈 / 후속 작업

- 시간대 표시 기준 (KST 고정 vs 브라우저 timezone) — KST 고정으로 시작, 후속 이슈에서 사용자 설정.
- 비공개 닉네임 / 테스트 닉네임 필터 — 필요 시 `players` 테이블 `is_excluded_from_global` 컬럼 추가.
- 더 무거운 분석 (코호트 리텐션 등) — 향후 별도 이슈.
