# PickerPicker — CLAUDE.md

## 프로젝트 구조

```
PickerPicker/
  src/                     # React 프론트엔드 (Vite + TypeScript + DaisyUI)
  backend/                 # FastAPI 백엔드 (Python 3.13)
  docs/design/             # 게임 설계 문서 (플로우, 판정, 데이터셋 등)
  docs/suh-template/issue/ # 이슈 파일 로컬 저장소
  .github/workflows/       # CI/CD 파이프라인
```

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19, Vite, TypeScript, DaisyUI (Tailwind) |
| 백엔드 | FastAPI, SQLAlchemy (asyncpg), pydantic-settings |
| DB | PostgreSQL (시놀로지 NAS, 포트 5430) |
| 배포 | 시놀로지 NAS Docker, DockerHub |

## 환경 변수

### 프론트엔드 (`.env`)
```
VITE_API_BASE_URL=http://suh-project.synology.me:8001   # 실서버
# VITE_API_BASE_URL=http://localhost:8000               # 로컬
```

### 백엔드 (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://<DB_USER>:<DB_PASSWORD>@suh-project.synology.me:5430/pickerpicker
ENVIRONMENT=dev
API_KEY=
```

> `.env` 파일은 gitignore 처리됨. 절대 커밋 금지.

## 백엔드 API

**인증** 열의 의미:
- `HMAC` — HMAC 서명만 필요 (누구나 호출 가능)
- `Bearer` — HMAC + 세션 토큰 필수. 경로/본문의 닉네임이 토큰 소유자와 다르면 403
- `Admin` — HMAC + 어드민 토큰 필수
- `없음` — 서명 검증 제외(`_PUBLIC_PATHS`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/players/check/{nickname}` | HMAC | 닉네임 존재 여부 (기존/신규 구분) |
| POST | `/players` | HMAC | 신규 플레이어 등록 |
| POST | `/players/verify-pin` | HMAC | PIN 검증 (토큰 미발급 — 로그인은 `/auth/login` 사용) |
| GET | `/players/{nickname}` | HMAC | 플레이어 역대 최고 기록 조회 |
| POST | `/players/result` | **Bearer** | 게임 결과 저장 (세션 INSERT + 최고값/일별 집계 UPSERT) |
| PATCH | `/players/{nickname}/stats-visibility` | **Bearer** | 통계 공개/비공개 전환 |
| PATCH | `/players/{nickname}/tutorial-seen` | **Bearer** | 튜토리얼 시청 완료 표시 |
| GET | `/players/{nickname}/stats` | **Bearer** | 본인 종합 통계 (habit·약점단어 포함) |
| GET | `/players/{nickname}/sessions?days=30` | **Bearer** | 본인 일별 시계열 |
| GET | `/players/{nickname}/public-stats` | HMAC | 공개 요약 통계 (비공개 설정 시 `is_public:false`) |
| POST | `/auth/login` | HMAC | PIN 검증 후 세션 토큰 발급 (30일 TTL) |
| POST | `/auth/logout` | HMAC | 세션 토큰 폐기 |
| GET | `/ranking` | HMAC | best_score 기준 상위 랭킹 |
| GET | `/hall-of-fame` | HMAC | 명예의 전당 목록 |
| PATCH | `/hall-of-fame/motto` | **Bearer** | 한마디 수정 (1위 경험자만, 아니면 403) |
| POST | `/games/start` | HMAC | 본게임 단어 15개 추첨 |
| POST | `/practice/start` | HMAC | 연습모드 단어 3개 추첨 |
| GET | `/stats/global` | HMAC | 전체 통계 (5분 캐시) |
| POST | `/admin/login` 외 `/admin/*` | Admin | 어드민 콘솔 (단어 CRUD·통계) |
| GET | `/health` | 없음 | 헬스체크 |
| GET | `/docs` | 없음 | Swagger UI |

## 배포 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | `http://suh-project.synology.me:3010` |
| 백엔드 | `http://suh-project.synology.me:8001` |
| Swagger | `http://suh-project.synology.me:8001/docs` |

## GitHub Secrets (필수)

| Secret | 설명 |
|--------|------|
| `BACKEND_ENV_FILE` | 백엔드 `backend/.env` 전체 내용 (빌드 및 런타임 `.env` 파일 생성용) |
| `DOCKERHUB_USERNAME` | DockerHub 사용자명 |
| `DOCKERHUB_TOKEN` | DockerHub 액세스 토큰 |
| `SERVER_HOST` | 시놀로지 호스트 |
| `SERVER_USER` | SSH 사용자명 |
| `SERVER_PASSWORD` | SSH 비밀번호 |
| `PROJECT_DEPLOY_PORT` | 프론트 배포 포트 (3010) |

## 협업 기본 Flow (필수 준수)

모든 작업은 아래 순서대로 진행한다. 각 단계는 건너뛰지 않는다.

### 사용 스킬 고정 (필수)

이 레포의 이슈·커밋·배포는 **아래 스킬로만** 수행한다. `gh` CLI나 수동 조작으로 대체하지 않는다.

| 작업 | 스킬 | 비고 |
|------|------|------|
| 이슈 생성·조회·수정·댓글·라벨, PR 생성/머지, Actions Secret | `/pro-github` | PAT 기반이라 gh 로그인 불필요 |
| 커밋 | `/pro-commit` | 브랜치명에서 이슈 번호 자동 추출 |
| 배포 | `/pro-changelog-deploy` | deploy PR → 릴리스 노트 → automerge |
| 구현 보고서 | `/pro-report` | 이슈 댓글 등록 |
| QA 테스트케이스 | `/pro-testcase` | 이슈 댓글 등록 |

**모든 변경사항은 반드시 이슈를 먼저 등록한 뒤 착수한다.** 검수·리팩터링처럼 여러 영역에
걸치는 작업은 영역별로 이슈를 분할해 등록하고, 각 이슈 단위로 커밋한다.

### 1) 이슈 확인 / 생성

- 기존 이슈가 있으면 번호 확인 (예: `#40`)
- 없으면 `/pro-github` 로 생성
- 이슈에는 SUH-LAB 가이드 댓글이 자동 작성되어 **브랜치명**과 **커밋 메시지 템플릿** 제공됨

### 2) 원인 분석 (코드 수정 전 필수)

**버그/이슈는 먼저 근본 원인부터 찾는다. 추측 금지.**

- FE/BE 경계 확인: 어느 레이어에서 데이터가 변형/소실되는지 추적
- 증거 표 작성:
  | 레이어 | 상태 |
  |--------|------|
  | 백엔드 DB 동작 | ✓ / ✗ |
  | 백엔드 API 응답 | ✓ / ✗ |
  | FE 수신 처리 | ✓ / ✗ |
  | FE 렌더 | ✓ / ✗ |
- DB 변경 필요 여부 명확히 판정 (스키마 변경 시 마이그레이션 별도)

### 3) 수정안 제시 → 사용자 승인

- 최소 수정 vs 정리 포함 옵션 둘 다 제시
- 승인 후 진행. 단독 진행 금지

### 4) 코드 작업 + 검증

- 구현 후 `npx -p typescript tsc --noEmit` (FE) 또는 백엔드 빌드 확인
- 잔여 참조 검색 (`grep`)

### 5) 커밋

`/pro-commit` 사용.

**커밋 메시지 형식**:
```
{이슈 제목} : feat|fix|docs|refactor|chore : {변경사항 요약} https://github.com/PickerPicker/PickerPicker/issues/{번호}
```

예시:
```
게임 화면 playCount가 DB 값이 아닌 로컬 실행 횟수로 표시되는 문제 : fix : 서버 응답 play_count를 진실 소스로 사용, 랭킹 화면에 플레이 횟수 컬럼 추가 https://github.com/PickerPicker/PickerPicker/issues/40
```

### 6) 푸시

```bash
git push origin main
```

자동 트리거:
- `VERSION-CONTROL` (patch 버전 자동 증가, 태그 생성)
- `PROJECT-REACT-CI` (프론트 빌드 검증)
- `PROJECT-PYTHON-CI` (백엔드 Docker 빌드 검증)

### 7) 배포

`/pro-changelog-deploy` 실행.

흐름:
```
main → deploy PR 생성 (예: #60)
  → 릴리스 노트 즉시 작성 (클라이언트 관점, 파일명/prefix 금지)
  → AUTO-CHANGELOG-CONTROL 워크플로우가 "Summary by CodeRabbit" 감지
  → CHANGELOG.md 업데이트
  → automerge → deploy 브랜치
  → PROJECT-REACT-CICD (프론트 배포, 포트 3010)
  → PROJECT-PYTHON-SYNOLOGY-CICD (백엔드 배포, 포트 8001)
```

automerge 실패 시: `/pro-changelog-deploy` fix 모드로 재실행 (기존 PR 닫고 새 PR 생성).

### 8) 이슈 마무리

**작업 완료 후 반드시 다음 세 가지 수행:**

1. **`/pro-report` 스킬로 구현 보고서 작성 → 이슈 댓글 등록**
   - Git diff + 이슈 분석 기반 자동 생성
   - `Closes #{이슈번호}` 명시
2. **`/pro-testcase` 스킬로 QA 테스트케이스 작성 → 이슈 댓글 등록**
   - 이슈 분석 기반 테스트 체크리스트 생성
3. **이슈 라벨 변경**: `작업중` → `작업완료` (`/pro-github`)
   - 기존 라벨 (예: `긴급`) 은 유지

### 라벨 체계

| 라벨 | 의미 |
|------|------|
| `작업전` | 미착수 |
| `작업중` | 진행 중 |
| `작업완료` | 작업 + 배포 완료 |
| `긴급` | 우선 처리 필요 |
| `보류` | 일시 중단 |
| `취소` | 중단 |
| `담당자확인` | 담당자 결정 대기 |
| `피드백` | 사용자 피드백 반영 필요 |
| `문서` | 문서 작업 |

## 로컬 실행

```bash
# 프론트엔드
npm run dev

# 백엔드 (로컬 DB 필요 시 docker-compose 사용)
cd backend
uv pip install --system .
uvicorn src.main:app --reload

# 전체 (FE + BE + PostgreSQL)
docker-compose up
```

## 게임 설계 참고

- `docs/design/01_게임_진행_플로우.md` — 전체 플로우, 화면 상태
- `docs/design/04_판정_게이지_점수_시스템.md` — PERFECT/GOOD/MISS 판정
- `docs/design/05_스테이지_데이터_구조.md` — 스테이지 JSON 스키마
- `docs/design/06_스테이지_데이터셋.md` — 1~15 스테이지 데이터
- `backend/src/data/rhythm_stages_001_015.json` — 완성된 스테이지 데이터셋 (자동 시드 소스)
  > backend 패키지 안에 둔다. Docker 이미지가 `backend/` 하위만 복사하므로 밖에 있으면 시드가 실패한다.

## 주의사항

- `git push --force` 사용 금지
- `.env` / `backend/.env` 절대 커밋 금지
- 파일 삭제 시 반드시 사용자 확인
- DB는 시놀로지 NAS PostgreSQL 컨테이너 사용 (포트 5430)
- 백엔드 컨테이너는 bridge 네트워크, DB 접근은 `suh-project.synology.me:5430` 외부 도메인으로 함 (`--network host` 사용 안 함)

## API 인증 — HMAC-SHA256

**모든 API 엔드포인트는 HMAC 서명 필수.** 신규 엔드포인트 추가 시 절대 `_PUBLIC_PATHS`에 넣지 않는다.

### 공개 경로 (`_PUBLIC_PATHS`) 예외 기준

`backend/src/main.py`의 `_PUBLIC_PATHS`는 **서버 자체 운영용**만 허용:

```python
_PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}
```

- `/health` — 헬스체크 (Docker/시놀로지 모니터링)
- `/docs`, `/redoc`, `/openapi.json` — Swagger UI

**게임 기능 엔드포인트는 모두 HMAC 대상** — `/ranking`, `/hall-of-fame`, `/players/*`, `/auth/*`, `/stats/*` 등 전부 포함.

### 서명 대상 (FE/BE 반드시 일치)

```
message = timestamp \n METHOD \n path \n query \n sha256(body)
X-Signature = HMAC-SHA256(SECRET_KEY, message)
```

- `path` — 퍼센트 **디코딩된** 경로 (백엔드 ASGI `scope["path"]` 기준). FE는 `decodeURIComponent(pathname)`
- `query` — `?` 제외한 쿼리스트링. 없으면 빈 문자열
- `body` — 요청 본문 문자열. 없으면 빈 문자열의 SHA-256

조립 위치: BE `backend/src/main.py` `build_signature_message()` / FE `src/services/authService.ts` `buildSignatureMessage()`.
**한쪽만 고치면 전 API가 401이 된다.** 반드시 같이 수정한다.

> timestamp만 서명하던 이전 방식은 서명 1개로 5분간 모든 경로·본문을 호출할 수 있었다.

### FE 호출 방식

`src/services/authService.ts`의 `apiFetch()` 사용 필수. 직접 `fetch()`/`axios` 금지.  
`apiFetch`가 `X-Signature` + `X-Timestamp` + `Authorization` 헤더를 자동 부착.  
어드민은 `src/services/adminApi.ts`의 `adminFetch()` 사용 (서명은 `signatureHeaders()`로 공유, 토큰만 별도).

### BE 로컬 테스트 시

컨테이너 내부에서 `curl`/`wget`으로 직접 호출하면 HMAC 헤더 없어서 401 정상. 실제 오류가 아님.  
API 동작 확인은 FE 또는 서명 헤더 직접 생성 후 테스트.

### DB 스키마 변경 시 주의

SQLAlchemy `create_all`은 기존 테이블 컬럼 추가 안 함. 컬럼 추가 시 반드시 수동 ALTER 필요:

```bash
# 시놀로지 백엔드 컨테이너 내부에서 asyncpg로 실행
docker exec pickerpicker-back python3 -c "
import asyncio, asyncpg
async def run():
    conn = await asyncpg.connect('postgresql://...')
    await conn.execute('ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...')
    await conn.close()
asyncio.run(run())
"
```

## GitHub Actions YAML 규칙

- **`run:` 블록에서 `${{ secrets.* }}`를 heredoc(`<< 'EOF'` / `<< EOF`) 안에 직접 넣지 않는다** — YAML 파서 오류 발생
- secrets를 multiline으로 파일에 써야 할 때: `env:` 섹션에서 환경변수로 받고 (`BACKEND_ENV_FILE: ${{ secrets.BACKEND_ENV_FILE }}`), `appleboy/ssh-action`은 `envs: BACKEND_ENV_FILE` 추가 후 script에서 `$BACKEND_ENV_FILE`로 사용
- 기존 배포 로직(`PROJECT-PYTHON-CICD.yaml`) 구조는 변경하지 않는다
