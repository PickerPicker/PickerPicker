# 관리자 페이지 (Admin Console) — 설계서

- 작성일: 2026-05-16
- 작성자: Claude (Sonnet 4.6 / 1M)
- 관련 이슈: 미생성 (구현 직전 `/issue`로 생성 예정)
- 상태: 설계 확정

---

## 1. 배경

### 1.1 현재 문제

랭킹 상위에 `score = 2,147,483,647 (INT32 max)` / `combo = 2,147,483,647` 같은 명백한 치트 기록이 2건 존재한다. 이미 #72에서 `MAX_SCORE=10_000_000`, `MAX_STAGE=100`, `MAX_COMBO=9_999` 상한 검증이 추가되어 **신규 치트 입력은 차단**된 상태지만:

1. **기존 치트 기록을 정리할 수단이 없다** — DB에 직접 접근하지 않는 한 제거 불가.
2. **PIN을 잊은 플레이어를 구제할 수단이 없다** — `pin_hash`가 NULL이 아닌 이상 본인 입력 외엔 풀 수 없음.
3. **악성 플레이어를 차단할 수단이 없다** — 닉네임 단위로 가입을 막거나 제거할 수 없음.

### 1.2 목표

위 세 가지를 해결하는 **단일 페이지 관리자 콘솔**을 제공한다. 1인 운영자 시나리오를 가정한다 (롤·권한 다단계 없음).

---

## 2. 범위

### 2.1 In Scope

- 관리자 인증 (단일 계정, 환경변수 자격증명, JWT 세션)
- 플레이어 목록 조회 (검색·정렬·페이지네이션)
- 플레이어 개별 조회
- 플레이어 기록 수정 (score / stage / combo / play_count)
- 플레이어 비활성화 (소프트 삭제) / 활성화
- 플레이어 영구 삭제 (하드 삭제, 강제 확인 후)
- PIN 초기화 (`pin_hash`를 NULL로 클리어)
- 비활성 플레이어를 랭킹·기존 조회 API에서 제외

### 2.2 Out of Scope

- 다중 관리자 / RBAC
- 감사 로그(audit trail) DB 테이블
- IP 단위 차단·rate-limit
- 게임 설정(스테이지·난이도) 편집
- 대시보드 지표 카드

---

## 3. 아키텍처

### 3.1 파일 구성

```
backend/
  src/
    apis/
      admin_router.py          # 신규 — /admin/* 엔드포인트
      ranking_router.py        # 수정 — is_active=true 필터
      player_router.py         # 수정 — 비활성 닉네임은 신규 등록 차단
    services/
      admin_service.py         # 신규 — 인증·CRUD 로직
      player_service.py        # 수정 — 비활성 필터
    models/
      player.py                # 수정 — is_active 컬럼 추가
    core/
      config.py                # 수정 — ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET 추가
      security.py              # 신규 — JWT 발급·검증 유틸
    main.py                    # 수정 — admin_router 등록

src/
  pages/
    AdminPage.tsx              # 신규 — 관리자 단일 페이지
  services/
    adminApi.ts                # 신규 — fetch wrapper + 토큰 자동 첨부
  types/
    admin.ts                   # 신규 — AdminPlayer, JWT, API 응답 타입
  App.tsx                      # 수정 — 'admin' screen 분기 + URL hash 라우팅
  types/index.ts               # 수정 — Screen union에 'admin' 추가
```

### 3.2 인증 흐름

```
[프론트]                          [백엔드]
1. /#admin 접속 → 미로그인 감지
2. 로그인 폼 (ID/PW 입력)
3. POST /admin/login  ────────►  ADMIN_USERNAME/PASSWORD 비교
                                  ◄──── 200: {token: JWT(HS256, 24h)}
4. localStorage["admin_token"] 저장
5. 모든 admin API 호출 시 헤더에
   Authorization: Bearer <token>
                                  ◄──── verify_admin_token 의존성 검증
                                        실패 시 401
6. 401 응답 → 토큰 제거 → 로그인 폼
```

JWT payload: `{"sub": "admin", "exp": <unix_ts>}`. 서명 알고리즘 HS256, 비밀키 = `JWT_SECRET` 환경변수 (32바이트 랜덤). 토큰 유효기간 24시간.

### 3.3 데이터 흐름 (수정·삭제 예시)

```
AdminPage Table → "삭제(소프트)" 버튼 → 확인 모달 → adminApi.softDeletePlayer(id)
  → PATCH /admin/players/{id}  body: {is_active: false}
  → admin_service.update_player()  → SQL: UPDATE players SET is_active=false WHERE id=...
  → 응답 → 테이블 행 갱신 + toast "비활성화됨"
```

### 3.4 비활성 플레이어 제외 정책

- `GET /ranking` → `WHERE is_active = true` 필터 적용
- `GET /players/{nickname}` → 비활성이어도 조회 가능 (관리자 외 일반 사용자도 가능 — 단 결과 화면에서만 본인 기록 확인용)
- `POST /players` (신규 등록) → 비활성 닉네임은 `409 Conflict` 반환 (닉네임 재사용 방지)
- `POST /players/result` → 비활성 닉네임은 `403 Forbidden` 반환

---

## 4. 데이터 모델

### 4.1 `players` 테이블 변경

```python
# backend/src/models/player.py
class Player(Base):
    __tablename__ = "players"
    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nickname:    Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    pin_hash:    Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    best_score:  Mapped[int] = mapped_column(Integer, default=0)
    best_stage:  Mapped[int] = mapped_column(Integer, default=0)
    best_combo:  Mapped[int] = mapped_column(Integer, default=0)
    play_count:  Mapped[int] = mapped_column(Integer, default=0)
    # ─── 신규 ───
    is_active:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

### 4.2 마이그레이션

기존 운영 DB에 컬럼 추가. PostgreSQL `ALTER TABLE ... ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE`. 기존 row 모두 `true`로 채워짐.

본 프로젝트는 Alembic 의존성은 있으나 **현재 마이그레이션 스크립트 없음** (`Base.metadata.create_all`만 사용). 동일 패턴 유지 — 컬럼은 모델에 추가하면 `lifespan`이 신규 환경에 한해 자동 생성. **기존 운영 DB**(시놀로지 NAS)는 한 번 수동 ALTER 필요. 운영 적용 절차는 §9에 명시.

---

## 5. 환경변수

`backend/.env` (단일 파일, 별도 secret 분리 금지 — 사용자 원칙 준수):

```env
DATABASE_URL=postgresql+asyncpg://kimchi:<DB_PW>@suh-project.synology.me:5430/pickerpicker
ENVIRONMENT=prod
API_KEY=
ADMIN_USERNAME=kimchi
ADMIN_PASSWORD=<관리자 비번>
JWT_SECRET=<32바이트 hex 랜덤>
JWT_EXP_HOURS=24
```

GitHub Secret = `BACKEND_ENV_FILE` 한 통에 포함 (이미 등록 완료). 추가 단일 secret 만들지 않는다.

`backend/.env.example` 동일 키 (값은 placeholder)로 갱신.

---

## 6. API 명세

### 6.1 인증

#### `POST /admin/login`

Request:
```json
{"username": "kimchi", "password": "..."}
```

Response 200:
```json
{"token": "eyJhbGc...", "expires_in": 86400}
```

Response 401: `{"detail": "Invalid credentials"}`

#### 헤더 인증

모든 `/admin/*` (login 제외)는 `Authorization: Bearer <token>` 필수. 누락·만료·서명불일치 → 401.

### 6.2 플레이어 목록·조회

#### `GET /admin/players?search=<str>&active=<bool>&sort=<field>&page=<n>&size=<n>`

쿼리 파라미터:
- `search` (선택): nickname LIKE `%<search>%`
- `active` (선택): true | false | omit(전체)
- `sort` (선택, 기본 `-best_score`): `best_score | -best_score | created_at | -created_at | nickname | -nickname`
- `page` (기본 1), `size` (기본 50, 최대 200)

Response 200:
```json
{
  "total": 123,
  "page": 1,
  "size": 50,
  "items": [
    {
      "id": 1,
      "nickname": "김서진뚫지마라",
      "best_score": 2147483647,
      "best_stage": 1,
      "best_combo": 2147483647,
      "play_count": 2,
      "has_pin": true,
      "is_active": true,
      "created_at": "2026-05-10T12:34:56",
      "updated_at": "2026-05-12T09:00:00"
    }
  ]
}
```

`pin_hash` 자체는 응답에 노출하지 않는다. `has_pin` 불리언만.

#### `GET /admin/players/{id}`

단일 플레이어. 동일 스키마.

### 6.3 수정

#### `PATCH /admin/players/{id}`

Body (모든 필드 선택):
```json
{
  "best_score": 32500,
  "best_stage": 10,
  "best_combo": 55,
  "play_count": 7,
  "is_active": false
}
```

서버 검증: `best_score ≤ MAX_SCORE`, `best_stage ≤ MAX_STAGE`, `best_combo ≤ MAX_COMBO`, `play_count ≥ 0`.

Response 200: 갱신된 플레이어. 404: 미존재.

### 6.4 PIN 초기화

#### `POST /admin/players/{id}/reset-pin`

`pin_hash = NULL` 갱신. 다음 로그인 시 사용자가 입력한 PIN이 자동 설정됨 (기존 `verify_pin` 레거시 분기 재사용).

Response 200: 갱신된 플레이어.

### 6.5 영구 삭제

#### `DELETE /admin/players/{id}`

Body:
```json
{"confirm_nickname": "김서진뚫지마라"}
```

`confirm_nickname`이 실제 닉네임과 일치해야 진행. 불일치 시 400. 일치 시 `DELETE FROM players WHERE id = ...`.

Response 204.

### 6.6 일괄 정리 (선택, MVP 포함)

#### `POST /admin/players/purge-cheaters`

상한 초과 기록을 한 번에 정리. 조건:
- `best_score > MAX_SCORE` OR
- `best_combo > MAX_COMBO` OR
- `best_stage > MAX_STAGE`

기본 동작: 위 플레이어의 `best_score/best_stage/best_combo`를 0으로 리셋하고 `is_active=false` 처리. (영구 삭제는 하지 않음)

Body:
```json
{"dry_run": true}
```

`dry_run=true`이면 영향 받을 row 목록만 반환, 실제 갱신 안 함.

Response:
```json
{"affected": 2, "items": [...플레이어 요약...]}
```

---

## 7. 프론트엔드

### 7.1 라우팅

기존 `currentScreen` state 기반. `Screen` union에 `'admin'` 추가. URL 진입 지원을 위해:

```ts
// App.tsx 마운트 시 1회
useEffect(() => {
  const checkHash = () => {
    if (window.location.hash === '#admin') setCurrentScreen('admin')
  }
  checkHash()
  window.addEventListener('hashchange', checkHash)
  return () => window.removeEventListener('hashchange', checkHash)
}, [])
```

`/#admin` 으로 진입. 페이지를 떠나면 hash 제거.

### 7.2 컴포넌트 구조

단일 파일 `src/pages/AdminPage.tsx`:

```
AdminPage
├── (token 없음) LoginForm
│   └── username / password input + Submit
└── (token 있음) AdminConsole
    ├── Toolbar (검색 input, active 필터, "치트 일괄 정리" 버튼)
    ├── PlayerTable (DaisyUI table)
    │   └── 각 row: id · nickname · score · stage · combo · play · has_pin · is_active · 액션 버튼들
    │       └── 액션: [수정] [PIN초기화] [비활성/활성] [영구삭제]
    ├── Pagination
    └── Modals
        ├── EditPlayerModal (score/stage/combo/play_count 수정)
        ├── ConfirmModal (PIN초기화, 비활성, 일괄정리 확인)
        └── HardDeleteModal (닉네임 재입력 확인)
```

DaisyUI 컴포넌트: `table`, `btn`, `input`, `modal`, `toast`, `badge`, `join`(페이지네이션).

### 7.3 상태 관리

- `token: string | null` — localStorage `admin_token`과 동기화
- `players: AdminPlayer[]`, `total: number`, `page: number`
- `searchQuery, activeFilter, sortField` — 쿼리 컴포지션
- `selectedPlayer: AdminPlayer | null` — 모달 대상
- `loading, error`

`useReducer`로 묶지 않고 `useState` 다중. 페이지 1개 한정이라 충분.

### 7.4 adminApi.ts

```ts
const API = import.meta.env.VITE_API_BASE_URL
const TOKEN_KEY = 'admin_token'

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? {Authorization: `Bearer ${t}`} : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {})},
  })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const adminApi = {
  login(username: string, password: string) { ... },
  listPlayers(query: ListQuery) { ... },
  updatePlayer(id: number, patch: Partial<AdminPlayer>) { ... },
  resetPin(id: number) { ... },
  deletePlayer(id: number, confirmNickname: string) { ... },
  purgeCheaters(dryRun: boolean) { ... },
}
```

### 7.5 시작 화면에서의 진입점

플레이어가 볼 필요 없도록 **명시적 링크 노출하지 않는다**. 직접 `/#admin` 입력만 허용.

---

## 8. 보안

### 8.1 위협 모델

- T1: 무차별 대입(brute force) → 8.2
- T2: 토큰 탈취(XSS) → 8.3
- T3: CSRF → 토큰을 헤더로 전송하므로 자동 미적용. 추가 대책 없음.
- T4: 응답으로 `pin_hash` 노출 → §6.2에서 명시적 제외

### 8.2 무차별 대입 방어

`POST /admin/login` 실패에 대해 IP 단위 in-memory rate-limit (1분 5회 초과 시 429). 1인 운영 + 비밀번호 충분히 강하다는 전제로 DB 저장형은 도입 안 함. (Out of Scope)

### 8.3 토큰 저장

localStorage 사용. XSS가 곧 토큰 탈취가 됨을 인지. 본 프로젝트의 admin 페이지는 정적 React 빌드 + 외부 사용자 입력 렌더링이 없어 XSS 표면이 적다. 그래도 HTTP-only cookie로 전환은 후속 과제. (Out of Scope)

### 8.4 평문 비번 노출 사고 대응

`Kimchi123@`이 git history(이제 force-push로 scrubbed)에 한때 평문으로 존재. 본 설계는 `ADMIN_PASSWORD`를 **반드시 다른 값으로 회전**하는 것을 권장. 단 사용자 결정에 따라 비밀번호 회전은 보류된 상태이므로, 본 설계는 **현 비밀번호를 그대로 사용**한다.

---

## 9. 운영 적용 절차

1. **로컬 개발**
   - `backend/.env`에 `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `JWT_EXP_HOURS` 추가 (완료됨, JWT는 신규)
   - `uvicorn src.main:app --reload` 실행 시 `is_active` 컬럼 자동 추가됨
2. **운영 DB 마이그레이션**
   - 시놀로지 PostgreSQL 컨테이너에 접속해 1회 실행:
     ```sql
     ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
     ```
3. **GitHub Secret 갱신** (단일 secret)
   - `BACKEND_ENV_FILE` 통째 갱신 — 위 5가지 환경변수 포함된 새 내용
4. **배포**
   - `/changelog-deploy` → 백엔드/프론트 CICD 트리거
5. **검증**
   - `https://suh-project.synology.me:8001/admin/players?active=true` 호출 (Authorization 헤더 포함) → 정상 응답
   - 프론트 `/#admin` 진입 → 로그인 폼 → 정상 로그인 → 테이블 표시
   - "치트 일괄 정리" dry_run → 2건 영향 확인 → 실제 실행

---

## 10. 테스트 계획

### 10.1 단위 (백엔드)

- `admin_service.verify_credentials` — 정상/실패 케이스
- `admin_service.create_token` / `verify_token` — round-trip, 만료, 변조
- `admin_service.update_player` — 상한 검증
- `admin_service.delete_player` — confirm_nickname 미일치 시 거부

### 10.2 통합 (백엔드)

- `POST /admin/login` 정상·실패
- `GET /admin/players` 인증 누락 → 401
- 비활성 플레이어 → `GET /ranking`에 미노출
- 비활성 닉네임 신규 등록 시도 → 409

### 10.3 수동 (E2E)

§9 절차의 검증 단계.

---

## 11. 위험·결정 사항

| # | 위험·결정 | 결정 |
|---|---|---|
| R1 | 알렘빅 미사용 → 운영 DB 컬럼 추가 자동화 안 됨 | 1회 수동 ALTER로 처리, 기존 패턴 유지 |
| R2 | JWT 비밀키 환경변수 분실 시 기존 토큰 무효화 | 의도된 동작. 비밀키 회전 = 강제 재로그인 |
| R3 | localStorage 토큰 — XSS 시 탈취 | 본 페이지에 XSS 표면 적음. 후속 과제 |
| R4 | 1인 관리자 — 다중 관리자 미지원 | YAGNI, 향후 확장 가능 |
| R5 | `ADMIN_PASSWORD` 비밀번호 회전 미수행 (사용자 결정) | 운영자 책임으로 위임. 의심 접속 모니터링 권장 |

---

## 12. 후속 과제 (Out of Scope, 후일 검토)

- IP rate-limit DB 저장형
- HTTP-only cookie 기반 세션
- 다중 관리자 + RBAC
- 감사 로그 테이블 (`admin_audit`)
- 가입·삭제 통계 대시보드 카드
