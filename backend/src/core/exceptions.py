"""src.core.exceptions
커스텀 예외 (Spring CustomException 스타일)
"""
from fastapi import HTTPException


class NotFoundError(HTTPException):
    def __init__(self, message: str = "리소스를 찾을 수 없습니다"):
        super().__init__(status_code=404, detail=message)


class ConflictError(HTTPException):
    def __init__(self, message: str = "이미 존재합니다"):
        super().__init__(status_code=409, detail=message)


class BadRequestError(HTTPException):
    def __init__(self, message: str = "잘못된 요청입니다"):
        super().__init__(status_code=400, detail=message)


class InsufficientPoolError(Exception):
    """단어 풀 부족 — 게임 시작 불가."""
    def __init__(self, difficulty: int):
        self.difficulty = difficulty
        super().__init__(f"단어 풀 부족: 난이도 {difficulty}")
