"""src.core.seed 단위 테스트. (내부망 환경에서는 실행 안 됨, 외부 환경 검증용)"""
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
    await seed_words(db_session)
    count = await db_session.scalar(select(func.count()).select_from(Word))
    assert count == 15


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
