"""src.services.admin_auth_service
Admin 로그인/로그아웃/토큰 검증/admin 생성. player 인증과 완전 격리.
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
    """토큰 폐기. 존재하지 않아도 조용히 통과."""
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
    """신규 admin 등록. username 중복 시 IntegrityError → 호출자가 409로 처리."""
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    admin = Admin(username=username, password_hash=password_hash, created_by=created_by_id)
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    logger.info(f"admin 생성: {username} by admin_id={created_by_id}")
    return admin
