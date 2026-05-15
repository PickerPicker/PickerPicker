---
title: "⚙️[기능추가][Backend] Python FastAPI 백엔드 서버 구축 (PostgreSQL 연동)"
labels: [작업전]
assignees: [Cassiiopeia]
---

📝 현재 문제점
---

- 게임 플레이어 닉네임 확인, 랭킹 조회 등 서버 기능 없음
- 프론트엔드(React)에서 실제 데이터를 처리할 API 서버 부재
- 배포 환경(시놀로지 NAS Docker)에 맞는 백엔드 인프라 없음

🛠️ 해결 방안 / 제안 기능
---

- `backend/` 디렉토리에 FastAPI 기반 REST API 서버 구축
- PostgreSQL 비동기 연동 (SQLAlchemy asyncpg)
- 플레이어 닉네임 존재 여부 확인 API (기존/신규 구분)
- 플레이어 생성, 조회, 점수 갱신 API
- 랭킹 조회 API (상위 N명)
- Docker 컨테이너화 및 docker-compose 로컬 개발 환경 구성
- GitHub Actions CI/CD 파이프라인 (`backend/` 변경 시 자동 빌드·배포)

⚙️ 작업 내용
---

- `backend/src/main.py` — FastAPI 앱 진입점 (CORS, lifespan, 미들웨어)
- `backend/src/core/` — config(pydantic-settings), database(SQLAlchemy async), logging, exceptions
- `backend/src/models/player.py` — Player ORM 모델 (nickname, score)
- `backend/src/services/player_service.py` — 닉네임 확인/생성/조회/점수갱신 비즈니스 로직
- `backend/src/apis/player_router.py` — 플레이어 REST 엔드포인트
- `backend/src/apis/ranking_router.py` — 랭킹 엔드포인트
- `backend/Dockerfile` — Python 3.13 슬림 이미지 기반
- `docker-compose.yml` — FE + BE + PostgreSQL 로컬 통합 환경
- `.github/workflows/PROJECT-PYTHON-CICD.yaml` — `backend/**` 변경 감지 자동 배포

🙋‍♂️ 담당자
---

- 백엔드: 이름
- 프론트엔드: 이름
- 디자인: 이름
