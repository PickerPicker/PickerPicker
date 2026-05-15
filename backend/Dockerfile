FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# uv 설치
RUN pip install --no-cache-dir uv

# 의존성 먼저 복사 (캐시 레이어 활용)
COPY pyproject.toml ./

# 의존성 설치
RUN uv pip install --system --no-cache \
    fastapi \
    "uvicorn[standard]" \
    pydantic \
    pydantic-settings \
    asyncpg \
    "sqlalchemy[asyncio]" \
    alembic \
    python-dotenv

COPY src/ ./src/
COPY .env ./.env

ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV ENVIRONMENT=prod

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
