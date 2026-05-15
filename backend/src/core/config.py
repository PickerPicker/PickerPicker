"""src.core.config
환경변수 기반 설정 (pydantic-settings)
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # PostgreSQL 연결
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host:port/dbname

    # 서버
    ENVIRONMENT: str = "dev"  # dev | prod
    API_KEY: str = ""  # 간단한 API 키 인증 (선택)

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
