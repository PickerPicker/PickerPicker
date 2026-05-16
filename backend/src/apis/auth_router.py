"""src.apis.auth_router
세션 토큰 발급/회수 API.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """PIN 검증 후 세션 토큰 발급. 실패 시 401."""
    result = await auth_service.login(db, body.nickname, body.pin)
    if result is None:
        raise HTTPException(status_code=401, detail="닉네임 또는 PIN이 올바르지 않습니다")
    token, expires_at = result
    return LoginResponse(token=token, expires_at=expires_at)


@router.post("/logout", status_code=204)
async def logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """토큰 폐기. 토큰 없어도 204."""
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            await auth_service.logout(db, parts[1])
    return None
