"""pytest fixture — async DB 세션.

DB가 필요한 테스트만 이 fixture를 쓴다. 순수 로직 테스트(test_signing/test_pin_hash/
test_rate_limit)는 DB 없이 돈다.
"""
import os

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Base와 모든 모델 메타데이터를 로드 (create_all이 모든 테이블을 생성하도록)
from src.core.database import Base
import src.models  # noqa: F401 — 모든 모델 import (메타데이터 등록)

# 로컬 기본값은 기존 동작 유지, CI에서는 서비스 컨테이너 주소를 주입한다.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+asyncpg://localhost/test_pickerpicker"
)

# 안전장치 — 이 fixture는 매 테스트마다 drop_all을 실행한다.
# 운영 DB를 가리킨 채 돌면 전체 데이터가 사라지므로 이름으로 한 번 더 막는다.
if "test" not in TEST_DATABASE_URL.rsplit("/", 1)[-1].lower():
    raise RuntimeError(
        f"테스트 DB가 아닌 곳을 가리키고 있습니다: {TEST_DATABASE_URL!r}\n"
        "이 fixture는 drop_all을 실행하므로 DB 이름에 'test'가 포함되어야 합니다."
    )


@pytest_asyncio.fixture
async def db_session():
    """테스트용 격리 DB 세션. 매 테스트마다 drop_all → create_all로 깨끗한 상태."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    await engine.dispose()
