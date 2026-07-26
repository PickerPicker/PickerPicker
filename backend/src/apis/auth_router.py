"""src.apis.auth_router
세션 토큰 발급/회수 API.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import bearer_token
from src.core.rate_limit import (
    enforce_pin_rate_limit,
    record_pin_failure,
    reset_pin_attempts,
)
from src.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """PIN 검증 후 세션 토큰 발급. 실패 시 401, 시도 과다 시 429."""
    enforce_pin_rate_limit(request, body.nickname)

    result = await auth_service.login(db, body.nickname, body.pin)
    if result is None:
        record_pin_failure(request, body.nickname)
        raise HTTPException(status_code=401, detail="닉네임 또는 PIN이 올바르지 않습니다")

    reset_pin_attempts(request, body.nickname)
    token, expires_at = result
    return LoginResponse(token=token, expires_at=expires_at)


@router.post("/logout", status_code=204)
async def logout(
    token: str | None = Depends(bearer_token),
    db: AsyncSession = Depends(get_db),
):
    """토큰 폐기. 토큰 없어도 204 (멱등)."""
    if token:
        await auth_service.logout(db, token)
    return None
