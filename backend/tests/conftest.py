"""pytest fixture — async DB 세션. (내부망 환경에서는 실행 안 됨, 외부 환경 검증용)"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Base와 모든 모델 메타데이터를 로드 (create_all이 모든 테이블을 생성하도록)
from src.core.database import Base
import src.models  # noqa: F401 — 모든 모델 import (메타데이터 등록)


@pytest_asyncio.fixture
async def db_session():
    """테스트용 격리 DB 세션. 매 테스트마다 drop_all → create_all로 깨끗한 상태."""
    engine = create_async_engine(
        "postgresql+asyncpg://localhost/test_pickerpicker", echo=False
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    await engine.dispose()
