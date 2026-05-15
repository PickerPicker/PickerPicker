"""src.core.logging
표준 logging 설정 (tripgether-python 스타일)
"""
import logging
import sys
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler
from src.core.config import settings


def setup_logging(log_level: str = "INFO", log_file: str = "logs/app.log"):
    """로깅 초기화"""
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # prod 환경에서만 파일 로그 저장
    if settings.ENVIRONMENT == "prod":
        Path("logs").mkdir(exist_ok=True)
        file_handler = TimedRotatingFileHandler(
            log_file, when="midnight", backupCount=7, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
