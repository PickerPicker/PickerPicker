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
