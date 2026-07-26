"""Admin 인증 단위 테스트."""
import pytest
import bcrypt
from datetime import timedelta

from src.core.timeutil import utcnow
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
    assert expires_at > utcnow()


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
        expires_at=utcnow() + timedelta(hours=1)
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
        expires_at=utcnow() - timedelta(seconds=1)
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
        expires_at=utcnow() + timedelta(hours=1)
    ))
    await db_session.commit()

    await admin_auth_service.logout(db_session, "t1")
    result = await admin_auth_service.verify_token(db_session, "t1")
    assert result is None
