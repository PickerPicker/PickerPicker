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
DATABASE_URL=postgresql+asyncpg://kimchi:Kimchi123@@suh-project.synology.me:5430/pickerpicker
ENVIRONMENT=dev
API_KEY=
```

> `.env` 파일은 gitignore 처리됨. 절대 커밋 금지.

## 백엔드 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/players/check/{nickname}` | 닉네임 존재 여부 (기존/신규 구분) |
| POST | `/players` | 신규 플레이어 등록 |
| GET | `/players/{nickname}` | 플레이어 역대 최고 기록 조회 |
| POST | `/players/result` | 게임 결과 저장 (최고값만 갱신) |
| GET | `/ranking` | best_score 기준 상위 랭킹 |
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

## 개발 워크플로우

### 표준 작업 순서

```
1. 이슈 생성    → /issue
2. 코드 작업    → 구현
3. 커밋         → /commit  (이슈 번호 자동 연결)
4. 푸시         → git push origin main
5. 배포         → /changelog-deploy
```

### 커밋 메시지 형식

```
{작업 내용} : feat|fix|docs : {변경사항 설명} {이슈URL}
```

예시:
```
백엔드 게임 결과 저장 API : feat : Player 모델 확장, save_game_result 구현 https://github.com/PickerPicker/PickerPicker/issues/14
```

### 배포 흐름

```
main push
  → VERSION-CONTROL (버전 자동 증가)
  → PROJECT-REACT-CI (프론트 빌드 검증)
  → PROJECT-PYTHON-CI (백엔드 Docker 빌드 검증)

/changelog-deploy 실행
  → main → deploy PR 생성
  → 릴리스 노트 작성
  → AUTO-CHANGELOG-CONTROL automerge
  → PROJECT-REACT-CICD (프론트 배포, 포트 3010)
  → PROJECT-PYTHON-SYNOLOGY-CICD (백엔드 배포, 포트 8001)
```

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
