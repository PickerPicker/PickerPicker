# 동적 단어 풀 + Admin 콘솔 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단어 데이터를 정적 JSON에서 DB로 이전하고, admin이 화면에서 단어 풀을 동적으로 관리하며, 매 플레이마다 단어를 추첨하고, 단어별 통계를 추적·노출한다.

**Architecture:** Alembic 도입으로 마이그레이션 관리, 5개 신규 테이블(words/admins/admin_sessions/word_stats/session_word_results), 신규 admin API + 게임 추첨 API, 신규 FE admin 화면 + 기존 게임 흐름 전환. 모든 admin 엔드포인트 = HMAC + admin Bearer 이중 인증, 단어 추첨은 백엔드 단독 권한.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + asyncpg / React 19 + Vite + TypeScript + DaisyUI / PostgreSQL 16

**관련:**
- Spec: `docs/superpowers/specs/2026-06-02-dynamic-word-pool-admin-design.md`
- 이슈: [#133 메인](https://github.com/PickerPicker/PickerPicker/issues/133), [#134 Alembic](https://github.com/PickerPicker/PickerPicker/issues/134), [#135 플레이어 관리(후속)](https://github.com/PickerPicker/PickerPicker/issues/135)

**PR 분할:**

| Phase | PR | 범위 | 이슈 |
|-------|-----|------|------|
| 1 | PR-A | Alembic 도입 + 기존 5개 테이블 BigInt 통일 | #134 |
| 2 | PR-B | 신규 테이블 5개 + admin API + 시드 + 단어 추첨 | #133 |
| 3 | PR-C | FE /admin 화면 | #133 |
| 4 | PR-D | 게임 흐름 전환 (FE+BE 동시) | #133 |
| 5 | PR-E | GameOver 가로 2단 + Stats 단어 섹션 | #133 |

각 Phase 끝에 PR 생성 + 배포 + 검증 → 다음 Phase 시작. **Phase 간 머지 안 된 채로 다음 Phase 시작 금지.**

**커밋 메시지 규약:**
- 형식: `{이슈제목} : {타입} : {요약} https://github.com/PickerPicker/PickerPicker/issues/{번호}`
- 타입: feat | fix | docs | refactor | chore

---

## Phase 1 — PR-A: Alembic 도입 + BigInt 통일

**이슈:** #134

**파일 영향:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/0001_baseline.py`, `backend/alembic/versions/0002_bigint_unification.py`
- Modify: `backend/src/models/player.py`, `backend/src/models/hall_of_fame.py`, `backend/src/main.py`, `backend/Dockerfile`(있을 경우)
- Remove from runtime: `Base.metadata.create_all()` 호출 (Alembic이 대신함)

---

### Task 1: Alembic 초기화

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`, `backend/alembic/versions/`

- [ ] **Step 1: Alembic dependency 확인**

Run: `cat backend/pyproject.toml | grep alembic`
Expected: `"alembic>=1.14.0"` 라인 존재. (이미 dependencies에 있음.)

- [ ] **Step 2: Alembic 초기화**

```bash
cd backend
uv run alembic init alembic
```

자동 생성된 파일: `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/`.

- [ ] **Step 3: `backend/alembic.ini` 수정 — DATABASE_URL 환경변수 사용**

`sqlalchemy.url = driver://user:pass@localhost/dbname` 라인을 비움 (env.py에서 동적으로 주입).

```ini
sqlalchemy.url =
```

- [ ] **Step 4: `backend/alembic/env.py` 수정**

기존 파일 전체를 다음 내용으로 교체:

```python
"""Alembic env. 모델 metadata 기반 autogenerate 지원."""
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from src.core.config import settings
from src.core.database import Base
import src.models  # noqa: F401 — 모든 모델 import

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# pydantic Settings에서 DATABASE_URL 주입
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5: 커밋**

```bash
git add backend/alembic.ini backend/alembic/env.py backend/alembic/script.py.mako backend/alembic/versions/.gitkeep
git commit -m "DB 마이그레이션 도구 Alembic 도입 : chore : alembic init 및 env.py 비동기 마이그레이션 지원 https://github.com/PickerPicker/PickerPicker/issues/134"
```

---

### Task 2: Baseline revision (기존 스키마 캡처)

**Files:**
- Create: `backend/alembic/versions/0001_baseline.py`

- [ ] **Step 1: autogenerate로 baseline revision 생성**

```bash
cd backend
uv run alembic revision --autogenerate -m "baseline"
```

생성된 파일이 `backend/alembic/versions/{hash}_baseline.py` 이름임. 파일명을 `0001_baseline.py`로 rename.

```bash
cd backend/alembic/versions
mv *_baseline.py 0001_baseline.py
```

revision 내부의 `down_revision = None`, `revision = "0001_baseline"`로 수정 (파일 첫 부분):

```python
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
```

- [ ] **Step 2: baseline upgrade 함수 검토**

`upgrade()` 함수에 모든 기존 테이블 CREATE 문이 자동 생성되어 있어야 함 (players, game_sessions, player_sessions, player_stats_daily, hall_of_fame).

- [ ] **Step 3: 운영 DB는 stamp 처리 (실 적용 안 함)**

운영 가이드 문서에 추가 (다음 Task에서):

```bash
# 운영 DB에 이미 테이블 있는 상태에서 baseline 적용 (DB 변경 없음, 마킹만):
alembic stamp 0001_baseline
```

- [ ] **Step 4: 로컬 빈 DB에서 검증**

```bash
# 로컬 빈 PostgreSQL DB 가정
DATABASE_URL=postgresql+asyncpg://localhost/test_pickerpicker uv run alembic upgrade head
```

Expected: 모든 기존 테이블 생성됨. `\dt` 명령으로 확인.

- [ ] **Step 5: 커밋**

```bash
git add backend/alembic/versions/0001_baseline.py
git commit -m "DB 마이그레이션 도구 Alembic 도입 : chore : 0001 baseline revision 추가 https://github.com/PickerPicker/PickerPicker/issues/134"
```

---

### Task 3: BigInt 통일 revision

**Files:**
- Create: `backend/alembic/versions/0002_bigint_unification.py`
- Modify: `backend/src/models/player.py`, `backend/src/models/hall_of_fame.py`

- [ ] **Step 1: 모델에서 Integer → BigInteger 변경**

`backend/src/models/player.py`의 `id` 컬럼:

기존:
```python
id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
```

변경:
```python
id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
```

`from sqlalchemy import` 줄에 `BigInteger` 추가.

`backend/src/models/hall_of_fame.py`의 `id` 컬럼도 동일하게 변경.

- [ ] **Step 2: revision 파일 작성**

```python
"""bigint unification

Revision ID: 0002_bigint_unification
Revises: 0001_baseline
Create Date: 2026-06-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_bigint_unification"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # players.id : Integer → BigInteger
    op.execute("ALTER TABLE players ALTER COLUMN id TYPE BIGINT USING id::bigint")
    # players_id_seq도 BIGINT로 (PG 10+에서는 자동, 명시 안전망)
    op.execute("ALTER SEQUENCE players_id_seq AS BIGINT")

    # hall_of_fame.id : Integer → BigInteger
    op.execute("ALTER TABLE hall_of_fame ALTER COLUMN id TYPE BIGINT USING id::bigint")
    op.execute("ALTER SEQUENCE hall_of_fame_id_seq AS BIGINT")

    # player_sessions, player_stats_daily는 정수 PK 없음 (토큰/복합키) — 변경 불필요
    # game_sessions.id는 이미 BigInteger


def downgrade() -> None:
    op.execute("ALTER TABLE hall_of_fame ALTER COLUMN id TYPE INTEGER USING id::integer")
    op.execute("ALTER SEQUENCE hall_of_fame_id_seq AS INTEGER")
    op.execute("ALTER TABLE players ALTER COLUMN id TYPE INTEGER USING id::integer")
    op.execute("ALTER SEQUENCE players_id_seq AS INTEGER")
```

- [ ] **Step 3: 로컬 검증**

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://localhost/test_pickerpicker uv run alembic upgrade head
# 확인:
psql -d test_pickerpicker -c "\d players"
# id 컬럼 = bigint 이어야 함
```

- [ ] **Step 4: 다운그레이드 검증**

```bash
DATABASE_URL=postgresql+asyncpg://localhost/test_pickerpicker uv run alembic downgrade -1
psql -d test_pickerpicker -c "\d players"
# id 컬럼 = integer로 돌아옴
DATABASE_URL=postgresql+asyncpg://localhost/test_pickerpicker uv run alembic upgrade head
```

- [ ] **Step 5: 커밋**

```bash
git add backend/alembic/versions/0002_bigint_unification.py backend/src/models/player.py backend/src/models/hall_of_fame.py
git commit -m "DB 마이그레이션 도구 Alembic 도입 : refactor : 기존 테이블 id BigInteger 통일 (players, hall_of_fame) https://github.com/PickerPicker/PickerPicker/issues/134"
```

---

### Task 4: 운영 적용 — main.py에서 create_all 제거 + Docker entrypoint에 upgrade head 추가

**Files:**
- Modify: `backend/src/main.py`
- Modify: `backend/Dockerfile` (있을 경우)
- Create: `backend/scripts/run_migrations.sh` (entrypoint helper)

- [ ] **Step 1: `backend/src/main.py` 변경**

`lifespan` 함수에서 `Base.metadata.create_all` 호출 제거. 대신 alembic 적용 여부만 로깅.

기존 (42-46행):
```python
try:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("DB 테이블 준비 완료")
except Exception as e:
    logger.warning(f"DB 초기 연결 실패 (서버는 계속 실행): {e}")
```

변경:
```python
try:
    async with engine.begin() as conn:
        # 연결만 검증 (마이그레이션은 entrypoint에서 alembic upgrade head로 적용)
        await conn.execute(sa.text("SELECT 1"))
    logger.info("DB 연결 확인 완료")
except Exception as e:
    logger.warning(f"DB 초기 연결 실패 (서버는 계속 실행): {e}")
```

상단 import 추가: `import sqlalchemy as sa`.

- [ ] **Step 2: `backend/scripts/run_migrations.sh` 작성**

```bash
#!/bin/sh
set -e
cd /app/backend
uv run alembic upgrade head
```

권한: `chmod +x backend/scripts/run_migrations.sh`.

- [ ] **Step 3: Dockerfile 확인 및 수정**

```bash
cat backend/Dockerfile
```

CMD/ENTRYPOINT 직전에 `RUN alembic upgrade head` 또는 entrypoint script 호출 추가. 예:

```dockerfile
COPY backend/scripts/run_migrations.sh /run_migrations.sh
RUN chmod +x /run_migrations.sh
ENTRYPOINT ["/bin/sh", "-c", "/run_migrations.sh && exec uvicorn src.main:app --host 0.0.0.0 --port 8000"]
```

Dockerfile이 없거나 다른 패턴이면 docker-compose.yml 검토 후 적절히 적용.

- [ ] **Step 4: 운영 DB stamp 가이드 README 추가**

`backend/README.md` 또는 새로 `backend/docs/MIGRATION.md` 작성:

```markdown
# DB 마이그레이션 운영 가이드

## 최초 도입 시 (기존 운영 DB)

기존 테이블이 이미 존재하므로 baseline은 실행하지 않고 stamp만 처리:

\`\`\`bash
docker exec pickerpicker-back uv run alembic stamp 0001_baseline
\`\`\`

그 후 다음 revision부터 적용:

\`\`\`bash
docker exec pickerpicker-back uv run alembic upgrade head
\`\`\`

## 신규 revision 만들기

\`\`\`bash
cd backend
uv run alembic revision --autogenerate -m "변경 요약"
\`\`\`

## 다운그레이드

\`\`\`bash
uv run alembic downgrade -1
\`\`\`
```

- [ ] **Step 5: 로컬 통합 테스트**

```bash
docker-compose down -v
docker-compose up --build
# 백엔드 로그에서 "alembic upgrade head" 성공 + "DB 연결 확인 완료" 모두 보여야 함
curl http://localhost:8000/health  # → {"status":"healthy"}
```

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main.py backend/scripts/run_migrations.sh backend/Dockerfile backend/docs/MIGRATION.md
git commit -m "DB 마이그레이션 도구 Alembic 도입 : feat : entrypoint에서 alembic upgrade head 자동 실행, main.py create_all 제거 https://github.com/PickerPicker/PickerPicker/issues/134"
```

---

### Phase 1 종료 — PR-A 생성 + 머지 + 배포

- [ ] **Step 1: 푸시**

```bash
git push origin main
```

자동 트리거: VERSION-CONTROL, PROJECT-PYTHON-CI.

- [ ] **Step 2: 배포 PR**

```bash
# /changelog-deploy 스킬 또는 수동:
gh pr create --base deploy --head main --title "deploy: Alembic 도입 + BigInt 통일" --body "..."
```

- [ ] **Step 3: 운영 검증**

```bash
# 시놀로지 DB stamp 1회 적용
docker exec pickerpicker-back uv run alembic stamp 0001_baseline
# 백엔드 재배포 시 자동으로 upgrade head 실행 → BigInt 마이그레이션 적용
# 검증:
docker exec pickerpicker-back uv run alembic current
# → 0002_bigint_unification (head) 표시
```

- [ ] **Step 4: 이슈 #134 close (작업완료 라벨)**

`/suh-report`로 보고서 작성 → 이슈 댓글 등록 → 라벨 `작업중` → `작업완료`.

---

## Phase 2 — PR-B: 신규 테이블 + admin API + 시드 + 단어 추첨

**이슈:** #133

**파일 영향:**
- Create: `backend/src/models/word.py`, `backend/src/models/admin.py`, `backend/src/models/admin_session.py`, `backend/src/models/word_stats.py`, `backend/src/models/session_word_result.py`
- Create: `backend/alembic/versions/0003_word_pool_admin_stats.py`
- Create: `backend/src/services/admin_auth_service.py`, `backend/src/services/word_service.py`, `backend/src/services/word_pick_service.py`, `backend/src/services/word_stats_service.py`
- Create: `backend/src/apis/admin_router.py`, `backend/src/apis/games_router.py`
- Create: `backend/src/core/seed.py`
- Create: `backend/src/dependencies/admin_auth.py`
- Modify: `backend/src/models/__init__.py`, `backend/src/main.py`
- Tests: `backend/tests/test_word_pick.py`, `backend/tests/test_admin_auth.py`, `backend/tests/test_word_crud.py`, `backend/tests/test_seed.py`

---

### Task 5: 신규 모델 5개 작성

- [ ] **Step 1: `backend/src/models/word.py` 작성**

```python
"""src.models.word
단어 풀. AI 생성 JSON을 admin이 등록.
"""
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, UniqueConstraint, Index, CheckConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    input_length: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    invalid_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    input_syllables: Mapped[list] = mapped_column(JSONB, nullable=False)
    key_mapping: Mapped[list] = mapped_column(JSONB, nullable=False)
    fixed_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("difficulty_level BETWEEN 1 AND 5", name="ck_words_difficulty_range"),
        UniqueConstraint("fixed_stage", name="uq_words_fixed_stage"),
        Index("idx_words_active_diff", "is_active", "difficulty_level"),
    )
```

- [ ] **Step 2: `backend/src/models/admin.py` 작성**

```python
"""src.models.admin
Admin 계정. bcrypt 해시 비번.
"""
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
```

- [ ] **Step 3: `backend/src/models/admin_session.py` 작성**

```python
"""src.models.admin_session
Admin 인증 세션 토큰. 24h TTL.
"""
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    admin_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("admins.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_admin_sessions_expires", "expires_at"),
    )
```

- [ ] **Step 4: `backend/src/models/word_stats.py` 작성**

```python
"""src.models.word_stats
player × word 단위 누적 통계. UPSERT 대상.
"""
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class WordStats(Base):
    __tablename__ = "word_stats"

    player_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    word_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
    exposure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    perfect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    good_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_played_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_word_stats_word", "word_id"),
    )
```

- [ ] **Step 5: `backend/src/models/session_word_result.py` 작성**

```python
"""src.models.session_word_result
세션별 stage별 raw 결과. 시계열 분석용.
"""
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class SessionWordResult(Base):
    __tablename__ = "session_word_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False)
    word_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("words.id"), nullable=False)
    stage_index: Mapped[int] = mapped_column(Integer, nullable=False)
    perfect_count: Mapped[int] = mapped_column(Integer, nullable=False)
    good_count: Mapped[int] = mapped_column(Integer, nullable=False)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False)
    stage_score: Mapped[int] = mapped_column(Integer, nullable=False)
    played_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_swr_word", "word_id"),
        Index("idx_swr_session", "session_id"),
    )
```

- [ ] **Step 6: `backend/src/models/__init__.py` 갱신**

```python
"""src.models
ORM 모델 패키지. Alembic autogenerate가 신규 테이블을 인식하도록 모두 import.
"""
from src.models.player import Player
from src.models.game_session import GameSession
from src.models.player_stats_daily import PlayerStatsDaily
from src.models.player_session import PlayerSession
from src.models.hall_of_fame import HallOfFame
from src.models.word import Word
from src.models.admin import Admin
from src.models.admin_session import AdminSession
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult

__all__ = [
    "Player", "GameSession", "PlayerStatsDaily", "PlayerSession", "HallOfFame",
    "Word", "Admin", "AdminSession", "WordStats", "SessionWordResult",
]
```

- [ ] **Step 7: 커밋**

```bash
git add backend/src/models/
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : 5개 신규 ORM 모델 추가 (Word/Admin/AdminSession/WordStats/SessionWordResult) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 6: Alembic revision — 신규 테이블 5개 CREATE

**Files:**
- Create: `backend/alembic/versions/0003_word_pool_admin_stats.py`

- [ ] **Step 1: autogenerate**

```bash
cd backend
uv run alembic revision --autogenerate -m "word pool admin stats tables"
mv backend/alembic/versions/*_word_pool_admin_stats.py backend/alembic/versions/0003_word_pool_admin_stats.py
```

생성된 파일 첫 부분 수정:
```python
revision: str = "0003_word_pool_admin_stats"
down_revision: Union[str, None] = "0002_bigint_unification"
```

- [ ] **Step 2: revision 내용 검토**

`op.create_table('words', ...)`, `'admins'`, `'admin_sessions'`, `'word_stats'`, `'session_word_results'` 5개가 모두 들어있는지 확인. `op.create_index` 호출도 들어있어야 함.

- [ ] **Step 3: 로컬 검증**

```bash
DATABASE_URL=postgresql+asyncpg://localhost/test_pickerpicker uv run alembic upgrade head
psql -d test_pickerpicker -c "\dt"
# words, admins, admin_sessions, word_stats, session_word_results 5개 모두 보여야 함
```

- [ ] **Step 4: downgrade 검증**

```bash
uv run alembic downgrade -1
psql -d test_pickerpicker -c "\dt"
# 5개 테이블 사라짐
uv run alembic upgrade head
```

- [ ] **Step 5: 커밋**

```bash
git add backend/alembic/versions/0003_word_pool_admin_stats.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : alembic 0003 — 단어/admin/통계 5개 테이블 추가 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 7: 시드 로직 (words + admins)

**Files:**
- Create: `backend/src/core/seed.py`
- Modify: `backend/src/main.py`
- Modify: `backend/src/core/config.py`

- [ ] **Step 1: `backend/src/core/config.py` 확장**

기존 Settings 클래스에 추가:

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    ENVIRONMENT: str = "dev"
    SECRET_KEY: str = ""

    # Admin 시드
    INITIAL_ADMIN_USERNAME: str = ""
    INITIAL_ADMIN_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
```

- [ ] **Step 2: `backend/pyproject.toml`에 bcrypt 추가**

```toml
dependencies = [
    ...
    "bcrypt>=4.2.0",
]
```

```bash
cd backend && uv sync
```

- [ ] **Step 3: `backend/src/core/seed.py` 작성**

```python
"""src.core.seed
첫 기동 시 자동 시드 — words(rhythm_stages_001_015.json), admins(env).
"""
import json
import logging
from pathlib import Path

import bcrypt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.word import Word
from src.models.admin import Admin

logger = logging.getLogger(__name__)

DATASET_PATH = Path(__file__).resolve().parents[2] / "docs" / "rhythm_stages_001_015.json"


async def seed_words(db: AsyncSession) -> None:
    """words 비어있으면 정적 데이터셋 INSERT. 커피 = fixed_stage=1."""
    count = await db.scalar(select(func.count()).select_from(Word))
    if count and count > 0:
        logger.info(f"words 시드 스킵 — {count}개 존재")
        return

    if not DATASET_PATH.exists():
        logger.warning(f"시드 데이터셋 없음: {DATASET_PATH}")
        return

    with DATASET_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    for stage_data in data["stages"]:
        word = Word(
            word=stage_data["word"],
            difficulty_level=stage_data["difficultyLevel"],
            bpm=stage_data["bpm"],
            input_length=stage_data["inputLength"],
            valid_syllables=stage_data["validSyllables"],
            invalid_syllables=stage_data["invalidSyllables"],
            input_syllables=stage_data["inputSyllables"],
            key_mapping=stage_data["keyMapping"],
            fixed_stage=stage_data["stage"] if stage_data["word"] == "커피" else None,
            is_active=True,
        )
        db.add(word)

    await db.commit()
    logger.info(f"words 시드 완료 — {len(data['stages'])}개 (커피=fixed_stage=1)")


async def seed_admin(db: AsyncSession) -> None:
    """admins 비어있고 env 자격 있으면 INSERT."""
    if not settings.INITIAL_ADMIN_USERNAME or not settings.INITIAL_ADMIN_PASSWORD:
        logger.info("admin 시드 스킵 — env 미설정")
        return

    count = await db.scalar(select(func.count()).select_from(Admin))
    if count and count > 0:
        logger.info(f"admin 시드 스킵 — {count}개 존재")
        return

    password_hash = bcrypt.hashpw(
        settings.INITIAL_ADMIN_PASSWORD.encode(), bcrypt.gensalt()
    ).decode()
    admin = Admin(username=settings.INITIAL_ADMIN_USERNAME, password_hash=password_hash)
    db.add(admin)
    await db.commit()
    logger.info(f"admin 시드 완료 — username={settings.INITIAL_ADMIN_USERNAME}")
```

- [ ] **Step 4: `backend/src/main.py`의 lifespan에 시드 호출 추가**

`lifespan` 함수 안 DB 연결 확인 직후:

```python
from src.core.database import AsyncSessionLocal
from src.core.seed import seed_words, seed_admin

# ... lifespan 내부 ...
try:
    async with engine.begin() as conn:
        await conn.execute(sa.text("SELECT 1"))
    logger.info("DB 연결 확인 완료")

    # 시드 적용
    async with AsyncSessionLocal() as session:
        await seed_words(session)
        await seed_admin(session)
except Exception as e:
    logger.warning(f"DB 초기 연결/시드 실패 (서버는 계속 실행): {e}")
```

- [ ] **Step 5: `backend/tests/test_seed.py` 작성**

```python
"""src.core.seed 단위 테스트."""
import pytest
from sqlalchemy import select, func
from src.core.seed import seed_words, seed_admin
from src.models.word import Word
from src.models.admin import Admin


@pytest.mark.asyncio
async def test_seed_words_inserts_15_when_empty(db_session):
    await seed_words(db_session)
    count = await db_session.scalar(select(func.count()).select_from(Word))
    assert count == 15

    coffee = await db_session.scalar(select(Word).where(Word.word == "커피"))
    assert coffee is not None
    assert coffee.fixed_stage == 1


@pytest.mark.asyncio
async def test_seed_words_idempotent(db_session):
    await seed_words(db_session)
    await seed_words(db_session)  # 두 번 호출
    count = await db_session.scalar(select(func.count()).select_from(Word))
    assert count == 15  # 중복 INSERT 안 됨


@pytest.mark.asyncio
async def test_seed_admin_skipped_without_env(db_session, monkeypatch):
    from src.core import seed as seed_module
    monkeypatch.setattr(seed_module.settings, "INITIAL_ADMIN_USERNAME", "")
    monkeypatch.setattr(seed_module.settings, "INITIAL_ADMIN_PASSWORD", "")
    await seed_admin(db_session)
    count = await db_session.scalar(select(func.count()).select_from(Admin))
    assert count == 0


@pytest.mark.asyncio
async def test_seed_admin_inserts_when_env_present(db_session, monkeypatch):
    from src.core import seed as seed_module
    monkeypatch.setattr(seed_module.settings, "INITIAL_ADMIN_USERNAME", "root")
    monkeypatch.setattr(seed_module.settings, "INITIAL_ADMIN_PASSWORD", "secret123")
    await seed_admin(db_session)

    admin = await db_session.scalar(select(Admin).where(Admin.username == "root"))
    assert admin is not None
    import bcrypt as bcrypt_lib
    assert bcrypt_lib.checkpw(b"secret123", admin.password_hash.encode())
```

- [ ] **Step 6: 테스트 실행 (pytest-asyncio + DB fixture 필요)**

`backend/tests/conftest.py` 없으면 작성:

```python
"""pytest fixture — async DB 세션."""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from src.core.database import Base


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("postgresql+asyncpg://localhost/test_pickerpicker", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    await engine.dispose()
```

`backend/pyproject.toml`에 추가:
```toml
[project.optional-dependencies]
test = ["pytest>=8.0", "pytest-asyncio>=0.24"]
```

Run:
```bash
cd backend
uv sync --extra test
uv run pytest tests/test_seed.py -v
```

Expected: 4개 테스트 모두 PASS.

- [ ] **Step 7: 커밋**

```bash
git add backend/src/core/seed.py backend/src/core/config.py backend/src/main.py backend/pyproject.toml backend/tests/test_seed.py backend/tests/conftest.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : words/admins 자동 시드 로직 (idempotent) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 8: 단어 추첨 서비스 (pick_stages)

**Files:**
- Create: `backend/src/services/word_pick_service.py`
- Create: `backend/src/core/exceptions.py` (확장 — InsufficientPoolError 추가)
- Create: `backend/tests/test_word_pick.py`

- [ ] **Step 1: `backend/src/core/exceptions.py` 확장**

기존 파일에 추가:

```python
class InsufficientPoolError(Exception):
    """단어 풀 부족 — 게임 시작 불가."""
    def __init__(self, difficulty: int):
        self.difficulty = difficulty
        super().__init__(f"단어 풀 부족: 난이도 {difficulty}")
```

- [ ] **Step 2: `backend/src/services/word_pick_service.py` 작성**

```python
"""src.services.word_pick_service
단어 풀에서 stage 15개 추첨. 고정 단어 우선, 나머지는 난이도 그룹별 무중복 랜덤.
"""
import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.word import Word
from src.core.exceptions import InsufficientPoolError

TOTAL_STAGES = 15


async def pick_stages(db: AsyncSession, count: int = TOTAL_STAGES) -> list[Word]:
    """count개 stage 단어 추첨. 고정 단어 → 난이도 그룹 추첨 순.

    Args:
        db: AsyncSession
        count: 추첨할 stage 수 (게임=15, 연습=3)
    Returns:
        list[Word] (길이 == count)
    Raises:
        InsufficientPoolError: 특정 난이도 풀이 부족할 때
    """
    stages: list[Word | None] = [None] * count

    # 1. 고정 단어 배치 — fixed_stage 1~count 범위만 (연습 모드 3개일 때 stage 5 고정은 무시됨)
    fixed_result = await db.execute(
        select(Word).where(Word.fixed_stage.isnot(None), Word.is_active)
    )
    for w in fixed_result.scalars().all():
        if 1 <= w.fixed_stage <= count:
            stages[w.fixed_stage - 1] = w

    # 2. 빈 슬롯 = 난이도 그룹별 풀에서 무중복 랜덤
    used_ids: set[int] = {s.id for s in stages if s is not None}
    for idx in range(count):
        if stages[idx] is not None:
            continue
        diff = (idx // 3) + 1  # 0~2 -> 1, 3~5 -> 2, ..., 12~14 -> 5
        if diff > 5:
            diff = 5  # 안전망

        pool_result = await db.execute(
            select(Word).where(
                Word.difficulty_level == diff,
                Word.is_active,
                Word.fixed_stage.is_(None),
                ~Word.id.in_(used_ids) if used_ids else True,
            )
        )
        pool = list(pool_result.scalars().all())
        if not pool:
            raise InsufficientPoolError(difficulty=diff)
        chosen = random.choice(pool)
        stages[idx] = chosen
        used_ids.add(chosen.id)

    return [s for s in stages if s is not None]
```

- [ ] **Step 3: `backend/tests/test_word_pick.py` 작성**

```python
"""단어 추첨 단위 테스트."""
import pytest
from sqlalchemy import select
from src.services.word_pick_service import pick_stages
from src.core.exceptions import InsufficientPoolError
from src.models.word import Word


@pytest.mark.asyncio
async def test_pick_stages_fixed_word_always_at_stage1(db_session, seeded_words):
    """커피=stage 1 고정 단어가 항상 stage 1에 배치."""
    stages = await pick_stages(db_session)
    assert stages[0].word == "커피"
    assert stages[0].fixed_stage == 1


@pytest.mark.asyncio
async def test_pick_stages_returns_15(db_session, seeded_words):
    stages = await pick_stages(db_session)
    assert len(stages) == 15


@pytest.mark.asyncio
async def test_pick_stages_no_duplicates(db_session, seeded_words_extended):
    """단어 풀 충분할 때 중복 없음."""
    stages = await pick_stages(db_session)
    ids = [s.id for s in stages]
    assert len(set(ids)) == len(ids)


@pytest.mark.asyncio
async def test_pick_stages_raises_on_insufficient_pool(db_session):
    """난이도 1 단어가 없으면 InsufficientPoolError."""
    # 빈 DB 또는 fixed_stage 없는 난이도 1 단어 없을 때
    with pytest.raises(InsufficientPoolError) as exc:
        await pick_stages(db_session)
    assert exc.value.difficulty == 1


@pytest.mark.asyncio
async def test_pick_stages_practice_mode_count_3(db_session, seeded_words):
    """연습 모드 — 3개만 추첨."""
    stages = await pick_stages(db_session, count=3)
    assert len(stages) == 3
    assert stages[0].word == "커피"  # 고정 stage 1
```

`backend/tests/conftest.py`에 fixture 추가:

```python
@pytest_asyncio.fixture
async def seeded_words(db_session):
    """시드 데이터(15개) 적용된 세션."""
    from src.core.seed import seed_words
    await seed_words(db_session)
    return db_session


@pytest_asyncio.fixture
async def seeded_words_extended(db_session):
    """난이도별 풀이 풍부한 세션 — 각 난이도 6개씩."""
    from src.core.seed import seed_words
    await seed_words(db_session)  # 15개
    # 난이도별로 추가 단어 INSERT (테스트용 더미)
    extras_per_difficulty = 3
    for diff in range(1, 6):
        for i in range(extras_per_difficulty):
            extra = Word(
                word=f"테스트{diff}_{i}",
                difficulty_level=diff,
                bpm=90 + diff * 15,
                input_length=16 + (diff - 1) * 8,
                valid_syllables=["테", "스"],
                invalid_syllables=["트", "ㅌ", "ㅅ", "ㅇ", "ㄱ", "ㄴ"],
                input_syllables=["테"] * (16 + (diff - 1) * 8),
                key_mapping=[
                    {"key": "a", "syllable": "테", "type": "valid"},
                    {"key": "s", "syllable": "스", "type": "valid"},
                    {"key": "d", "syllable": "트", "type": "invalid"},
                    {"key": "f", "syllable": "ㅌ", "type": "invalid"},
                    {"key": "j", "syllable": "ㅅ", "type": "invalid"},
                    {"key": "k", "syllable": "ㅇ", "type": "invalid"},
                    {"key": "l", "syllable": "ㄱ", "type": "invalid"},
                    {"key": ";", "syllable": "ㄴ", "type": "invalid"},
                ],
                fixed_stage=None,
                is_active=True,
            )
            db_session.add(extra)
    await db_session.commit()
    return db_session
```

- [ ] **Step 4: 테스트 실행**

```bash
cd backend
uv run pytest tests/test_word_pick.py -v
```

Expected: 5개 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/word_pick_service.py backend/src/core/exceptions.py backend/tests/test_word_pick.py backend/tests/conftest.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : pick_stages 단어 추첨 서비스 (고정+난이도 그룹) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 9: Admin 인증 dependency + 서비스

**Files:**
- Create: `backend/src/services/admin_auth_service.py`
- Create: `backend/src/dependencies/__init__.py`, `backend/src/dependencies/admin_auth.py`
- Create: `backend/tests/test_admin_auth.py`

- [ ] **Step 1: `backend/src/services/admin_auth_service.py` 작성**

```python
"""src.services.admin_auth_service
Admin 로그인/로그아웃/토큰 검증.
"""
import secrets
import logging
from datetime import datetime, timedelta

import bcrypt
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.admin import Admin
from src.models.admin_session import AdminSession

logger = logging.getLogger(__name__)

TOKEN_TTL = timedelta(hours=24)


async def login(db: AsyncSession, username: str, password: str) -> tuple[str, datetime] | None:
    """username/password 검증 후 토큰 발급. 실패 시 None."""
    admin = await db.scalar(select(Admin).where(Admin.username == username))
    if admin is None:
        return None
    if not bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
        return None

    token = secrets.token_urlsafe(48)[:64]
    expires_at = datetime.utcnow() + TOKEN_TTL
    session = AdminSession(token=token, admin_id=admin.id, expires_at=expires_at)
    db.add(session)
    await db.commit()
    logger.info(f"admin 로그인 토큰 발급: {username}")
    return token, expires_at


async def logout(db: AsyncSession, token: str) -> None:
    """토큰 폐기."""
    await db.execute(delete(AdminSession).where(AdminSession.token == token))
    await db.commit()


async def verify_token(db: AsyncSession, token: str) -> Admin | None:
    """토큰 → Admin. 유효하지 않으면 None."""
    session = await db.scalar(
        select(AdminSession).where(
            AdminSession.token == token,
            AdminSession.expires_at > datetime.utcnow(),
        )
    )
    if session is None:
        return None
    return await db.get(Admin, session.admin_id)


async def create_admin(db: AsyncSession, username: str, password: str, created_by_id: int | None) -> Admin:
    """신규 admin 등록. username 중복 시 IntegrityError → 라우터가 409로 처리."""
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    admin = Admin(username=username, password_hash=password_hash, created_by=created_by_id)
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    logger.info(f"admin 생성: {username} by admin_id={created_by_id}")
    return admin
```

- [ ] **Step 2: `backend/src/dependencies/__init__.py` 빈 파일 생성**

```python
"""src.dependencies — FastAPI Depends 헬퍼."""
```

- [ ] **Step 3: `backend/src/dependencies/admin_auth.py` 작성**

```python
"""src.dependencies.admin_auth
Admin Bearer 토큰 검증 FastAPI Depends.
"""
from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.services import admin_auth_service
from src.models.admin import Admin


async def get_current_admin(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_admin_bearer")
    token = authorization[7:].strip()
    admin = await admin_auth_service.verify_token(db, token)
    if admin is None:
        raise HTTPException(status_code=401, detail="invalid_or_expired_admin_token")
    return admin
```

- [ ] **Step 4: `backend/tests/test_admin_auth.py` 작성**

```python
"""Admin 인증 단위 테스트."""
import pytest
import bcrypt
from datetime import datetime, timedelta
from src.services import admin_auth_service
from src.models.admin import Admin
from src.models.admin_session import AdminSession


@pytest.mark.asyncio
async def test_login_success(db_session):
    pw_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode()
    db_session.add(Admin(username="root", password_hash=pw_hash))
    await db_session.commit()

    result = await admin_auth_service.login(db_session, "root", "secret123")
    assert result is not None
    token, expires_at = result
    assert len(token) <= 64
    assert expires_at > datetime.utcnow()


@pytest.mark.asyncio
async def test_login_wrong_password(db_session):
    pw_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode()
    db_session.add(Admin(username="root", password_hash=pw_hash))
    await db_session.commit()

    result = await admin_auth_service.login(db_session, "root", "wrong")
    assert result is None


@pytest.mark.asyncio
async def test_verify_token_valid(db_session):
    pw_hash = bcrypt.hashpw(b"x", bcrypt.gensalt()).decode()
    admin = Admin(username="a", password_hash=pw_hash)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    db_session.add(AdminSession(
        token="testtoken",
        admin_id=admin.id,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    ))
    await db_session.commit()

    result = await admin_auth_service.verify_token(db_session, "testtoken")
    assert result is not None
    assert result.username == "a"


@pytest.mark.asyncio
async def test_verify_token_expired(db_session):
    pw_hash = bcrypt.hashpw(b"x", bcrypt.gensalt()).decode()
    admin = Admin(username="a", password_hash=pw_hash)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    db_session.add(AdminSession(
        token="expired",
        admin_id=admin.id,
        expires_at=datetime.utcnow() - timedelta(seconds=1)
    ))
    await db_session.commit()

    result = await admin_auth_service.verify_token(db_session, "expired")
    assert result is None


@pytest.mark.asyncio
async def test_logout_removes_token(db_session):
    pw_hash = bcrypt.hashpw(b"x", bcrypt.gensalt()).decode()
    admin = Admin(username="a", password_hash=pw_hash)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    db_session.add(AdminSession(
        token="t1",
        admin_id=admin.id,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    ))
    await db_session.commit()

    await admin_auth_service.logout(db_session, "t1")
    result = await admin_auth_service.verify_token(db_session, "t1")
    assert result is None
```

- [ ] **Step 5: 테스트 실행**

```bash
cd backend && uv run pytest tests/test_admin_auth.py -v
```

Expected: 5개 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/admin_auth_service.py backend/src/dependencies/ backend/tests/test_admin_auth.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : admin 인증 서비스 + Bearer dependency https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 10: word_service (CRUD) + pydantic 검증

**Files:**
- Create: `backend/src/services/word_service.py`
- Create: `backend/src/schemas/word.py`
- Create: `backend/tests/test_word_crud.py`

- [ ] **Step 1: `backend/src/schemas/__init__.py` 빈 파일 생성**

`"""src.schemas — pydantic 요청/응답 스키마."""`

- [ ] **Step 2: `backend/src/schemas/word.py` 작성 — pydantic 검증 포함**

```python
"""src.schemas.word — Word 요청/응답 스키마."""
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class KeyMappingItem(BaseModel):
    key: Literal["a", "s", "d", "f", "j", "k", "l", ";"]
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
        if len(self.input_syllables) != self.input_length:
            raise ValueError("input_syllables 길이가 input_length와 불일치")
        keys = {km.key for km in self.key_mapping}
        if keys != {"a", "s", "d", "f", "j", "k", "l", ";"}:
            raise ValueError("key_mapping은 a/s/d/f/j/k/l/; 8개 키 모두 포함해야 함")
        all_syl = set(self.valid_syllables) | set(self.invalid_syllables)
        km_syl = {km.syllable for km in self.key_mapping}
        if all_syl != km_syl:
            raise ValueError("valid+invalid 음절과 key_mapping 음절 집합이 불일치")
        if not all(s in all_syl for s in self.input_syllables):
            raise ValueError("input_syllables에 정의되지 않은 음절 포함")
        return self


class WordUpdateRequest(WordCreateRequest):
    """Update = Create와 동일 검증."""
    pass


class WordResponse(BaseModel):
    id: int
    word: str
    difficulty_level: int
    bpm: int
    input_length: int
    valid_syllables: list[str]
    invalid_syllables: list[str]
    input_syllables: list[str]
    key_mapping: list[dict]
    fixed_stage: int | None
    is_active: bool

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: `backend/src/services/word_service.py` 작성**

```python
"""src.services.word_service — Word CRUD."""
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.word import Word
from src.schemas.word import WordCreateRequest, WordUpdateRequest

logger = logging.getLogger(__name__)


class WordAlreadyExists(Exception):
    def __init__(self, word: str):
        self.word = word
        super().__init__(f"word_exists: {word}")


class FixedStageTaken(Exception):
    def __init__(self, stage: int):
        self.stage = stage
        super().__init__(f"fixed_stage_taken: {stage}")


async def list_words(
    db: AsyncSession,
    difficulty: int | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Word]:
    stmt = select(Word).order_by(Word.difficulty_level, Word.id)
    if difficulty is not None:
        stmt = stmt.where(Word.difficulty_level == difficulty)
    if is_active is not None:
        stmt = stmt.where(Word.is_active == is_active)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_word(db: AsyncSession, word_id: int) -> Word | None:
    return await db.get(Word, word_id)


async def create_word(db: AsyncSession, payload: WordCreateRequest) -> Word:
    word = Word(
        word=payload.word,
        difficulty_level=payload.difficulty_level,
        bpm=payload.bpm,
        input_length=payload.input_length,
        valid_syllables=payload.valid_syllables,
        invalid_syllables=payload.invalid_syllables,
        input_syllables=payload.input_syllables,
        key_mapping=[km.model_dump() for km in payload.key_mapping],
        fixed_stage=payload.fixed_stage,
        is_active=True,
    )
    db.add(word)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        msg = str(e.orig).lower()
        if "words_word_key" in msg or "uq_words_word" in msg or "duplicate key" in msg and "word" in msg:
            raise WordAlreadyExists(payload.word)
        if "uq_words_fixed_stage" in msg:
            raise FixedStageTaken(payload.fixed_stage)
        raise
    await db.refresh(word)
    logger.info(f"word 생성: {word.word} (id={word.id})")
    return word


async def update_word(db: AsyncSession, word_id: int, payload: WordUpdateRequest) -> Word | None:
    word = await db.get(Word, word_id)
    if word is None:
        return None
    word.word = payload.word
    word.difficulty_level = payload.difficulty_level
    word.bpm = payload.bpm
    word.input_length = payload.input_length
    word.valid_syllables = payload.valid_syllables
    word.invalid_syllables = payload.invalid_syllables
    word.input_syllables = payload.input_syllables
    word.key_mapping = [km.model_dump() for km in payload.key_mapping]
    word.fixed_stage = payload.fixed_stage
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        msg = str(e.orig).lower()
        if "uq_words_fixed_stage" in msg:
            raise FixedStageTaken(payload.fixed_stage)
        if "words_word_key" in msg or "duplicate" in msg:
            raise WordAlreadyExists(payload.word)
        raise
    await db.refresh(word)
    return word


async def soft_delete_word(db: AsyncSession, word_id: int) -> bool:
    word = await db.get(Word, word_id)
    if word is None:
        return False
    word.is_active = False
    await db.commit()
    logger.info(f"word 비활성화: {word.word} (id={word.id})")
    return True
```

- [ ] **Step 4: `backend/tests/test_word_crud.py` 작성**

```python
"""Word CRUD + 검증 단위 테스트."""
import pytest
from src.services import word_service
from src.services.word_service import WordAlreadyExists, FixedStageTaken
from src.schemas.word import WordCreateRequest


def _valid_payload(word="테스트", fixed=None) -> WordCreateRequest:
    return WordCreateRequest(
        word=word,
        difficulty_level=1,
        bpm=90,
        input_length=8,
        valid_syllables=["테", "스"],
        invalid_syllables=["트", "ㅌ", "ㅅ", "ㅇ", "ㄱ", "ㄴ"],
        input_syllables=["테", "스"] * 4,
        key_mapping=[
            {"key": "a", "syllable": "테", "type": "valid"},
            {"key": "s", "syllable": "스", "type": "valid"},
            {"key": "d", "syllable": "트", "type": "invalid"},
            {"key": "f", "syllable": "ㅌ", "type": "invalid"},
            {"key": "j", "syllable": "ㅅ", "type": "invalid"},
            {"key": "k", "syllable": "ㅇ", "type": "invalid"},
            {"key": "l", "syllable": "ㄱ", "type": "invalid"},
            {"key": ";", "syllable": "ㄴ", "type": "invalid"},
        ],
        fixed_stage=fixed,
    )


def test_validate_input_length_mismatch():
    with pytest.raises(ValueError, match="input_syllables 길이"):
        WordCreateRequest(
            word="x", difficulty_level=1, bpm=90, input_length=10,
            valid_syllables=["테"], invalid_syllables=[],
            input_syllables=["테"],  # 1 != 10
            key_mapping=[{"key": k, "syllable": "테", "type": "valid"} for k in ["a","s","d","f","j","k","l",";"]],
        )


def test_validate_keys_missing():
    p = _valid_payload()
    p_dict = p.model_dump()
    p_dict["key_mapping"][0]["key"] = "a"
    p_dict["key_mapping"][1]["key"] = "a"  # 중복 a, s 누락
    with pytest.raises(ValueError, match="8개 키 모두"):
        WordCreateRequest(**p_dict)


def test_validate_syllable_mismatch():
    p_dict = _valid_payload().model_dump()
    p_dict["key_mapping"][0]["syllable"] = "외계어"  # valid/invalid에 없는 음절
    with pytest.raises(ValueError, match="음절 집합이 불일치"):
        WordCreateRequest(**p_dict)


@pytest.mark.asyncio
async def test_create_word(db_session):
    word = await word_service.create_word(db_session, _valid_payload(word="테스트1"))
    assert word.id is not None
    assert word.word == "테스트1"


@pytest.mark.asyncio
async def test_create_word_duplicate_raises(db_session):
    await word_service.create_word(db_session, _valid_payload(word="중복"))
    with pytest.raises(WordAlreadyExists):
        await word_service.create_word(db_session, _valid_payload(word="중복"))


@pytest.mark.asyncio
async def test_create_word_fixed_stage_conflict(db_session):
    await word_service.create_word(db_session, _valid_payload(word="고정1", fixed=1))
    with pytest.raises(FixedStageTaken):
        await word_service.create_word(db_session, _valid_payload(word="고정1b", fixed=1))


@pytest.mark.asyncio
async def test_soft_delete_preserves_row(db_session):
    word = await word_service.create_word(db_session, _valid_payload(word="삭제대상"))
    ok = await word_service.soft_delete_word(db_session, word.id)
    assert ok
    refreshed = await word_service.get_word(db_session, word.id)
    assert refreshed is not None
    assert refreshed.is_active is False
```

- [ ] **Step 5: 테스트 실행**

```bash
cd backend && uv run pytest tests/test_word_crud.py -v
```

Expected: 7개 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/schemas/ backend/src/services/word_service.py backend/tests/test_word_crud.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : word CRUD 서비스 + pydantic 검증 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 11: word_stats_service + 결과 트랜잭션 확장

**Files:**
- Create: `backend/src/services/word_stats_service.py`
- Modify: `backend/src/services/player_service.py` (또는 신규 game_session_service)
- Create: `backend/tests/test_word_stats.py`

- [ ] **Step 1: `backend/src/services/word_stats_service.py` 작성**

```python
"""src.services.word_stats_service
word_stats UPSERT + session_word_results INSERT.
"""
import logging
from datetime import datetime
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult

logger = logging.getLogger(__name__)


async def record_stage_result(
    db: AsyncSession,
    session_id: int,
    player_id: int,
    word_id: int,
    stage_index: int,
    perfect: int,
    good: int,
    miss: int,
    stage_score: int,
) -> None:
    """1개 stage 결과 raw INSERT + 집계 UPSERT.

    호출자가 트랜잭션 관리 (commit/rollback) — 본 함수는 db.add/db.execute만.
    """
    # 1. raw 기록
    raw = SessionWordResult(
        session_id=session_id,
        word_id=word_id,
        stage_index=stage_index,
        perfect_count=perfect,
        good_count=good,
        miss_count=miss,
        stage_score=stage_score,
    )
    db.add(raw)

    # 2. word_stats UPSERT (PG ON CONFLICT)
    stmt = pg_insert(WordStats).values(
        player_id=player_id,
        word_id=word_id,
        exposure_count=1,
        perfect_count=perfect,
        good_count=good,
        miss_count=miss,
        best_score=stage_score,
        last_played_at=datetime.utcnow(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["player_id", "word_id"],
        set_={
            "exposure_count": WordStats.exposure_count + stmt.excluded.exposure_count,
            "perfect_count": WordStats.perfect_count + stmt.excluded.perfect_count,
            "good_count": WordStats.good_count + stmt.excluded.good_count,
            "miss_count": WordStats.miss_count + stmt.excluded.miss_count,
            "best_score": pg_insert(WordStats).excluded.best_score,  # 임시
            "last_played_at": stmt.excluded.last_played_at,
        },
    )
    # best_score = GREATEST 처리는 raw SQL로 (SQLAlchemy on_conflict 한계)
    # 실제 SQL은 PostgreSQL에서 GREATEST(word_stats.best_score, EXCLUDED.best_score)
    from sqlalchemy import func
    stmt = pg_insert(WordStats).values(
        player_id=player_id,
        word_id=word_id,
        exposure_count=1,
        perfect_count=perfect,
        good_count=good,
        miss_count=miss,
        best_score=stage_score,
        last_played_at=datetime.utcnow(),
    ).on_conflict_do_update(
        index_elements=["player_id", "word_id"],
        set_={
            "exposure_count": WordStats.__table__.c.exposure_count + 1,
            "perfect_count": WordStats.__table__.c.perfect_count + perfect,
            "good_count": WordStats.__table__.c.good_count + good,
            "miss_count": WordStats.__table__.c.miss_count + miss,
            "best_score": func.greatest(WordStats.__table__.c.best_score, stage_score),
            "last_played_at": datetime.utcnow(),
        },
    )
    await db.execute(stmt)
```

- [ ] **Step 2: `backend/tests/test_word_stats.py` 작성**

```python
"""word_stats UPSERT 단위 테스트."""
import pytest
from sqlalchemy import select
from src.services.word_stats_service import record_stage_result
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult
from src.models.player import Player
from src.models.game_session import GameSession


@pytest.fixture
def _player_and_session():
    """헬퍼: player + game_session ID 발급."""
    pass  # 실제 구현은 fixture로


@pytest.mark.asyncio
async def test_first_play_inserts_new_row(db_session, seeded_words):
    player = Player(nickname="tester", play_count=0, best_score=0, best_stage=0, best_combo=0)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    word = await db_session.scalar(select(__import__("src.models.word", fromlist=["Word"]).Word).limit(1))
    session = GameSession(nickname="tester", score=100, stage=1, combo=5, stage_scores={"1": 100})
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    await record_stage_result(db_session, session.id, player.id, word.id, 1, 10, 2, 1, 100)
    await db_session.commit()

    ws = await db_session.scalar(
        select(WordStats).where(WordStats.player_id == player.id, WordStats.word_id == word.id)
    )
    assert ws is not None
    assert ws.exposure_count == 1
    assert ws.perfect_count == 10
    assert ws.best_score == 100

    raw = await db_session.scalar(select(SessionWordResult).where(SessionWordResult.session_id == session.id))
    assert raw is not None
    assert raw.stage_score == 100


@pytest.mark.asyncio
async def test_second_play_accumulates(db_session, seeded_words):
    from src.models.word import Word
    player = Player(nickname="tester2")
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    word = await db_session.scalar(select(Word).limit(1))
    session = GameSession(nickname="tester2", score=100, stage=1, combo=5, stage_scores={"1": 100})
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    await record_stage_result(db_session, session.id, player.id, word.id, 1, 5, 0, 0, 50)
    await db_session.commit()
    await record_stage_result(db_session, session.id, player.id, word.id, 1, 10, 1, 0, 200)
    await db_session.commit()

    ws = await db_session.scalar(
        select(WordStats).where(WordStats.player_id == player.id, WordStats.word_id == word.id)
    )
    assert ws.exposure_count == 2
    assert ws.perfect_count == 15
    assert ws.good_count == 1
    assert ws.best_score == 200  # GREATEST
```

- [ ] **Step 3: 테스트 실행**

```bash
cd backend && uv run pytest tests/test_word_stats.py -v
```

Expected: 2개 PASS.

- [ ] **Step 4: 커밋**

```bash
git add backend/src/services/word_stats_service.py backend/tests/test_word_stats.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : word_stats UPSERT + session_word_results raw INSERT 서비스 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 12: Admin Router + Games Router

**Files:**
- Create: `backend/src/apis/admin_router.py`
- Create: `backend/src/apis/games_router.py`
- Modify: `backend/src/main.py` (라우터 등록)

- [ ] **Step 1: `backend/src/apis/admin_router.py` 작성**

```python
"""src.apis.admin_router — admin 전용 API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.dependencies.admin_auth import get_current_admin
from src.models.admin import Admin
from src.services import admin_auth_service, word_service
from src.services.word_service import WordAlreadyExists, FixedStageTaken
from src.schemas.word import WordCreateRequest, WordUpdateRequest, WordResponse

router = APIRouter(prefix="/admin", tags=["admin"])


# ========== auth ==========
class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime


@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await admin_auth_service.login(db, body.username, body.password)
    if result is None:
        raise HTTPException(401, "invalid_credentials")
    token, exp = result
    return AdminLoginResponse(token=token, expires_at=exp)


@router.post("/auth/logout", status_code=204)
async def admin_logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    if authorization and authorization.lower().startswith("bearer "):
        await admin_auth_service.logout(db, authorization[7:].strip())


# ========== admin user mgmt ==========
class AdminCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class AdminResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    created_by: int | None
    model_config = {"from_attributes": True}


@router.post("/admins", response_model=AdminResponse, status_code=201)
async def create_admin_endpoint(
    body: AdminCreateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.exc import IntegrityError
    try:
        admin = await admin_auth_service.create_admin(db, body.username, body.password, current.id)
    except IntegrityError:
        raise HTTPException(409, "admin_username_exists")
    return admin


@router.get("/admins", response_model=list[AdminResponse])
async def list_admins(
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(select(Admin).order_by(Admin.id))
    return list(result.scalars().all())


# ========== words ==========
@router.get("/words", response_model=list[WordResponse])
async def list_words_endpoint(
    difficulty: int | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await word_service.list_words(db, difficulty, is_active, limit, offset)


@router.get("/words/{word_id}", response_model=WordResponse)
async def get_word_endpoint(
    word_id: int,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    word = await word_service.get_word(db, word_id)
    if word is None:
        raise HTTPException(404, "word_not_found")
    return word


@router.post("/words", response_model=WordResponse, status_code=201)
async def create_word_endpoint(
    body: WordCreateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await word_service.create_word(db, body)
    except WordAlreadyExists as e:
        raise HTTPException(409, f"word_exists:{e.word}")
    except FixedStageTaken as e:
        raise HTTPException(409, f"fixed_stage_taken:{e.stage}")


@router.put("/words/{word_id}", response_model=WordResponse)
async def update_word_endpoint(
    word_id: int,
    body: WordUpdateRequest,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        word = await word_service.update_word(db, word_id, body)
    except WordAlreadyExists as e:
        raise HTTPException(409, f"word_exists:{e.word}")
    except FixedStageTaken as e:
        raise HTTPException(409, f"fixed_stage_taken:{e.stage}")
    if word is None:
        raise HTTPException(404, "word_not_found")
    return word


@router.delete("/words/{word_id}", status_code=204)
async def delete_word_endpoint(
    word_id: int,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ok = await word_service.soft_delete_word(db, word_id)
    if not ok:
        raise HTTPException(404, "word_not_found")


# ========== stats ==========
class WordGlobalStat(BaseModel):
    word_id: int
    word: str
    difficulty_level: int
    total_exposure: int
    accuracy: float  # 0~1
    is_active: bool


@router.get("/stats/words", response_model=list[WordGlobalStat])
async def admin_stats_words(
    sort: str = "exposure_desc",
    limit: int = 50,
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, func
    from src.models.word import Word
    from src.models.word_stats import WordStats

    perfect_sum = func.coalesce(func.sum(WordStats.perfect_count), 0)
    good_sum = func.coalesce(func.sum(WordStats.good_count), 0)
    miss_sum = func.coalesce(func.sum(WordStats.miss_count), 0)
    total_judgments = perfect_sum + good_sum + miss_sum
    accuracy_expr = func.coalesce(
        (perfect_sum + good_sum * 0.5) / func.nullif(total_judgments, 0), 0.0
    )

    stmt = (
        select(
            Word.id.label("word_id"),
            Word.word.label("word"),
            Word.difficulty_level,
            func.coalesce(func.sum(WordStats.exposure_count), 0).label("total_exposure"),
            accuracy_expr.label("accuracy"),
            Word.is_active,
        )
        .outerjoin(WordStats, WordStats.word_id == Word.id)
        .group_by(Word.id)
    )
    if sort == "exposure_desc":
        stmt = stmt.order_by(func.coalesce(func.sum(WordStats.exposure_count), 0).desc())
    elif sort == "accuracy_asc":
        stmt = stmt.order_by(accuracy_expr.asc())
    elif sort == "accuracy_desc":
        stmt = stmt.order_by(accuracy_expr.desc())
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return [
        WordGlobalStat(
            word_id=r.word_id,
            word=r.word,
            difficulty_level=r.difficulty_level,
            total_exposure=r.total_exposure,
            accuracy=float(r.accuracy or 0),
            is_active=r.is_active,
        )
        for r in result.all()
    ]


class AdminOverview(BaseModel):
    total_players: int
    total_sessions: int
    active_word_count: int
    avg_score: float


@router.get("/stats/overview", response_model=AdminOverview)
async def admin_stats_overview(
    current: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, func
    from src.models.player import Player
    from src.models.game_session import GameSession
    from src.models.word import Word

    total_players = await db.scalar(select(func.count()).select_from(Player)) or 0
    total_sessions = await db.scalar(select(func.count()).select_from(GameSession)) or 0
    active_word_count = await db.scalar(
        select(func.count()).select_from(Word).where(Word.is_active == True)
    ) or 0
    avg_score = await db.scalar(select(func.avg(GameSession.score))) or 0

    return AdminOverview(
        total_players=total_players,
        total_sessions=total_sessions,
        active_word_count=active_word_count,
        avg_score=float(avg_score),
    )
```

- [ ] **Step 2: `backend/src/apis/games_router.py` 작성**

```python
"""src.apis.games_router — 게임 시작 단어 추첨 + 연습 모드."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.exceptions import InsufficientPoolError
from src.services.word_pick_service import pick_stages
from src.schemas.word import WordResponse

router = APIRouter(tags=["games"])


class StartGameResponse(BaseModel):
    stages: list[WordResponse]


@router.post("/games/start", response_model=StartGameResponse)
async def start_game(db: AsyncSession = Depends(get_db)):
    try:
        stages = await pick_stages(db, count=15)
    except InsufficientPoolError as e:
        raise HTTPException(422, f"insufficient_word_pool:difficulty={e.difficulty}")
    return StartGameResponse(stages=stages)


@router.post("/practice/start", response_model=StartGameResponse)
async def start_practice(db: AsyncSession = Depends(get_db)):
    try:
        stages = await pick_stages(db, count=3)
    except InsufficientPoolError as e:
        raise HTTPException(422, f"insufficient_word_pool:difficulty={e.difficulty}")
    return StartGameResponse(stages=stages)
```

- [ ] **Step 3: `backend/src/main.py`에 라우터 등록**

```python
from src.apis.admin_router import router as admin_router
from src.apis.games_router import router as games_router

# ... include_router 줄들 아래에 추가:
app.include_router(admin_router)
app.include_router(games_router)
```

- [ ] **Step 4: 통합 테스트 — `backend/tests/test_admin_api.py`**

```python
"""Admin API E2E (테스트 client)."""
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app
from src.models.admin import Admin
from src.core import seed
import bcrypt


@pytest_asyncio_fixture := pytest.fixture
async def test_client(db_session, monkeypatch):
    # HMAC 비활성화 (테스트)
    monkeypatch.setenv("SECRET_KEY", "")
    from src.core.config import settings
    monkeypatch.setattr(settings, "SECRET_KEY", "")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_admin_login_flow(db_session, test_client):
    pw_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode()
    db_session.add(Admin(username="root", password_hash=pw_hash))
    await db_session.commit()

    r = await test_client.post("/admin/auth/login", json={"username": "root", "password": "secret123"})
    assert r.status_code == 200
    token = r.json()["token"]

    r2 = await test_client.get("/admin/words", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_admin_words_crud(db_session, test_client, seeded_words):
    pw_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode()
    db_session.add(Admin(username="root", password_hash=pw_hash))
    await db_session.commit()

    login = await test_client.post("/admin/auth/login", json={"username": "root", "password": "secret123"})
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = await test_client.get("/admin/words", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) >= 15  # seeded

    # 신규 등록 시도 — 음절 집합 불일치로 422
    bad = {
        "word": "잘못",
        "difficulty_level": 1,
        "bpm": 90,
        "input_length": 8,
        "valid_syllables": ["잘", "못"],
        "invalid_syllables": [],
        "input_syllables": ["잘"] * 8,
        "key_mapping": [{"key": k, "syllable": "외계어", "type": "valid"} for k in ["a","s","d","f","j","k","l",";"]],
    }
    r = await test_client.post("/admin/words", json=bad, headers=headers)
    assert r.status_code == 422
```

`backend/pyproject.toml` test 의존성에 추가:
```toml
test = ["pytest>=8.0", "pytest-asyncio>=0.24", "httpx>=0.27"]
```

- [ ] **Step 5: 테스트 실행**

```bash
cd backend
uv sync --extra test
uv run pytest tests/ -v
```

Expected: 모든 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/apis/admin_router.py backend/src/apis/games_router.py backend/src/main.py backend/tests/test_admin_api.py backend/pyproject.toml
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : /admin/* 라우터 + /games/start + /practice/start 추가 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Phase 2 종료 — PR-B 푸시 + 배포 + 검증

- [ ] **Step 1: GitHub Secrets에 `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD` 추가**

`/suh-github` 스킬 또는 GitHub UI에서 추가. `BACKEND_ENV_FILE` 시크릿에도 다음 두 줄 포함:
```
INITIAL_ADMIN_USERNAME=root
INITIAL_ADMIN_PASSWORD=<랜덤 16자>
```

- [ ] **Step 2: main push + deploy**

```bash
git push origin main
# /changelog-deploy
```

- [ ] **Step 3: 운영 검증**

```bash
# admin 로그인 확인
curl -X POST http://suh-project.synology.me:8001/admin/auth/login \
  -H "X-Timestamp: $(date +%s%3N)" -H "X-Signature: ..." \
  -d '{"username":"root","password":"..."}'
# words 시드 확인
docker exec pickerpicker-back uv run python -c "
import asyncio
from sqlalchemy import select, func
from src.core.database import AsyncSessionLocal
from src.models.word import Word
async def run():
    async with AsyncSessionLocal() as s:
        n = await s.scalar(select(func.count()).select_from(Word))
        print(f'words count: {n}')
asyncio.run(run())
"
# → 15 출력 기대
```

---

## Phase 3 — PR-C: FE /admin 화면

**이슈:** #133

**파일 영향:**
- Create: `src/services/adminApi.ts`
- Create: `src/components/admin/AdminLoginScreen.tsx`, `AdminDashboard.tsx`, `WordListPage.tsx`, `WordFormPage.tsx`, `WordStatsPage.tsx`, `AdminListPage.tsx`
- Create: `src/types/admin.ts`
- Modify: `src/App.tsx` (admin 라우트 추가)

---

### Task 13: adminApi 서비스

**Files:**
- Create: `src/services/adminApi.ts`
- Create: `src/types/admin.ts`

- [ ] **Step 1: `src/types/admin.ts` 작성**

```typescript
export interface KeyMappingItem {
  key: 'a' | 's' | 'd' | 'f' | 'j' | 'k' | 'l' | ';'
  syllable: string
  type: 'valid' | 'invalid'
}

export interface Word {
  id: number
  word: string
  difficulty_level: number
  bpm: number
  input_length: number
  valid_syllables: string[]
  invalid_syllables: string[]
  input_syllables: string[]
  key_mapping: KeyMappingItem[]
  fixed_stage: number | null
  is_active: boolean
}

export interface AdminUser {
  id: number
  username: string
  created_at: string
  created_by: number | null
}

export interface WordGlobalStat {
  word_id: number
  word: string
  difficulty_level: number
  total_exposure: number
  accuracy: number
  is_active: boolean
}

export interface AdminOverview {
  total_players: number
  total_sessions: number
  active_word_count: number
  avg_score: number
}
```

- [ ] **Step 2: `src/services/adminApi.ts` 작성 — authService 패턴 복제 + 토큰 키 분리**

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || ''

const SS_ADMIN_TOKEN_KEY = 'pickerpicker_admin_token'
const SS_ADMIN_TOKEN_USER_KEY = 'pickerpicker_admin_username'
const SS_ADMIN_TOKEN_EXP_KEY = 'pickerpicker_admin_token_expires_at'

async function hmacSignature(timestamp: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(timestamp))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getAdminToken(): string | null {
  const tok = sessionStorage.getItem(SS_ADMIN_TOKEN_KEY)
  const exp = sessionStorage.getItem(SS_ADMIN_TOKEN_EXP_KEY)
  if (!tok || !exp) return null
  if (new Date(exp).getTime() < Date.now()) {
    sessionStorage.removeItem(SS_ADMIN_TOKEN_KEY)
    sessionStorage.removeItem(SS_ADMIN_TOKEN_USER_KEY)
    sessionStorage.removeItem(SS_ADMIN_TOKEN_EXP_KEY)
    return null
  }
  return tok
}

export function getAdminUsername(): string | null {
  if (!getAdminToken()) return null
  return sessionStorage.getItem(SS_ADMIN_TOKEN_USER_KEY)
}

async function adminHeaders(): Promise<Record<string, string>> {
  const timestamp = String(Date.now())
  const signature = await hmacSignature(timestamp)
  const token = getAdminToken()
  return {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = await adminHeaders()
  return fetch(url, { ...init, headers: { ...headers, ...(init.headers as any) } })
}

export async function adminLogin(username: string, password: string): Promise<boolean> {
  const r = await adminFetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) return false
  const data = await r.json()
  sessionStorage.setItem(SS_ADMIN_TOKEN_KEY, data.token)
  sessionStorage.setItem(SS_ADMIN_TOKEN_USER_KEY, username)
  sessionStorage.setItem(SS_ADMIN_TOKEN_EXP_KEY, data.expires_at)
  return true
}

export async function adminLogout(): Promise<void> {
  const tok = getAdminToken()
  if (tok) {
    try { await adminFetch(`${BASE_URL}/admin/auth/logout`, { method: 'POST' }) } catch {}
  }
  sessionStorage.removeItem(SS_ADMIN_TOKEN_KEY)
  sessionStorage.removeItem(SS_ADMIN_TOKEN_USER_KEY)
  sessionStorage.removeItem(SS_ADMIN_TOKEN_EXP_KEY)
}

export function isAdminLoggedIn(): boolean {
  return getAdminToken() !== null
}

import type { Word, AdminUser, WordGlobalStat, AdminOverview } from '../types/admin'

export async function listWords(params?: { difficulty?: number; is_active?: boolean }): Promise<Word[]> {
  const q = new URLSearchParams()
  if (params?.difficulty !== undefined) q.set('difficulty', String(params.difficulty))
  if (params?.is_active !== undefined) q.set('is_active', String(params.is_active))
  const r = await adminFetch(`${BASE_URL}/admin/words?${q}`)
  if (!r.ok) throw new Error(`list_words_failed: ${r.status}`)
  return r.json()
}

export async function getWord(id: number): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`)
  if (!r.ok) throw new Error(`get_word_failed: ${r.status}`)
  return r.json()
}

export async function createWord(payload: Omit<Word, 'id' | 'is_active'>): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words`, {
    method: 'POST', body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`create_word_failed: ${r.status} ${detail}`)
  }
  return r.json()
}

export async function updateWord(id: number, payload: Omit<Word, 'id' | 'is_active'>): Promise<Word> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`, {
    method: 'PUT', body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`update_word_failed: ${r.status}`)
  return r.json()
}

export async function deleteWord(id: number): Promise<void> {
  const r = await adminFetch(`${BASE_URL}/admin/words/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`delete_word_failed: ${r.status}`)
}

export async function listAdmins(): Promise<AdminUser[]> {
  const r = await adminFetch(`${BASE_URL}/admin/admins`)
  if (!r.ok) throw new Error(`list_admins_failed: ${r.status}`)
  return r.json()
}

export async function createAdmin(username: string, password: string): Promise<AdminUser> {
  const r = await adminFetch(`${BASE_URL}/admin/admins`, {
    method: 'POST', body: JSON.stringify({ username, password }),
  })
  if (!r.ok) {
    const detail = await r.text()
    throw new Error(`create_admin_failed: ${r.status} ${detail}`)
  }
  return r.json()
}

export async function globalWordStats(sort: 'exposure_desc' | 'accuracy_asc' | 'accuracy_desc' = 'exposure_desc'): Promise<WordGlobalStat[]> {
  const r = await adminFetch(`${BASE_URL}/admin/stats/words?sort=${sort}&limit=50`)
  if (!r.ok) throw new Error(`stats_words_failed: ${r.status}`)
  return r.json()
}

export async function adminOverview(): Promise<AdminOverview> {
  const r = await adminFetch(`${BASE_URL}/admin/stats/overview`)
  if (!r.ok) throw new Error(`stats_overview_failed: ${r.status}`)
  return r.json()
}
```

- [ ] **Step 3: 타입체크**

```bash
npx -p typescript tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/services/adminApi.ts src/types/admin.ts
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : adminApi 서비스 + admin 타입 정의 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 14: AdminLoginScreen 컴포넌트

**Files:**
- Create: `src/components/admin/AdminLoginScreen.tsx`

- [ ] **Step 1: `src/components/admin/AdminLoginScreen.tsx` 작성**

```typescript
import { useState } from 'react'
import { adminLogin } from '../../services/adminApi'

interface Props {
  onLoginSuccess: () => void
  onCancel: () => void
}

export function AdminLoginScreen({ onLoginSuccess, onCancel }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ok = await adminLogin(username, password)
      if (ok) onLoginSuccess()
      else setError('아이디 또는 비밀번호가 잘못되었습니다.')
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <form onSubmit={handleSubmit} className="card-body">
          <h2 className="card-title">Admin 로그인</h2>
          <input
            type="text"
            placeholder="username"
            className="input input-bordered"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            className="input input-bordered"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-error text-sm">{error}</p>}
          <div className="card-actions justify-end mt-4">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/AdminLoginScreen.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : AdminLoginScreen 컴포넌트 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 15: AdminDashboard + WordListPage

**Files:**
- Create: `src/components/admin/AdminDashboard.tsx`
- Create: `src/components/admin/WordListPage.tsx`

- [ ] **Step 1: `src/components/admin/AdminDashboard.tsx` 작성**

```typescript
import { useState } from 'react'
import { adminLogout, getAdminUsername } from '../../services/adminApi'
import { WordListPage } from './WordListPage'
import { WordStatsPage } from './WordStatsPage'
import { AdminListPage } from './AdminListPage'

type Page = 'words' | 'stats' | 'admins'

interface Props {
  onLogout: () => void
}

export function AdminDashboard({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('words')
  const username = getAdminUsername()

  const handleLogout = async () => {
    await adminLogout()
    onLogout()
  }

  return (
    <div className="min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 shadow">
        <div className="flex-1 px-4 font-bold text-lg">PickerPicker Admin</div>
        <div className="flex-none gap-2 px-4">
          <button className={`btn btn-sm ${page === 'words' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('words')}>단어 관리</button>
          <button className={`btn btn-sm ${page === 'stats' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('stats')}>통계</button>
          <button className={`btn btn-sm ${page === 'admins' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('admins')}>관리자</button>
          <span className="text-sm text-base-content/70 mx-2">{username}</span>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>
      <main className="container mx-auto p-4">
        {page === 'words' && <WordListPage />}
        {page === 'stats' && <WordStatsPage />}
        {page === 'admins' && <AdminListPage />}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/admin/WordListPage.tsx` 작성**

```typescript
import { useEffect, useState } from 'react'
import type { Word } from '../../types/admin'
import { listWords, deleteWord } from '../../services/adminApi'
import { WordFormPage } from './WordFormPage'

export function WordListPage() {
  const [words, setWords] = useState<Word[]>([])
  const [diff, setDiff] = useState<number | undefined>()
  const [showActive, setShowActive] = useState<boolean | undefined>(true)
  const [editing, setEditing] = useState<Word | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setError('')
    try {
      const data = await listWords({ difficulty: diff, is_active: showActive })
      setWords(data)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { refresh() }, [diff, showActive])

  const handleDelete = async (w: Word) => {
    if (!confirm(`"${w.word}" 비활성화? (소프트 삭제)`)) return
    await deleteWord(w.id)
    await refresh()
  }

  if (creating) {
    return <WordFormPage onDone={() => { setCreating(false); refresh() }} onCancel={() => setCreating(false)} />
  }
  if (editing) {
    return <WordFormPage word={editing} onDone={() => { setEditing(null); refresh() }} onCancel={() => setEditing(null)} />
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <select className="select select-bordered select-sm" value={diff ?? ''} onChange={e => setDiff(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">전체 난이도</option>
          {[1,2,3,4,5].map(d => <option key={d} value={d}>난이도 {d}</option>)}
        </select>
        <select className="select select-bordered select-sm" value={String(showActive)} onChange={e => setShowActive(e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)}>
          <option value="true">활성</option>
          <option value="false">비활성</option>
          <option value="">전체</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setCreating(true)}>+ 신규 등록</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>ID</th><th>단어</th><th>난이도</th><th>BPM</th><th>입력 길이</th><th>고정 stage</th><th>상태</th><th>액션</th>
          </tr>
        </thead>
        <tbody>
          {words.map(w => (
            <tr key={w.id}>
              <td>{w.id}</td>
              <td className="font-bold">{w.word}</td>
              <td>{w.difficulty_level}</td>
              <td>{w.bpm}</td>
              <td>{w.input_length}</td>
              <td>{w.fixed_stage ?? '-'}</td>
              <td>{w.is_active ? '✅' : '❌'}</td>
              <td>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(w)}>수정</button>
                {w.is_active && <button className="btn btn-sm btn-error btn-ghost" onClick={() => handleDelete(w)}>삭제</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: 커밋 (Step 1 + 2)**

```bash
git add src/components/admin/AdminDashboard.tsx src/components/admin/WordListPage.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : AdminDashboard + WordListPage https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 16: WordFormPage (JSON 붙여넣기 + 미리보기)

**Files:**
- Create: `src/components/admin/WordFormPage.tsx`

- [ ] **Step 1: `src/components/admin/WordFormPage.tsx` 작성**

```typescript
import { useState } from 'react'
import type { Word, KeyMappingItem } from '../../types/admin'
import { createWord, updateWord } from '../../services/adminApi'

interface Props {
  word?: Word
  onDone: () => void
  onCancel: () => void
}

interface WordPayload {
  word: string
  difficulty_level: number
  bpm: number
  input_length: number
  valid_syllables: string[]
  invalid_syllables: string[]
  input_syllables: string[]
  key_mapping: KeyMappingItem[]
  fixed_stage: number | null
}

export function WordFormPage({ word, onDone, onCancel }: Props) {
  const initialJson = word ? JSON.stringify({
    word: word.word,
    difficulty_level: word.difficulty_level,
    bpm: word.bpm,
    input_length: word.input_length,
    valid_syllables: word.valid_syllables,
    invalid_syllables: word.invalid_syllables,
    input_syllables: word.input_syllables,
    key_mapping: word.key_mapping,
    fixed_stage: word.fixed_stage,
  }, null, 2) : ''

  const [json, setJson] = useState(initialJson)
  const [parsed, setParsed] = useState<WordPayload | null>(word ? JSON.parse(initialJson) : null)
  const [parseError, setParseError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleJsonChange = (text: string) => {
    setJson(text)
    setSubmitError('')
    if (!text.trim()) { setParsed(null); setParseError(''); return }
    try {
      const obj = JSON.parse(text)
      setParsed(obj)
      setParseError('')
    } catch (e) {
      setParseError(`JSON 파싱 실패: ${e}`)
      setParsed(null)
    }
  }

  const handleSubmit = async () => {
    if (!parsed) return
    setSubmitError('')
    setSubmitting(true)
    try {
      if (word) await updateWord(word.id, parsed)
      else await createWord(parsed)
      onDone()
    } catch (e) {
      setSubmitError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">{word ? `단어 수정: ${word.word}` : '신규 단어 등록'}</h2>
        <button className="btn btn-ghost ml-auto" onClick={onCancel}>← 목록으로</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label"><span className="label-text">JSON 붙여넣기</span></label>
          <textarea
            className="textarea textarea-bordered w-full h-96 font-mono text-xs"
            value={json}
            onChange={e => handleJsonChange(e.target.value)}
            placeholder='{"word":"커피","difficulty_level":1,...}'
          />
          {parseError && <p className="text-error text-sm">{parseError}</p>}
        </div>
        <div>
          <label className="label"><span className="label-text">미리보기</span></label>
          {parsed ? (
            <div className="card bg-base-100 p-4 text-sm space-y-1">
              <div><b>단어:</b> {parsed.word}</div>
              <div><b>난이도:</b> {parsed.difficulty_level}</div>
              <div><b>BPM:</b> {parsed.bpm}</div>
              <div><b>입력 길이:</b> {parsed.input_length}</div>
              <div><b>고정 stage:</b> {parsed.fixed_stage ?? '없음'}</div>
              <div><b>유효 음절:</b> {parsed.valid_syllables.join(', ')}</div>
              <div><b>무효 음절:</b> {parsed.invalid_syllables.join(', ')}</div>
              <div><b>키 매핑:</b></div>
              <table className="table table-xs">
                <thead><tr><th>키</th><th>음절</th><th>유효</th></tr></thead>
                <tbody>
                  {parsed.key_mapping.map((km, i) => (
                    <tr key={i}><td>{km.key.toUpperCase()}</td><td>{km.syllable}</td><td>{km.type === 'valid' ? '✓' : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-base-content/50 text-sm">JSON 입력 후 미리보기가 표시됩니다.</p>}
        </div>
      </div>
      {submitError && <div className="alert alert-error mt-4">{submitError}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onCancel}>취소</button>
        <button className="btn btn-primary" disabled={!parsed || submitting} onClick={handleSubmit}>
          {submitting ? '...' : (word ? '수정 저장' : '등록')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/WordFormPage.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : WordFormPage (JSON 붙여넣기 + 미리보기) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 17: WordStatsPage + AdminListPage

**Files:**
- Create: `src/components/admin/WordStatsPage.tsx`
- Create: `src/components/admin/AdminListPage.tsx`

- [ ] **Step 1: `src/components/admin/WordStatsPage.tsx` 작성**

```typescript
import { useEffect, useState } from 'react'
import type { WordGlobalStat, AdminOverview } from '../../types/admin'
import { globalWordStats, adminOverview } from '../../services/adminApi'

export function WordStatsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [stats, setStats] = useState<WordGlobalStat[]>([])
  const [sort, setSort] = useState<'exposure_desc' | 'accuracy_asc' | 'accuracy_desc'>('exposure_desc')

  useEffect(() => {
    adminOverview().then(setOverview)
  }, [])

  useEffect(() => {
    globalWordStats(sort).then(setStats)
  }, [sort])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">글로벌 통계</h2>
      {overview && (
        <div className="stats shadow mb-4 w-full">
          <div className="stat"><div className="stat-title">총 플레이어</div><div className="stat-value">{overview.total_players}</div></div>
          <div className="stat"><div className="stat-title">총 게임 세션</div><div className="stat-value">{overview.total_sessions}</div></div>
          <div className="stat"><div className="stat-title">활성 단어</div><div className="stat-value">{overview.active_word_count}</div></div>
          <div className="stat"><div className="stat-title">평균 점수</div><div className="stat-value">{overview.avg_score.toFixed(0)}</div></div>
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <select className="select select-bordered select-sm" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="exposure_desc">노출 많은 순</option>
          <option value="accuracy_asc">정확도 낮은 순 (어려움)</option>
          <option value="accuracy_desc">정확도 높은 순 (쉬움)</option>
        </select>
      </div>
      <table className="table table-zebra w-full">
        <thead><tr><th>단어</th><th>난이도</th><th>노출</th><th>정확도</th><th>상태</th></tr></thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.word_id}>
              <td className="font-bold">{s.word}</td>
              <td>{s.difficulty_level}</td>
              <td>{s.total_exposure}</td>
              <td>{(s.accuracy * 100).toFixed(1)}%</td>
              <td>{s.is_active ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/admin/AdminListPage.tsx` 작성**

```typescript
import { useEffect, useState } from 'react'
import type { AdminUser } from '../../types/admin'
import { listAdmins, createAdmin } from '../../services/adminApi'

export function AdminListPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    const data = await listAdmins()
    setAdmins(data)
  }

  useEffect(() => { refresh() }, [])

  const handleCreate = async () => {
    setError('')
    if (newPassword.length < 8) { setError('비밀번호 8자 이상'); return }
    setCreating(true)
    try {
      await createAdmin(newUsername, newPassword)
      setNewUsername(''); setNewPassword('')
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">관리자 목록</h2>
      <table className="table table-zebra w-full mb-4">
        <thead><tr><th>ID</th><th>username</th><th>생성일</th><th>등록자</th></tr></thead>
        <tbody>
          {admins.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td><td>{a.username}</td>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.created_by ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card bg-base-100 shadow p-4">
        <h3 className="font-bold mb-2">신규 관리자 등록</h3>
        <div className="flex gap-2">
          <input className="input input-bordered input-sm" placeholder="username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          <input type="password" className="input input-bordered input-sm" placeholder="password (8자+)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={!newUsername || !newPassword || creating} onClick={handleCreate}>등록</button>
        </div>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 타입체크 + 커밋**

```bash
npx -p typescript tsc --noEmit
git add src/components/admin/WordStatsPage.tsx src/components/admin/AdminListPage.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : WordStatsPage + AdminListPage https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 18: App.tsx에 /admin 라우트 추가

**Files:**
- Modify: `src/App.tsx`

현재 App.tsx는 `currentScreen` state 문자열로 화면 전환. 라우터 라이브러리 없음. URL `/admin` 인지 확인 후 진입.

- [ ] **Step 1: `src/App.tsx` 수정 — admin 모드 분기 추가**

`AppInner` 함수 상단(state 선언 직후)에 추가:

```typescript
const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
```

`useState<AppScreen>('start')` 줄 아래에 추가:

```typescript
const [adminAuthed, setAdminAuthed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  return isAdminRoute && Boolean(sessionStorage.getItem('pickerpicker_admin_token'))
})
```

기존 화면 분기(`{currentScreen === 'start' && ...}`)들을 다음으로 감싸기:

```typescript
return (
  <>
    {isAdminRoute ? (
      adminAuthed ? (
        <AdminDashboard onLogout={() => { setAdminAuthed(false); window.location.href = '/admin' }} />
      ) : (
        <AdminLoginScreen
          onLoginSuccess={() => setAdminAuthed(true)}
          onCancel={() => { window.location.href = '/' }}
        />
      )
    ) : (
      <>
        {/* 기존 화면 분기 전부 */}
        {isOffline && (...)}
        {currentScreen === 'start' && (...)}
        ...
      </>
    )}
  </>
)
```

상단 import 추가:
```typescript
import { AdminLoginScreen } from './components/admin/AdminLoginScreen'
import { AdminDashboard } from './components/admin/AdminDashboard'
```

- [ ] **Step 2: 타입체크**

```bash
npx -p typescript tsc --noEmit
```

- [ ] **Step 3: 로컬 검증**

```bash
npm run dev
# 브라우저: http://localhost:5173/admin
# → AdminLoginScreen 표시 확인
# → 로그인 시도 (실제 로그인은 백엔드 admin 필요)
```

- [ ] **Step 4: 커밋**

```bash
git add src/App.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : App.tsx /admin 라우트 분기 추가 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Phase 3 종료 — PR-C 푸시 + 배포 + 검증

- [ ] **Step 1: 푸시 + deploy**

```bash
git push origin main
# /changelog-deploy
```

- [ ] **Step 2: 운영 검증**

브라우저: `http://suh-project.synology.me:3010/admin`
- AdminLoginScreen 표시
- root / (env 비번)으로 로그인
- 단어 목록 표시 (15개 시드 확인)
- 신규 등록 — AI 생성 JSON 1개 등록 후 목록에 추가되는지 확인
- 통계 페이지 — 시드 직후라 노출 0인 상태 확인
- 관리자 페이지 — root 1명 표시

---

## Phase 4 — PR-D: 게임 흐름 전환 (FE+BE 동시)

**이슈:** #133

**파일 영향:**
- Modify: `backend/src/apis/player_router.py` (POST /players/result 확장)
- Modify: `backend/src/services/player_service.py` (stage_results 트랜잭션 처리)
- Modify: `backend/src/apis/stage_router.py` (deprecated 처리 또는 제거)
- Modify: `src/components/GameScreen.tsx` (POST /games/start 사용, stage_results 누적·전송)
- Modify: `src/components/practice/PracticeScreen.tsx` (POST /practice/start 사용)
- Modify: `src/services/playerService.ts` (saveResult 함수 stage_results 인자 추가)

---

### Task 19: BE — POST /players/result 확장

**Files:**
- Modify: `backend/src/apis/player_router.py`
- Modify: `backend/src/services/player_service.py`

- [ ] **Step 1: `backend/src/apis/player_router.py` 응답/요청 스키마 확장**

기존 `ResultRequest`에 `stage_results` 추가:

```python
class StageResultItem(BaseModel):
    word_id: int
    stage_index: int = Field(ge=1, le=15)
    perfect_count: int = Field(ge=0)
    good_count: int = Field(ge=0)
    miss_count: int = Field(ge=0)
    stage_score: int = Field(ge=0)


class ResultRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)
    score: int = Field(ge=0)
    stage: int = Field(ge=0, le=15)
    combo: int = Field(ge=0)
    stage_scores: dict[str, int] = Field(default_factory=dict)
    stage_results: list[StageResultItem] = Field(default_factory=list)
```

- [ ] **Step 2: `backend/src/services/player_service.py`의 `save_result` 함수 확장**

기존 `save_result` 함수 안에서 게임 세션 INSERT 후, stage_results를 처리. 단일 트랜잭션 유지:

```python
from src.services.word_stats_service import record_stage_result

async def save_result(
    db: AsyncSession,
    nickname: str,
    score: int,
    stage: int,
    combo: int,
    stage_scores: dict[str, int],
    stage_results: list,  # list[StageResultItem-like]
) -> dict:
    # 기존: players UPSERT, game_sessions INSERT, player_stats_daily UPSERT
    # 신규: session_word_results + word_stats

    # players 조회/생성 (기존 로직)
    player = await db.scalar(select(Player).where(Player.nickname == nickname))
    if player is None:
        raise NotFoundError(f"player {nickname} not found")

    # game_sessions INSERT
    session = GameSession(
        nickname=nickname, score=score, stage=stage, combo=combo, stage_scores=stage_scores
    )
    db.add(session)
    await db.flush()  # session.id 발급

    # stage_results 처리
    for sr in stage_results:
        await record_stage_result(
            db, session.id, player.id, sr.word_id, sr.stage_index,
            sr.perfect_count, sr.good_count, sr.miss_count, sr.stage_score,
        )

    # players UPSERT (best 갱신, play_count++)
    new_best = score > player.best_score
    if new_best:
        player.best_score = score
        player.best_combo = combo
        player.best_stage = stage
    player.play_count += 1

    # player_stats_daily UPSERT (기존 로직 유지)
    # ... 기존 코드 ...

    await db.commit()
    return {"ok": True, "new_best": new_best}
```

(기존 코드 형태는 `backend/src/services/player_service.py` 참조 후 stage_results 처리 부분만 추가하는 형태로 적용.)

- [ ] **Step 3: 통합 테스트 — `backend/tests/test_result_with_stage_results.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from src.main import app
from src.models.player import Player
from src.models.word import Word
from src.models.word_stats import WordStats
from src.models.session_word_result import SessionWordResult


@pytest.mark.asyncio
async def test_result_with_stage_results_persists_all(db_session, seeded_words, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.SECRET_KEY", "")

    player = Player(nickname="tester", best_score=0, best_stage=0, best_combo=0, play_count=0)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    words = (await db_session.execute(select(Word).limit(3))).scalars().all()

    body = {
        "nickname": "tester",
        "score": 300,
        "stage": 3,
        "combo": 10,
        "stage_scores": {"1": 100, "2": 100, "3": 100},
        "stage_results": [
            {"word_id": words[0].id, "stage_index": 1, "perfect_count": 10, "good_count": 0, "miss_count": 0, "stage_score": 100},
            {"word_id": words[1].id, "stage_index": 2, "perfect_count": 8, "good_count": 2, "miss_count": 0, "stage_score": 100},
            {"word_id": words[2].id, "stage_index": 3, "perfect_count": 5, "good_count": 3, "miss_count": 2, "stage_score": 100},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/players/result", json=body)
    assert r.status_code == 200

    # raw 기록 3개
    swrs = (await db_session.execute(select(SessionWordResult))).scalars().all()
    assert len(swrs) == 3

    # word_stats 3개 (각 word당 1행)
    wss = (await db_session.execute(select(WordStats).where(WordStats.player_id == player.id))).scalars().all()
    assert len(wss) == 3
```

- [ ] **Step 4: 테스트 실행 + 커밋**

```bash
cd backend && uv run pytest tests/test_result_with_stage_results.py -v
git add backend/src/apis/player_router.py backend/src/services/player_service.py backend/tests/test_result_with_stage_results.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : /players/result 확장 — stage_results raw+집계 동시 저장 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 20: BE — /stages 제거 (deprecated → 제거)

**Files:**
- Modify: `backend/src/main.py` (라우터 등록 줄 제거)
- Delete: `backend/src/apis/stage_router.py`

- [ ] **Step 1: stage_router 등록 줄 제거**

`backend/src/main.py`에서:
```python
from src.apis.stage_router import router as stage_router
# ...
app.include_router(stage_router)
```
두 줄 제거.

- [ ] **Step 2: 파일 삭제**

```bash
rm backend/src/apis/stage_router.py
```

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main.py
git rm backend/src/apis/stage_router.py
git commit -m "동적 단어 풀 + Admin 콘솔 : refactor : 정적 /stages 엔드포인트 제거 (DB 추첨으로 대체) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 21: FE — playerService에 saveResult 함수 stage_results 인자 추가

**Files:**
- Modify: `src/services/playerService.ts`

- [ ] **Step 1: `src/services/playerService.ts` 확인 후 saveResult 타입 확장**

```typescript
export interface StageResultItem {
  word_id: number
  stage_index: number
  perfect_count: number
  good_count: number
  miss_count: number
  stage_score: number
}

export async function saveResult(payload: {
  nickname: string
  score: number
  stage: number
  combo: number
  stage_scores: Record<string, number>
  stage_results: StageResultItem[]
}): Promise<{ ok: boolean; new_best: boolean }> {
  const r = await apiFetch(`${BASE_URL}/players/result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`save_result_failed: ${r.status}`)
  return r.json()
}
```

(기존 `saveResult` 시그니처가 다르면 호출부 전부 확인 + 변경.)

- [ ] **Step 2: 커밋**

```bash
git add src/services/playerService.ts
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : saveResult에 stage_results 인자 추가 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 22: FE — GameScreen.tsx /games/start 사용 + stage_results 누적

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: 정적 JSON fetch 제거 + /games/start 호출로 교체**

기존 (95-99행):
```typescript
fetch('/rhythm_stages_001_015.json')
  .then(...)
  .then(data => {
    setShuffledKeyMapping(shuffleKeyMapping(data.stages[0].keyMapping))
    setGameData(data)
  })
```

변경:
```typescript
import { apiFetch } from '../services/authService'
// ...
apiFetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/games/start`, { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    // 응답: { stages: [Word, ...15] } — 기존 gameData 구조와 맞추기 위해 래핑
    const gd = { gameTitle: '', version: '', keyLayout: [], rules: {}, stages: data.stages }
    setShuffledKeyMapping(shuffleKeyMapping(data.stages[0].key_mapping))
    setGameData(gd as any)
  })
  .catch(async err => {
    console.error('게임 시작 실패', err)
    // 422 응답 본문 파싱하여 풀 부족 메시지 분기
    if (err?.response?.status === 422) {
      const detail = await err.response.text()
      if (detail.includes('insufficient_word_pool')) {
        alert('단어 풀이 부족합니다. 관리자에게 단어 등록을 요청하세요.')
        onHome()
        return
      }
    }
    alert('게임 시작 실패. 네트워크 또는 서버 오류.')
    onHome()
  })
```

다른 `data.stages[stageIndex].keyMapping` 참조도 `key_mapping`(snake_case)으로 통일. 또는 응답 매핑 함수에서 camelCase 변환.

**snake_case ↔ camelCase 통일 결정:** 응답을 그대로 쓰되 GameScreen 내부에서 사용하는 필드명을 BE 응답 필드명(`key_mapping`, `input_syllables`, `input_length`, `valid_syllables`, `invalid_syllables`)으로 갈아끼움. 타입체크로 누락 발견.

- [ ] **Step 2: stage_results 누적 — useState 추가**

```typescript
const [stageResults, setStageResults] = useState<StageResultItem[]>([])
```

stage 클리어/실패 시점에 추가:

```typescript
const recordStageResult = (word_id: number, stage_index: number, perfect: number, good: number, miss: number, score: number) => {
  setStageResults(prev => [...prev, {
    word_id, stage_index,
    perfect_count: perfect, good_count: good, miss_count: miss,
    stage_score: score,
  }])
}
```

stage 종료 핸들러(스테이지 클리어/실패 분기)에 호출 추가:

```typescript
recordStageResult(
  currentStage.id,  // word_id
  stageIndex + 1,
  perfectCount,
  goodCount,
  missCount,
  stageScore,
)
```

- [ ] **Step 3: 게임 종료 시 saveResult 호출에 stage_results 포함**

```typescript
await saveResult({
  nickname,
  score: totalScore,
  stage: reachedStage,
  combo: maxCombo,
  stage_scores: stageScoresMap,
  stage_results: stageResults,
})
```

- [ ] **Step 4: 타입체크 + 로컬 테스트**

```bash
npx -p typescript tsc --noEmit
npm run dev
# 게임 1회 플레이 → 게임오버 → 백엔드 game_sessions/word_stats/session_word_results 모두 들어왔는지 확인
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/GameScreen.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : GameScreen /games/start 사용 + stage_results 누적 전송 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 23: FE — PracticeScreen.tsx /practice/start 사용

**Files:**
- Modify: `src/components/practice/PracticeScreen.tsx`

- [ ] **Step 1: 정적 JSON fetch 제거 + /practice/start 호출**

```typescript
apiFetch(`${BASE_URL}/practice/start`, { method: 'POST' })
  .then(r => r.json())
  .then(data => {
    const gd = { stages: data.stages }
    setGameData(gd as any)
  })
```

기존 `slice(start, start+3)` 로직은 응답이 이미 3개이므로 제거 또는 안전망 유지.

- [ ] **Step 2: 타입체크 + 커밋**

```bash
npx -p typescript tsc --noEmit
git add src/components/practice/PracticeScreen.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : PracticeScreen /practice/start 사용 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 24: 정적 JSON 파일 처리

**Files:**
- 옵션 1: 유지 (Alembic 시드용 참조)
- 옵션 2: backend/data로 이동 (FE에서 더 이상 fetch 안 함)

- [ ] **Step 1: public/ 경로에서 정적 JSON 접근 불필요 확인**

```bash
grep -r "rhythm_stages_001_015.json" src/
```
출력 없어야 함 (Phase 4에서 모든 fetch 제거됨).

- [ ] **Step 2: 파일은 그대로 유지** — `docs/rhythm_stages_001_015.json`이 seed.py에서 참조됨. 삭제 금지.

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```

Expected: 빌드 성공.

---

### Phase 4 종료 — PR-D 푸시 + 배포 + 검증

브레이킹 변경 — FE/BE 동시 배포 필수.

- [ ] **Step 1: 푸시 + deploy**

```bash
git push origin main
# /changelog-deploy
```

- [ ] **Step 2: 운영 검증**

- 게임 1회 풀 플레이 (15 stage 모두 클리어 또는 게임오버)
- 게임오버 후 백엔드 DB 확인:
  ```bash
  docker exec pickerpicker-back uv run python -c "
  import asyncio
  from sqlalchemy import select, func
  from src.core.database import AsyncSessionLocal
  from src.models.session_word_result import SessionWordResult
  from src.models.word_stats import WordStats
  async def run():
      async with AsyncSessionLocal() as s:
          a = await s.scalar(select(func.count()).select_from(SessionWordResult))
          b = await s.scalar(select(func.count()).select_from(WordStats))
          print(f'session_word_results: {a}, word_stats: {b}')
  asyncio.run(run())
  "
  ```
- Practice 모드 → `/practice/start` 호출 + 통계 미반영 확인

---

## Phase 5 — PR-E: GameOver 가로 2단 + Stats 단어 섹션

**이슈:** #133

**파일 영향:**
- Create: `src/components/GameOverWordCards.tsx` (단어 카드 컴포넌트)
- Modify: `src/components/GameScreen.tsx` (게임오버 화면 부분 — 가로 2단 레이아웃)
- Modify: `src/components/StatsScreen.tsx` (단어 분석 섹션 추가)
- Modify: `backend/src/apis/stats_router.py` 또는 `backend/src/services/stats_service.py` (단어 분석 응답 추가)
- Create: `backend/src/services/word_player_stats_service.py`
- Create: `backend/tests/test_word_player_stats.py`

---

### Task 25: BE — 본인 단어별 통계 응답 추가

**Files:**
- Modify: `backend/src/apis/stats_router.py` 또는 `backend/src/services/stats_service.py`

- [ ] **Step 1: `backend/src/services/stats_service.py`에 함수 추가**

```python
from src.models.word_stats import WordStats
from src.models.word import Word

async def player_word_stats(db: AsyncSession, player_id: int) -> dict:
    """본인 단어 분석 — 많이 만난/어려운/잘하는 TOP5."""
    from sqlalchemy import select, func, desc, asc

    perfect = WordStats.perfect_count
    good = WordStats.good_count
    miss = WordStats.miss_count
    total = perfect + good + miss
    accuracy_expr = (perfect + good * 0.5) / func.nullif(total, 0)

    base = (
        select(
            Word.id, Word.word, Word.difficulty_level,
            WordStats.exposure_count,
            accuracy_expr.label("accuracy"),
        )
        .join(WordStats, WordStats.word_id == Word.id)
        .where(WordStats.player_id == player_id)
    )

    most_played = (await db.execute(
        base.order_by(WordStats.exposure_count.desc()).limit(5)
    )).all()

    hardest = (await db.execute(
        base.where(WordStats.exposure_count >= 3).order_by(accuracy_expr.asc()).limit(5)
    )).all()

    easiest = (await db.execute(
        base.where(WordStats.exposure_count >= 3).order_by(accuracy_expr.desc()).limit(5)
    )).all()

    total_played = await db.scalar(
        select(func.count()).select_from(WordStats).where(WordStats.player_id == player_id)
    ) or 0

    def fmt(rows):
        return [
            {"id": r.id, "word": r.word, "difficulty_level": r.difficulty_level,
             "exposure_count": r.exposure_count, "accuracy": float(r.accuracy or 0)}
            for r in rows
        ]

    return {
        "played": total_played,
        "most_played": fmt(most_played),
        "hardest": fmt(hardest),
        "easiest": fmt(easiest),
    }
```

- [ ] **Step 2: `backend/src/apis/stats_router.py`의 기존 `/players/{nickname}/stats` 응답 확장**

```python
@router.get("/players/{nickname}/stats")
async def get_player_stats(
    nickname: str,
    db: AsyncSession = Depends(get_db),
    # 인증 dependency (기존)
):
    # 기존 응답
    existing = await stats_service.compute_stats(db, nickname)

    # 단어 분석 추가
    player = await db.scalar(select(Player).where(Player.nickname == nickname))
    if player:
        existing["words"] = await stats_service.player_word_stats(db, player.id)
    return existing
```

(기존 함수명/구조는 코드 확인 후 적절히 통합.)

- [ ] **Step 3: 테스트 — `backend/tests/test_word_player_stats.py`**

```python
import pytest
from sqlalchemy import select
from src.services.stats_service import player_word_stats
from src.models.player import Player
from src.models.word import Word
from src.models.word_stats import WordStats


@pytest.mark.asyncio
async def test_player_word_stats_returns_top5(db_session, seeded_words):
    player = Player(nickname="t")
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    words = (await db_session.execute(select(Word).limit(6))).scalars().all()
    # 6개 word에 stats 채워서 hardest/most_played/easiest 각각 5개 반환되는지 확인
    for i, w in enumerate(words):
        ws = WordStats(
            player_id=player.id, word_id=w.id,
            exposure_count=10 + i,
            perfect_count=10 if i < 3 else 1,
            good_count=0,
            miss_count=0 if i < 3 else 9,
            best_score=100,
        )
        db_session.add(ws)
    await db_session.commit()

    result = await player_word_stats(db_session, player.id)
    assert result["played"] == 6
    assert len(result["most_played"]) == 5
    assert len(result["hardest"]) == 5
    assert len(result["easiest"]) == 5
```

- [ ] **Step 4: 테스트 실행 + 커밋**

```bash
cd backend && uv run pytest tests/test_word_player_stats.py -v
git add backend/src/services/stats_service.py backend/src/apis/stats_router.py backend/tests/test_word_player_stats.py
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : 본인 단어별 통계 응답 추가 (TOP5 most/hardest/easiest) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 26: FE — GameOverWordCards 컴포넌트

**Files:**
- Create: `src/components/GameOverWordCards.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
import type { StageResultItem } from '../services/playerService'

interface Props {
  results: StageResultItem[]
  wordsLookup: Record<number, { word: string; difficulty_level: number }>
  globalAccuracy?: Record<number, number>  // word_id → 전역 평균 정확도
}

export function GameOverWordCards({ results, wordsLookup, globalAccuracy }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
      {results.map((r, i) => {
        const word = wordsLookup[r.word_id]
        const total = r.perfect_count + r.good_count + r.miss_count
        const myAcc = total > 0 ? (r.perfect_count + r.good_count * 0.5) / total : 0
        const globAcc = globalAccuracy?.[r.word_id]
        return (
          <div key={i} className="card bg-base-100 shadow p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">{word?.word ?? '?'}</span>
              <span className="badge badge-sm">Lv {word?.difficulty_level ?? '?'}</span>
            </div>
            <div className="text-xs mt-1">
              <div>정확도: <b>{(myAcc * 100).toFixed(1)}%</b></div>
              {globAcc !== undefined && (
                <div className="text-base-content/60">
                  전체: {(globAcc * 100).toFixed(1)}%
                  {myAcc > globAcc ? ' 🔥' : myAcc < globAcc ? ' ↓' : ''}
                </div>
              )}
              <div>점수: {r.stage_score}</div>
              <div className="flex gap-1 mt-1">
                <span className="badge badge-success badge-xs">P {r.perfect_count}</span>
                <span className="badge badge-info badge-xs">G {r.good_count}</span>
                <span className="badge badge-error badge-xs">M {r.miss_count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/GameOverWordCards.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : GameOverWordCards 컴포넌트 (단어 카드 그리드) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 27: FE — GameScreen 게임오버 가로 2단 적용

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: 게임오버 화면 JSX 부분을 가로 2단으로 변경**

기존 세로 1단:
```jsx
<div className="flex flex-col items-center">
  <h1>GAME OVER</h1>
  <div>점수: {score}</div>
  <div>스테이지: {stage}</div>
  <div>콤보: {combo}</div>
  ...
</div>
```

변경:
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 max-w-6xl mx-auto">
  <div className="flex flex-col items-center lg:items-start">
    <h1 className="text-4xl font-bold mb-4">GAME OVER</h1>
    <div className="stats stats-vertical shadow">
      <div className="stat"><div className="stat-title">최종 점수</div><div className="stat-value">{score}</div></div>
      <div className="stat"><div className="stat-title">도달 스테이지</div><div className="stat-value">{stage}</div></div>
      <div className="stat"><div className="stat-title">최고 콤보</div><div className="stat-value">{combo}</div></div>
    </div>
    {/* 기존 버튼들 */}
  </div>
  <div>
    <h2 className="text-xl font-bold mb-2">이번 판 단어</h2>
    <GameOverWordCards
      results={stageResults}
      wordsLookup={Object.fromEntries((gameData?.stages ?? []).map((w: any) => [w.id, { word: w.word, difficulty_level: w.difficulty_level }]))}
    />
  </div>
</div>
```

import 추가: `import { GameOverWordCards } from './GameOverWordCards'`.

- [ ] **Step 2: 타입체크 + 로컬 확인**

```bash
npx -p typescript tsc --noEmit
npm run dev
# 게임오버 → 가로 2단 + 단어 카드 그리드 확인
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/GameScreen.tsx
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : GameOverScreen 가로 2단 + 단어 카드 그리드 적용 https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Task 28: FE — StatsScreen 단어 분석 섹션

**Files:**
- Modify: `src/components/StatsScreen.tsx`
- Modify: `src/services/statsService.ts` (응답 타입 확장)

- [ ] **Step 1: `src/services/statsService.ts` 응답 타입 확장**

```typescript
export interface WordSummary {
  id: number
  word: string
  difficulty_level: number
  exposure_count: number
  accuracy: number
}

export interface PlayerStats {
  // 기존 필드들 그대로
  ...
  words?: {
    played: number
    most_played: WordSummary[]
    hardest: WordSummary[]
    easiest: WordSummary[]
  }
}
```

- [ ] **Step 2: `src/components/StatsScreen.tsx` 단어 섹션 추가**

기존 JSX 끝에 추가:

```jsx
{stats.words && (
  <div className="card bg-base-100 shadow p-4 mt-4">
    <h3 className="font-bold text-lg mb-2">단어별 분석 ({stats.words.played}개 단어 경험)</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <WordSummaryList title="🔥 많이 만난 TOP5" rows={stats.words.most_played} />
      <WordSummaryList title="😈 가장 어려웠던 TOP5" rows={stats.words.hardest} />
      <WordSummaryList title="✨ 가장 잘하는 TOP5" rows={stats.words.easiest} />
    </div>
  </div>
)}
```

`WordSummaryList` 컴포넌트 (같은 파일 안 또는 분리):

```typescript
function WordSummaryList({ title, rows }: { title: string; rows: WordSummary[] }) {
  return (
    <div>
      <h4 className="font-bold text-sm mb-1">{title}</h4>
      <ul className="text-xs space-y-1">
        {rows.length === 0 && <li className="text-base-content/50">데이터 부족</li>}
        {rows.map(r => (
          <li key={r.id} className="flex justify-between">
            <span><b>{r.word}</b> <span className="badge badge-xs">L{r.difficulty_level}</span></span>
            <span className="text-base-content/70">{r.exposure_count}회 / {(r.accuracy * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: 타입체크 + 로컬 확인 + 커밋**

```bash
npx -p typescript tsc --noEmit
npm run dev
# Stats 화면 → 단어 분석 섹션 표시 확인
git add src/components/StatsScreen.tsx src/services/statsService.ts
git commit -m "동적 단어 풀 + Admin 콘솔 : feat : StatsScreen 단어별 분석 섹션 (TOP5 most/hardest/easiest) https://github.com/PickerPicker/PickerPicker/issues/133"
```

---

### Phase 5 종료 — PR-E 푸시 + 배포 + 검증 + 이슈 마무리

- [ ] **Step 1: 푸시 + deploy**

```bash
git push origin main
# /changelog-deploy
```

- [ ] **Step 2: 운영 검증**

- 게임 1회 플레이 → GameOver 가로 2단 + 단어 카드 그리드 확인
- Stats 화면 → 단어 분석 섹션 (TOP5 3종) 확인
- Admin /admin/stats/words → 전역 정확도/노출 확인

- [ ] **Step 3: 이슈 #133 마무리**

```
/suh-report   → 구현 보고서 작성 → 이슈 댓글 등록
/suh-testcase → QA 테스트케이스 작성 → 이슈 댓글 등록
라벨 변경: 작업중 → 작업완료
```

- [ ] **Step 4: 이슈 #134 마무리 (Phase 1 종료 시 이미 처리됨)**

- [ ] **Step 5: 이슈 #135은 그대로 두기 (후속 작업)**

---

## 부록 A — 환경변수 추가 사항

`backend/.env`:
```
INITIAL_ADMIN_USERNAME=root
INITIAL_ADMIN_PASSWORD=<강력한 비번 16자+>
```

GitHub Secrets `BACKEND_ENV_FILE`에 동일 두 줄 추가.

---

## 부록 B — 롤백 절차

| Phase | 롤백 명령 |
|-------|----------|
| 1 (Alembic+BigInt) | `alembic downgrade -1` (BigInt 되돌림) |
| 2 (신규 테이블) | `alembic downgrade -1` (테이블 DROP, 운영 데이터 손실 가능) |
| 3 (FE admin) | FE 이전 버전 배포 (DB 영향 없음) |
| 4 (게임 흐름) | FE+BE 동시 이전 버전 롤백 + `alembic stamp <이전 revision>` |
| 5 (UI 개편) | FE 이전 버전 배포 |

---

## 부록 C — 자체 검증 체크리스트

배포 직전 매번 확인:
- [ ] `npx -p typescript tsc --noEmit` 성공
- [ ] `uv run pytest tests/` 전부 PASS
- [ ] `npm run build` 성공
- [ ] `alembic upgrade head` 멱등성 확인 (두 번 실행 시 오류 없음)
- [ ] 시드 idempotent — words 두 번째 실행 시 중복 INSERT 안 됨
- [ ] HMAC 헤더 없이 `/admin/*` 호출 시 401
- [ ] admin 토큰 만료 시 401
- [ ] 풀 부족 시 422
