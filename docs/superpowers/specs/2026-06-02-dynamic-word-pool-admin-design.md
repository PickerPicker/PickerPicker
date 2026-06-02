# 동적 단어 풀 + Admin 콘솔 (단어 관리/통계) — 설계서

- 작성일: 2026-06-02
- 작성자: Claude (Opus 4.7 / 1M)
- 관련 이슈:
  - 메인: [#133](https://github.com/PickerPicker/PickerPicker/issues/133) — 동적 단어 풀 + Admin 콘솔 (단어 관리/통계)
  - 인프라: [#134](https://github.com/PickerPicker/PickerPicker/issues/134) — DB 마이그레이션 도구 Alembic 도입
  - 후속: [#135](https://github.com/PickerPicker/PickerPicker/issues/135) — Admin 콘솔: 플레이어 관리
- 상태: 설계 확정
- 선행 spec: [`2026-05-16-admin-page-design.md`](./2026-05-16-admin-page-design.md) — 플레이어 관리용 admin (미구현). 본 spec은 그 admin 콘솔 범위를 **단어 관리/통계까지 확장**하며, 인증 모델은 본 spec 기준(다중 admin, DB 세션 토큰)으로 갱신한다.

---

## 1. 배경

### 1.1 현재 문제

- 단어 데이터 = `docs/rhythm_stages_001_015.json` 정적 파일 1개에 15개 단어 하드코딩.
- 반복 플레이 시 단어 패턴이 동일 → 사용자가 단어 외우면 기계적 입력 가능, 게임성 저하.
- 단어를 추가하려면 코드 수정 + 재배포 필요.
- 게임오버 화면이 세로로 길고 빈약 — 단어별 통계 시각화 자리 비어 있음.
- 단어별 통계(난이도, 노출 횟수, 정확도) 추적 수단 없음.

### 1.2 목표

1. **단어 풀 동적 관리** — DB에 단어 저장, AI 생성 JSON을 admin이 화면에서 등록.
2. **매 플레이 단어 추첨** — `stage 1 = 커피` 고정, `stage 2~15`는 난이도 그룹별 풀에서 무작위 추첨.
3. **단어별 통계** — player×word 집계 + 세션 raw 기록 둘 다 저장. 본인 stats 화면에 단어 분석 섹션 추가, admin 글로벌 통계 화면 제공.
4. **다중 admin 계정** — env 시드 1명 + 화면에서 admin 추가 등록 가능.
5. **Alembic 도입** — 본 작업 시점에 마이그레이션 도구 도입, 신규 + 기존 테이블 전부 BigInt 통일.

---

## 2. 범위

### 2.1 In Scope

- DB 마이그레이션 도구(Alembic) 도입, 기존 5개 테이블(players/game_sessions/hall_of_fame/player_stats_daily/player_session) id 컬럼 전부 `BigInteger` 통일.
- 신규 테이블: `words`, `admins`, `admin_sessions`, `word_stats`, `session_word_results`.
- `POST /games/start` 신규 — 서버가 단어 추첨해서 15 stage 응답.
- `POST /players/result` 확장 — stage별 단어 결과 받아 raw + 집계 동시 저장 (단일 트랜잭션).
- `GET /players/{nickname}/stats` 확장 — 단어 분석 섹션 추가.
- Admin 인증 — 세션 토큰 방식 (player 토큰과 격리, DB 저장, 24h TTL, 즉시 폐기 가능).
- Admin 화면 — 단어 CRUD (JSON 붙여넣기 + 미리보기), 단어 글로벌 통계, admin 추가 등록.
- 게임 시작 시 풀 부족 → 422 에러 + FE 안내 모달.
- GameOver 화면 = 가로 2단 (좌: 기존 점수, 우: 이번 판 단어 카드).
- Stats 화면 = 단어별 분석 섹션 (TOP5 많이/어려운/잘하는 단어).
- Practice 모드 = DB 풀에서 추첨 (일관성).
- 정적 JSON → DB 자동 시드 (첫 기동 시 `words` 비어있으면 INSERT).
- `admins` 자동 시드 (env `INITIAL_ADMIN_USERNAME`/`INITIAL_ADMIN_PASSWORD`).

### 2.2 Out of Scope

- 플레이어 관리(점수 수정, PIN 초기화, 닉네임 차단) — 선행 spec 2026-05-16-admin-page-design.md 범위. 별도 이슈로 후속 진행.
- 게임 중 실시간 단어 통계 노출 (스테이지 클리어 직후 평균 비교 등) — 별도 이슈.
- 다국어 단어 (영문/일문 등) — 향후 확장.
- 단어 검수 워크플로우 (등록 → 검수자 승인 → 활성화) — 1인 운영자 가정.
- 단어 카테고리/태그 시스템.

---

## 3. 아키텍처

### 3.1 컴포넌트 다이어그램

```
[Admin (env seed + 화면 등록)]
        │
        ▼
[FE /admin]  ───── HMAC + admin Bearer ────▶  [BE /admin/*]
        ▲                                          │
        │                                          ▼
[FE 게임화면]                                 [PostgreSQL]
   /players, /games, /stats           ┌──────────────────────────┐
        ▲                             │ words                    │
        │                             │ admins                   │
        │                             │ admin_sessions           │
        │                             │ word_stats               │
        │                             │ session_word_results     │
        └─── HMAC + player Bearer ────│ players (기존, BigInt 변경) │
                                      │ game_sessions (기존)      │
                                      │ player_session (기존)     │
                                      │ player_stats_daily (기존) │
                                      │ hall_of_fame (기존)       │
                                      └──────────────────────────┘
```

### 3.2 권한·신뢰 경계

- **단어 추첨 = 백엔드 단독 권한.** FE는 어떤 단어가 stage에 배치될지 추첨에 관여하지 않음(부정 방지).
- **통계 집계 = 백엔드 트랜잭션 단위.** raw INSERT + UPSERT를 한 트랜잭션 안에서 처리, 중간 실패 시 전부 롤백.
- **Admin 인증 = player 인증과 완전 분리.** 별도 테이블(`admins`, `admin_sessions`), 별도 토큰 컬럼, 별도 localStorage 키(`admin_token`).
- **모든 admin 엔드포인트 = HMAC + admin Bearer 토큰 둘 다 검증.** `_PUBLIC_PATHS`에 추가 금지.

---

## 4. DB 스키마

### 4.1 신규 테이블

```sql
-- 단어 풀
CREATE TABLE words (
  id                BIGSERIAL PRIMARY KEY,
  word              VARCHAR(20) UNIQUE NOT NULL,
  difficulty_level  INT NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  bpm               INT NOT NULL,
  input_length      INT NOT NULL,
  valid_syllables   JSONB NOT NULL,        -- ["커","피"]
  invalid_syllables JSONB NOT NULL,
  input_syllables   JSONB NOT NULL,
  key_mapping       JSONB NOT NULL,        -- [{"key":"a","syllable":"커","type":"valid"},...]
  fixed_stage       INT NULL,              -- NOT NULL이면 항상 해당 stage에 배치 (커피=1)
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fixed_stage)                     -- 한 stage = 한 고정 단어
);
CREATE INDEX idx_words_active_diff ON words(is_active, difficulty_level);

-- admin 계정
CREATE TABLE admins (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(128) NOT NULL,     -- bcrypt
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    BIGINT NULL REFERENCES admins(id) ON DELETE SET NULL
);

-- admin 세션 토큰 (player_session 패턴 복제)
CREATE TABLE admin_sessions (
  token       VARCHAR(64) PRIMARY KEY,     -- secrets.token_urlsafe(32) 결과
  admin_id    BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

-- player × word 집계 (UPSERT 대상)
CREATE TABLE word_stats (
  player_id       BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  word_id         BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  exposure_count  INT NOT NULL DEFAULT 0,
  perfect_count   INT NOT NULL DEFAULT 0,
  good_count      INT NOT NULL DEFAULT 0,
  miss_count      INT NOT NULL DEFAULT 0,
  best_score      INT NOT NULL DEFAULT 0,
  last_played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, word_id)
);
CREATE INDEX idx_word_stats_word ON word_stats(word_id);

-- 세션 raw 기록 (stage 단위)
CREATE TABLE session_word_results (
  id            BIGSERIAL PRIMARY KEY,
  session_id    BIGINT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  word_id       BIGINT NOT NULL REFERENCES words(id),
  stage_index   INT NOT NULL,
  perfect_count INT NOT NULL,
  good_count    INT NOT NULL,
  miss_count    INT NOT NULL,
  stage_score   INT NOT NULL,
  played_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_swr_word ON session_word_results(word_id);
CREATE INDEX idx_swr_session ON session_word_results(session_id);
```

### 4.2 기존 테이블 변경

- 모든 기존 테이블 id 컬럼 `Integer` → `BigInteger` (`game_sessions`는 이미 BigInteger).
- 외래키 컬럼들도 동시에 BigInt로 변경 (`player_session.player_id`, `player_stats_daily.player_id`, `hall_of_fame.player_id` 등).
- 데이터 보존 — `ALTER COLUMN ... TYPE BIGINT USING ...::BIGINT`.

### 4.3 마이그레이션 도구

- **Alembic 도입** — `backend/alembic.ini` + `backend/alembic/` 디렉토리.
- 운영 정책: uvicorn 시작 시 자동 실행 안 함. Docker entrypoint에서 `alembic upgrade head` 호출.
- baseline 마이그레이션 = 현재 운영 스키마 캡처. 이후 모든 변경은 신규 revision.
- 별도 이슈 #N "DB 마이그레이션 도구(Alembic) 도입"으로 트래킹 (이번 PR과 통합 진행).

### 4.4 시드 로직

**words 시드 (첫 기동 시):**
- `SELECT COUNT(*) FROM words` == 0 이면 `docs/rhythm_stages_001_015.json` 15개 INSERT.
- 커피 = `fixed_stage=1`. 나머지 14개 = `fixed_stage=NULL`.
- 두 번 기동해도 idempotent.

**admins 시드 (첫 기동 시):**
- env `INITIAL_ADMIN_USERNAME` + `INITIAL_ADMIN_PASSWORD` 존재 + `SELECT COUNT(*) FROM admins` == 0 이면 INSERT.
- 비밀번호 = bcrypt 해시.

---

## 5. API 설계

### 5.1 게임 플레이 API

| 메서드 | 경로 | 변경 사항 |
|--------|------|----------|
| GET | `/stages`, `/stages/{n}`, `/stages/meta` | **제거 (deprecated 1주 후 제거)** — 정적 응답 의미 상실 |
| POST | `/games/start` | **신규** — 서버가 단어 추첨 → `{ stages: [StageData × 15] }` |
| POST | `/practice/start` | **신규** — 연습 모드용 단어 3개 추첨. 통계 미반영 |
| POST | `/players/result` | **확장** — body에 `stage_results: [{ word_id, stage_index, perfect_count, good_count, miss_count, stage_score }]` 추가. 트랜잭션 내 `game_sessions` INSERT, `session_word_results` × N INSERT, `word_stats` × N UPSERT, `players` UPSERT, `player_stats_daily` UPSERT 모두 처리 |
| GET | `/players/{nickname}/stats` | **확장** — 응답에 `words: { played: N, most_played: WordSummary[], hardest: WordSummary[], easiest: WordSummary[] }` 추가 |

### 5.2 Admin API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/admin/auth/login` | `{ username, password }` → `{ token, expires_at }` (24h) |
| POST | `/admin/auth/logout` | Bearer 토큰 폐기 |
| POST | `/admin/admins` | 신규 admin 등록 — `{ username, password }` |
| GET | `/admin/admins` | admin 목록 |
| GET | `/admin/words` | 단어 목록 — query: `difficulty`, `is_active`, `limit`, `offset` |
| GET | `/admin/words/{id}` | 단일 단어 |
| POST | `/admin/words` | JSON 전체 등록 — pydantic 스키마 검증 + word UNIQUE 충돌 시 409 |
| PUT | `/admin/words/{id}` | 수정 (전체 또는 부분 — partial update) |
| DELETE | `/admin/words/{id}` | 소프트 삭제 (`is_active=false`). 통계 보존 위해 hard delete 금지 |
| GET | `/admin/stats/words` | 글로벌 단어 통계 — query: `sort` (exposure_desc / accuracy_asc / accuracy_desc), `limit` |
| GET | `/admin/stats/overview` | 전체 요약 (총 플레이, 활성 단어 수, 평균 점수 등) |

### 5.3 단어 추첨 로직 (`POST /games/start`)

```python
def pick_stages() -> list[Word]:
    stages: list[Word | None] = [None] * 15
    # 1. 고정 단어 배치
    for w in db.query(Word).filter(Word.fixed_stage.isnot(None), Word.is_active).all():
        stages[w.fixed_stage - 1] = w
    # 2. 빈 슬롯 = 난이도 그룹별 풀에서 랜덤
    used_ids: set[int] = {s.id for s in stages if s}
    for stage_idx in range(15):
        if stages[stage_idx]:
            continue
        diff = (stage_idx // 3) + 1   # 0~2 -> 1, 3~5 -> 2, ..., 12~14 -> 5
        pool = db.query(Word).filter(
            Word.difficulty_level == diff,
            Word.is_active,
            Word.fixed_stage.is_(None),
            ~Word.id.in_(used_ids)
        ).all()
        if not pool:
            raise InsufficientPoolError(difficulty=diff)
        chosen = random.choice(pool)
        stages[stage_idx] = chosen
        used_ids.add(chosen.id)
    return stages
```

풀 부족 응답: `422 { error: "insufficient_word_pool", difficulty: N }`.

### 5.4 인증 dependency

```python
async def get_current_admin(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> Admin:
    token = authorization.removeprefix("Bearer ").strip()
    session = await db.scalar(
        select(AdminSession).where(
            AdminSession.token == token,
            AdminSession.expires_at > datetime.utcnow()
        )
    )
    if not session:
        raise HTTPException(401, "invalid_or_expired_admin_token")
    return await db.get(Admin, session.admin_id)
```

모든 `/admin/*` 라우터에 `Depends(get_current_admin)` 부착. HMAC 미들웨어는 기존대로 작동(추가 작업 불필요).

### 5.5 word JSON pydantic 검증

```python
class KeyMappingItem(BaseModel):
    key: Literal["a","s","d","f","j","k","l",";"]
    syllable: str = Field(min_length=1, max_length=4)
    type: Literal["valid", "invalid"]

class WordCreateRequest(BaseModel):
    word: str = Field(min_length=1, max_length=20)
    difficulty_level: int = Field(ge=1, le=5)
    bpm: int = Field(ge=60, le=300)
    input_length: int = Field(ge=8, le=200)
    valid_syllables: list[str] = Field(min_length=1)
    invalid_syllables: list[str]
    input_syllables: list[str]
    key_mapping: list[KeyMappingItem] = Field(min_length=8, max_length=8)
    fixed_stage: int | None = Field(default=None, ge=1, le=15)

    @model_validator(mode="after")
    def check_consistency(self):
        # input_syllables 길이 == input_length
        if len(self.input_syllables) != self.input_length:
            raise ValueError("input_syllables 길이가 input_length와 불일치")
        # key_mapping에 8개 키 모두 정확히 1번씩 등장
        keys = {km.key for km in self.key_mapping}
        if keys != {"a","s","d","f","j","k","l",";"}:
            raise ValueError("key_mapping은 a/s/d/f/j/k/l/; 8개 키 모두 포함해야 함")
        # valid_syllables + invalid_syllables 합집합 == key_mapping의 음절 합집합
        all_syl = set(self.valid_syllables) | set(self.invalid_syllables)
        km_syl = {km.syllable for km in self.key_mapping}
        if all_syl != km_syl:
            raise ValueError("valid+invalid 음절과 key_mapping 음절 집합이 불일치")
        # input_syllables의 모든 항목은 valid+invalid 안에 있어야 함
        if not all(s in all_syl for s in self.input_syllables):
            raise ValueError("input_syllables에 정의되지 않은 음절 포함")
        return self
```

---

## 6. FE 컴포넌트

### 6.1 신규 디렉토리

```
src/components/admin/
├── AdminLoginScreen.tsx       # username/password 입력
├── AdminDashboard.tsx         # 진입 메뉴
├── WordListPage.tsx           # 단어 목록 + 필터 + CRUD 진입
├── WordFormPage.tsx           # JSON 붙여넣기 + 미리보기 + 등록/수정
├── WordStatsPage.tsx          # 글로벌 단어 통계
├── AdminListPage.tsx          # admin 목록 + 신규 등록
└── adminApi.ts                # adminFetch — apiFetch 패턴 복제, admin_token 부착
```

### 6.2 라우팅

- `/admin` → admin_token 없으면 `/admin/login` 강제 리다이렉트.
- `/admin/login` → 성공 시 localStorage에 `admin_token` + `admin_token_expires_at` 저장.
- `/admin/logout` → `POST /admin/auth/logout` + localStorage 클리어.
- 보호 라우트: `/admin/dashboard`, `/admin/words`, `/admin/words/new`, `/admin/words/:id`, `/admin/stats`, `/admin/admins`.

### 6.3 기존 화면 변경

**`GameScreen.tsx`**
- 정적 JSON fetch 제거.
- `POST /games/start` 호출 → 응답의 `stages` 사용.
- stage 클리어/실패마다 `stage_results[i]` 누적.
- 게임 종료 시 `POST /players/result`에 `stage_results` 포함.

**`PracticeScreen.tsx`**
- 정적 JSON fetch 제거.
- 별도 엔드포인트 `POST /practice/start` 사용 — 통계 영향 차단 위해 `/games/start`와 분리. 응답 형태는 동일 (`{ stages: [...] }`).
- 응답 중 첫 3개만 사용 (현재 로직 그대로).
- Practice 결과는 어떤 통계 테이블에도 기록하지 않음.

**`GameOverScreen`**
- 레이아웃 = 가로 2단 (좌: 기존 점수/스테이지/콤보, 우: 단어 카드 그리드).
- 단어 카드: 단어 + 본인 정확도(%) + 전역 평균 정확도(%) 비교 표시.
- 카드 수 = 이번 판에서 만난 단어 수 (게임오버까지 진행한 stage 수).

**Stats 화면**
- 신규 섹션 "단어별 분석":
  - 가장 많이 만난 단어 TOP5 (exposure_count desc)
  - 가장 어려운 단어 TOP5 (정확도 asc, exposure >= 3 필터)
  - 가장 잘하는 단어 TOP5 (정확도 desc, exposure >= 3 필터)

### 6.4 격리 원칙

- `components/admin/*` = 일반 게임 컴포넌트 의존성 없음.
- `adminApi.ts` = `authService.ts`와 동일 HMAC 흐름 + 토큰 키만 분리.
- DaisyUI 테마 동일하게 적용.

---

## 7. 데이터 흐름

### 7.1 게임 1회 전체

```
[게임 시작 버튼]
   ↓
FE: POST /games/start (HMAC + player Bearer)
   ↓
BE: pick_stages() → 15개 단어 + 메타 응답
   ↓
FE: stages 메모리 보관 → 1~15 진행, stage 클리어마다 results[i] 누적
   ↓
[게임 종료]
   ↓
FE: POST /players/result body: { nickname, score, stage, combo, stage_scores, stage_results }
   ↓
BE 트랜잭션:
   1. game_sessions INSERT → session_id 발급
   2. session_word_results INSERT × N (FK session_id)
   3. word_stats UPSERT × N — INSERT ... ON CONFLICT (player_id, word_id) DO UPDATE SET
        exposure_count = word_stats.exposure_count + EXCLUDED.exposure_count,
        perfect_count  = word_stats.perfect_count  + EXCLUDED.perfect_count,
        good_count     = word_stats.good_count     + EXCLUDED.good_count,
        miss_count     = word_stats.miss_count     + EXCLUDED.miss_count,
        best_score     = GREATEST(word_stats.best_score, EXCLUDED.best_score),
        last_played_at = EXCLUDED.last_played_at
   4. players UPSERT (기존 best 갱신)
   5. player_stats_daily UPSERT (기존)
   ↓
BE 응답 → GameOverScreen
```

### 7.2 트랜잭션 무결성

- `POST /players/result` = **단일 트랜잭션**. 어느 하나라도 실패 시 전부 롤백.
- `word_stats` = `INSERT ... ON CONFLICT (player_id, word_id) DO UPDATE SET exposure_count = word_stats.exposure_count + EXCLUDED.exposure_count, ...`.
- `session_word_results` = 항상 INSERT, 절대 UPDATE 없음.
- `game_sessions` DELETE 시 `session_word_results` CASCADE.

### 7.3 에러 처리

| 상황 | BE 응답 | FE 처리 |
|------|---------|---------|
| 단어 풀 난이도 N 부족 | 422 `{error:"insufficient_word_pool", difficulty:N}` | 모달: "관리자에게 단어 등록 요청" |
| admin 토큰 만료 | 401 | /admin/login 리다이렉트 + 토스트 |
| word JSON 검증 실패 | 422 `{detail:[{loc,msg}]}` | 폼 필드별 에러 표시 |
| word UNIQUE 충돌 | 409 `{error:"word_exists", word:"X"}` | "이미 등록된 단어" 알림 |
| stage_results 누락 | 400 | FE 버그 — 게임 종료 로직 재확인 |
| fixed_stage UNIQUE 충돌 | 409 `{error:"fixed_stage_taken", stage:N}` | 폼 안내 |

---

## 8. 테스트 전략

### 8.1 백엔드

**단위:**
- `pick_stages()` — 고정 단어 배치, 난이도 그룹 추첨, 무중복, 풀 부족 시 raise.
- `word_stats` UPSERT — 신규 INSERT / 기존 행 가산.
- admin 인증 dependency — 만료/유효/없는 토큰.
- `WordCreateRequest` 검증 — 8개 키 누락, 음절 집합 불일치, input_length 불일치 케이스.

**통합 (pytest + test DB):**
- `POST /games/start` 정상 → 15 stage, 커피=stage1 확인.
- `POST /players/result` 트랜잭션 — 정상/중간 실패 롤백.
- admin CRUD 풀 사이클.
- 풀 부족 시나리오.

### 8.2 프론트엔드

**컴포넌트 (vitest + RTL):**
- `WordFormPage` — JSON 파싱/미리보기/에러.
- `GameOverScreen` — stage_results 배열 렌더.
- admin 토큰 없을 때 `/admin/*` 진입 → 리다이렉트.

**E2E (수동):**
- 게임 1회 풀 흐름 — 시작 → 15 stage → 게임오버 → stats.
- admin 1회 풀 흐름 — 로그인 → 단어 등록 → 게임에서 출현 → 통계 반영.

### 8.3 마이그레이션

- Alembic `upgrade head` → `downgrade -1` → `upgrade head` 정상.
- 시드 idempotent — 두 번 기동해도 중복 INSERT 없음.

---

## 9. 마이그레이션 순서 (배포 안전)

```
1. [BE PR-A] Alembic 도입 + 기존 5개 테이블 BigInt 통일
   - alembic init backend/alembic
   - baseline revision = 현재 스키마 캡처
   - 두번째 revision = Integer → BigInteger ALTER (player.id 등)
   - Docker entrypoint에 alembic upgrade head 추가
   - 배포: 백엔드만 먼저, FE 무변경

2. [BE PR-B] 신규 테이블 5개 + admin/단어 API + 시드 로직
   - Alembic revision = words/admins/admin_sessions/word_stats/session_word_results CREATE
   - 시드: words ← rhythm_stages_001_015.json, admins ← env
   - admin API 엔드포인트
   - /games/start 신규 엔드포인트 (기존 /stages는 deprecated 마킹)
   - 배포: 백엔드만, FE 영향 없음

3. [FE PR-C] /admin 화면
   - admin 로그인 + 단어 CRUD + 통계 + admin 추가
   - 게임 화면 무변경
   - 배포: FE 갱신, 일반 사용자 영향 없음

4. [FE+BE PR-D] 게임 흐름 전환
   - FE GameScreen → /games/start 호출, stage_results 누적·전송
   - BE /players/result 확장
   - BE /stages 제거
   - 배포: FE + BE 동시 (브레이킹), 동시 롤백 필수

5. [FE PR-E] GameOver 가로 2단 + Stats 단어 섹션
   - GameOverScreen 레이아웃 변경
   - Stats 단어 분석 섹션
   - BE 응답 확장
```

**롤백 전략:**
- PR-A → Alembic downgrade.
- PR-B → 신규 테이블 DROP (CASCADE 주의, 운영 데이터 손실 가능 — 무중단 롤백 위해 한동안 병행 유지 후 정리).
- PR-D → FE/BE 동시 롤백 필수.

---

## 10. 보안 체크리스트

- [ ] admin 비번 = bcrypt 해시, 평문 저장 금지.
- [ ] admin 토큰 = 32바이트 `secrets.token_urlsafe`.
- [ ] `_PUBLIC_PATHS`에 `/admin/*` 추가 금지 (HMAC 강제).
- [ ] admin API = HMAC + Bearer 둘 다 검증.
- [ ] word JSON 검증 — `key_mapping.key` Literal로 8개 키만 허용.
- [ ] admin 화면 = `adminApi.ts`로 HMAC 자동 부착.
- [ ] env `INITIAL_ADMIN_PASSWORD` = GitHub Secrets로 주입, `.env` 평문 금지.
- [ ] DELETE = 소프트 삭제, 통계 데이터 보존.
- [ ] 만료된 admin_sessions 주기 정리 (별도 cron 또는 즉시 정리 dependency).

---

## 11. 별도 이슈 등록 예정

- **#134 "DB 마이그레이션 도구(Alembic) 도입"** — 본 PR과 통합 진행하되 트래킹 위해 분리 등록.
- **#135 "Admin 콘솔: 플레이어 관리"** — 선행 spec `2026-05-16-admin-page-design.md`의 플레이어 관리(점수 수정/PIN 초기화/닉네임 차단) 범위. 본 spec 완료 후 후속 작업.
- **미등록 "게임 중 단어 통계 실시간 노출"** — 스테이지 클리어 직후 평균 비교 표시 등. 본 spec Out of Scope. 필요 시 향후 별도 이슈로 등록.
