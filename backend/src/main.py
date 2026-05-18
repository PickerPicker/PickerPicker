"""src.main
FastAPI 애플리케이션 진입점
"""
import asyncio
import hashlib
import hmac
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.core.logging import setup_logging
from src.core.config import settings
from src.core.database import engine, Base
from src.core.cleanup import cleanup_loop
import src.models  # 모든 모델 import (create_all 인식용)
from src.apis.player_router import router as player_router
from src.apis.ranking_router import router as ranking_router
from src.apis.stage_router import router as stage_router
from src.apis.auth_router import router as auth_router
from src.apis.stats_router import router as stats_router

setup_logging(log_level="INFO")
logger = logging.getLogger(__name__)

# 서명 검증 제외 경로 (헬스체크, Swagger UI)
_PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

# 타임스탬프 허용 오차: 5분
_SIGNATURE_EXPIRATION_MS = 300_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 DB 테이블 자동 생성 + 클린업 백그라운드, 종료 시 엔진 정리"""
    logger.info("=== PickerPicker 백엔드 시작 ===")

    cleanup_task: asyncio.Task | None = None
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("DB 테이블 준비 완료")
    except Exception as e:
        logger.warning(f"DB 초기 연결 실패 (서버는 계속 실행): {e}")

    try:
        cleanup_task = asyncio.create_task(cleanup_loop())
        logger.info("클린업 백그라운드 작업 시작 (1시간 주기)")
    except Exception as e:
        logger.warning(f"클린업 작업 시작 실패: {e}")

    yield

    if cleanup_task and not cleanup_task.done():
        cleanup_task.cancel()
        try:
            await cleanup_task
        except (asyncio.CancelledError, Exception):
            pass

    await engine.dispose()
    logger.info("=== 애플리케이션 종료 ===")


app = FastAPI(
    title="PickerPicker API",
    description="PickerPicker 게임 백엔드 API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 전체 허용 (allow_credentials=True와 allow_origins=["*"] 동시 사용 불가)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(player_router)
app.include_router(ranking_router)
app.include_router(stage_router)
app.include_router(auth_router)
app.include_router(stats_router)


@app.middleware("http")
async def hmac_signature_guard(request: Request, call_next):
    """HMAC-SHA256 + Timestamp 서명 검증 — 공개 경로 및 OPTIONS(CORS preflight) 제외"""
    if (
        settings.SECRET_KEY
        and request.method != "OPTIONS"
        and request.url.path not in _PUBLIC_PATHS
        and not request.url.path.startswith("/docs")
    ):
        signature = request.headers.get("X-Signature", "")
        timestamp_str = request.headers.get("X-Timestamp", "")

        if not signature or not timestamp_str:
            logger.warning(f"서명 헤더 누락: {request.method} {request.url.path}")
            return JSONResponse(status_code=401, content={"detail": "Missing signature headers"})

        try:
            timestamp = int(timestamp_str)
        except ValueError:
            logger.warning(f"타임스탬프 형식 오류: {timestamp_str}")
            return JSONResponse(status_code=401, content={"detail": "Invalid timestamp"})

        # 타임스탬프 만료 검증 (±5분)
        if abs(int(time.time() * 1000) - timestamp) > _SIGNATURE_EXPIRATION_MS:
            logger.warning(f"타임스탬프 만료: {request.method} {request.url.path}")
            return JSONResponse(status_code=401, content={"detail": "Expired timestamp"})

        # HMAC-SHA256(timestamp, secretKey) 검증 — constant-time 비교로 timing attack 방지
        expected = hmac.new(
            settings.SECRET_KEY.encode(),
            timestamp_str.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            logger.warning(f"서명 불일치: {request.method} {request.url.path}")
            return JSONResponse(status_code=401, content={"detail": "Invalid signature"})

    return await call_next(request)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    """요청 처리 시간 로깅 미들웨어"""
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}"
    logger.info(f"{request.method} {request.url.path} - {elapsed:.4f}s")
    return response


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
