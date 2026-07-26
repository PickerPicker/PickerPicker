"""src.main
FastAPI 애플리케이션 진입점
"""
import asyncio
import time
import logging
from contextlib import asynccontextmanager
import sqlalchemy as sa
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.core.logging import setup_logging
from src.core.config import settings
from src.core.signing import build_signature_message, verify
from src.core.database import engine, AsyncSessionLocal
from src.core.cleanup import cleanup_loop
from src.core.seed import seed_words, seed_admin
import src.models  # 모든 모델 import (Alembic autogenerate 메타데이터 등록용)
from src.apis.player_router import router as player_router
from src.apis.ranking_router import router as ranking_router
from src.apis.auth_router import router as auth_router
from src.apis.stats_router import router as stats_router
from src.apis.hall_of_fame_router import router as hall_of_fame_router
from src.apis.admin_router import router as admin_router
from src.apis.games_router import router as games_router

setup_logging(log_level="INFO")
logger = logging.getLogger(__name__)

# 서명 검증 제외 경로 (헬스체크, Swagger UI)
_PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

# 타임스탬프 허용 오차: 5분
_SIGNATURE_EXPIRATION_MS = 300_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 DB 연결 확인 + 클린업 백그라운드, 종료 시 엔진 정리.

    DB 스키마 관리는 Alembic이 담당한다 (Docker entrypoint의 run_migrations.sh).
    """
    logger.info("=== PickerPicker 백엔드 시작 ===")

    # prod에서 SECRET_KEY가 비면 HMAC 검증이 통째로 꺼진 채(fail-open) 뜬다.
    # 로그 한 줄 없이 전 API가 무방비가 되므로 아예 기동을 막는다.
    if settings.ENVIRONMENT == "prod" and not settings.SECRET_KEY:
        raise RuntimeError(
            "prod 환경에서 SECRET_KEY가 비어 있습니다. "
            "HMAC 서명 검증이 비활성화되므로 기동을 중단합니다."
        )
    if not settings.SECRET_KEY:
        logger.warning("SECRET_KEY 미설정 — HMAC 서명 검증이 비활성화됩니다 (개발 환경 전용)")

    cleanup_task: asyncio.Task | None = None
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        logger.info("DB 연결 확인 완료")

        # 자동 시드 (words + admins) — 멱등
        async with AsyncSessionLocal() as session:
            await seed_words(session)
            await seed_admin(session)
    except Exception as e:
        logger.warning(f"DB 초기 연결/시드 실패 (서버는 계속 실행): {e}")

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
app.include_router(auth_router)
app.include_router(stats_router)
app.include_router(hall_of_fame_router)
app.include_router(admin_router)
app.include_router(games_router)


class HMACSignatureMiddleware:
    """HMAC-SHA256 + Timestamp 서명 검증 — 공개 경로 및 OPTIONS(CORS preflight) 제외.

    순수 ASGI 미들웨어로 구현한 이유: 서명 대상에 요청 본문이 포함되므로 미들웨어에서
    body를 읽어야 하는데, BaseHTTPMiddleware에서 body를 소비하면 Starlette 버전에 따라
    다운스트림 라우트가 본문을 다시 읽지 못한다. 여기서는 읽은 body를 직접 replay한다.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        method: str = scope["method"]
        path: str = scope.get("path", "")

        if (
            not settings.SECRET_KEY
            or method == "OPTIONS"
            or path in _PUBLIC_PATHS
            or path.startswith("/docs")
        ):
            return await self.app(scope, receive, send)

        # body를 전부 읽어둔다 (게임 API 특성상 본문이 작아 메모리 부담 없음)
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] != "http.request":
                break
            body += message.get("body", b"")
            more_body = message.get("more_body", False)

        error = self._verify(scope, method, path, body)
        if error is not None:
            headers = dict(scope.get("headers") or [])
            origin = headers.get(b"origin", b"*").decode("latin-1")
            # 401에도 CORS 헤더 포함 — 이 미들웨어가 CORSMiddleware보다 바깥에서 실행된다
            response = JSONResponse(
                status_code=401,
                content={"detail": error},
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "false",
                },
            )
            return await response(scope, receive, send)

        # 소비한 body를 다운스트림에 그대로 재공급
        replayed = False

        async def replay_receive():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)

    def _verify(self, scope, method: str, path: str, body: bytes) -> str | None:
        """검증 실패 시 에러 메시지, 통과 시 None."""
        headers = dict(scope.get("headers") or [])
        signature = headers.get(b"x-signature", b"").decode("latin-1")
        timestamp_str = headers.get(b"x-timestamp", b"").decode("latin-1")

        if not signature or not timestamp_str:
            logger.warning(f"서명 헤더 누락: {method} {path}")
            return "Missing signature headers"

        try:
            timestamp = int(timestamp_str)
        except ValueError:
            logger.warning(f"타임스탬프 형식 오류: {timestamp_str}")
            return "Invalid timestamp"

        # 타임스탬프 만료 검증 (±5분)
        if abs(int(time.time() * 1000) - timestamp) > _SIGNATURE_EXPIRATION_MS:
            logger.warning(f"타임스탬프 만료: {method} {path}")
            return "Expired timestamp"

        query = (scope.get("query_string") or b"").decode("latin-1")
        message = build_signature_message(timestamp_str, method, path, query, body)

        if not verify(settings.SECRET_KEY, message, signature):
            logger.warning(f"서명 불일치: {method} {path}")
            return "Invalid signature"

        return None


app.add_middleware(HMACSignatureMiddleware)


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
