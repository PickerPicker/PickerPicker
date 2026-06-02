# DB 마이그레이션 운영 가이드

PickerPicker 백엔드는 Alembic으로 DB 스키마를 관리한다.

## 최초 도입 시 (기존 운영 DB)

기존 테이블이 이미 존재하므로 baseline은 실행하지 않고 stamp만 처리:

```bash
docker exec pickerpicker-back uv run alembic stamp 0001_baseline
```

그 후 다음 revision부터 적용:

```bash
docker exec pickerpicker-back uv run alembic upgrade head
```

## 신규 revision 만들기

```bash
cd backend
uv run alembic revision --autogenerate -m "변경 요약"
```

생성된 파일을 `0NNN_*.py` 형식으로 rename. revision/down_revision 식별자 수동 확인.

## 현재 revision 확인

```bash
docker exec pickerpicker-back uv run alembic current
```

## 다운그레이드

```bash
docker exec pickerpicker-back uv run alembic downgrade -1
```

## 자동 적용

`backend/scripts/run_migrations.sh`가 Docker entrypoint에서 자동 실행됨. 컨테이너 시작 시:
1. `alembic upgrade head` (멱등)
2. uvicorn 기동
