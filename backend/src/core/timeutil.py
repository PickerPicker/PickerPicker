"""src.core.timeutil
시간 유틸 — DB의 timezone-naive DateTime 컬럼과 맞추기 위한 UTC 현재 시각.
"""
from datetime import datetime, UTC


def utcnow() -> datetime:
    """tz-naive UTC 현재 시각.

    datetime.utcnow()는 Python 3.12부터 deprecated이고 tz 정보가 없어 혼동을 부른다.
    DB 컬럼이 timezone-naive이므로 aware 값을 만든 뒤 tzinfo를 떼어 맞춘다.
    """
    return datetime.now(UTC).replace(tzinfo=None)
