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

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/players/check/{nickname}` | 닉네임 존재 여부 (기존/신규 구분) |
| POST | `/players` | 신규 플레이어 등록 |
| POST | `/players/verify-pin` | PIN 검증 |
| GET | `/players/{nickname}` | 플레이어 역대 최고 기록 조회 |
| POST | `/players/result` | 게임 결과 저장 (세션 INSERT + 최고값/일별 집계 UPSERT) |
| GET | `/players/{nickname}/stats` | 본인 종합 통계 (Bearer 토큰 필수) |
| GET | `/players/{nickname}/sessions?days=30` | 본인 일별 시계열 (Bearer 토큰 필수) |
| POST | `/auth/login` | PIN 검증 후 세션 토큰 발급 (24h TTL) |
| POST | `/auth/logout` | 세션 토큰 폐기 |
| GET | `/ranking` | best_score 기준 상위 랭킹 |
| GET | `/stats/global` | 전체 통계 (5분 캐시, 공개) |
| GET | `/health` | 헬스체크 |
| GET | `/docs` | Swagger UI |

## 배포 URL

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | `http://suh-project.synology.me:3010` |
| 백엔드 | `http://suh-project.synology.me:8001` |
| Swagger | `http://suh-project.synology.me:8001/docs` |

## GitHub Secrets (필수)

| Secret | 설명 |
|--------|------|
| `BACKEND_DATABASE_URL` | `postgresql+asyncpg://...localhost:5430/pickerpicker` |
| `BACKEND_ENV_FILE` | 백엔드 `.env` 전체 내용 (CI 빌드 검증용) |
| `DOCKERHUB_USERNAME` | DockerHub 사용자명 |
| `DOCKERHUB_TOKEN` | DockerHub 액세스 토큰 |
| `SERVER_HOST` | 시놀로지 호스트 |
| `SERVER_USER` | SSH 사용자명 |
| `SERVER_PASSWORD` | SSH 비밀번호 |
| `PROJECT_DEPLOY_PORT` | 프론트 배포 포트 (3010) |

## 협업 기본 Flow (필수 준수)

모든 작업은 아래 순서대로 진행한다. 각 단계는 건너뛰지 않는다.

### 1) 이슈 확인 / 생성

- 기존 이슈가 있으면 번호 확인 (예: `#40`)
- 없으면 `/issue` 로 생성
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

`/commit` 사용 또는 수동.

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

`/changelog-deploy` 실행.

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

automerge 실패 시: `/changelog-deploy` fix 모드로 재실행 (기존 PR 닫고 새 PR 생성).

### 8) 이슈 마무리

**작업 완료 후 반드시 다음 세 가지 수행:**

1. **`/report` 스킬로 구현 보고서 작성 → 이슈 댓글 등록**
   - Git diff + 이슈 분석 기반 자동 생성
   - `Closes #{이슈번호}` 명시
2. **`/testcase` 스킬로 QA 테스트케이스 작성 → 이슈 댓글 등록**
   - 이슈 분석 기반 테스트 체크리스트 생성
3. **이슈 라벨 변경**: `작업중` → `작업완료`
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
- `docs/rhythm_stages_001_015.json` — 완성된 스테이지 데이터셋

## 주의사항

- `git push --force` 사용 금지
- `.env` / `backend/.env` 절대 커밋 금지
- 파일 삭제 시 반드시 사용자 확인
- DB는 시놀로지 NAS PostgreSQL 컨테이너 사용 (포트 5430)
- 백엔드 컨테이너는 `--network host` 옵션으로 실행 (localhost로 DB 접근)
