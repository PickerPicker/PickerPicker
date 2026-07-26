"""src.core.rate_limit
인메모리 슬라이딩 윈도우 rate limiter.

PIN이 4자리 숫자(경우의 수 1만)라 시도 제한이 없으면 전수조사로 뚫린다.
백엔드가 단일 프로세스로 뜨므로 외부 저장소 없이 프로세스 메모리로 충분하다.
(다중 워커로 확장하면 Redis 등 공유 저장소로 옮겨야 한다.)
"""
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    """키별로 최근 window_seconds 안의 시도 횟수를 세어 max_attempts를 넘으면 차단."""

    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        cutoff = now - self.window_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()
        return hits

    def is_allowed(self, key: str) -> bool:
        """차단 여부만 확인 (시도 기록은 하지 않음)."""
        return len(self._prune(key, time.time())) < self.max_attempts

    def record_failure(self, key: str) -> None:
        """실패한 시도를 기록. 성공은 기록하지 않아 정상 사용자는 영향받지 않는다."""
        now = time.time()
        self._prune(key, now).append(now)

    def reset(self, key: str) -> None:
        """인증 성공 시 해당 키의 실패 이력을 지운다."""
        self._hits.pop(key, None)

    def retry_after(self, key: str) -> int:
        """차단 해제까지 남은 초. 차단 상태가 아니면 0."""
        now = time.time()
        hits = self._prune(key, now)
        if len(hits) < self.max_attempts:
            return 0
        return max(1, int(self.window_seconds - (now - hits[0])) + 1)

    def clear(self) -> None:
        """전체 초기화 (테스트용)."""
        self._hits.clear()


# PIN 인증용 — 닉네임 기준 5분에 10회, IP 기준 5분에 30회
# 닉네임 기준이 주 방어선이고, IP 기준은 여러 닉네임을 훑는 시도를 잡는다.
pin_attempts_by_nickname = SlidingWindowLimiter(max_attempts=10, window_seconds=300)
pin_attempts_by_ip = SlidingWindowLimiter(max_attempts=30, window_seconds=300)


def client_ip(request) -> str:
    """클라이언트 IP 추출. 리버스 프록시 뒤면 X-Forwarded-For의 첫 항목을 쓴다.

    이 헤더는 위조 가능하므로 IP 제한은 보조 수단이고, 닉네임 기준 제한이 주 방어선이다.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_pin_rate_limit(request, nickname: str) -> None:
    """PIN 인증 시도 전 호출. 차단 상태면 429."""
    from fastapi import HTTPException  # 순환 import 방지를 위해 지연 import

    ip = client_ip(request)
    for limiter, key in ((pin_attempts_by_nickname, nickname), (pin_attempts_by_ip, ip)):
        if not limiter.is_allowed(key):
            raise HTTPException(
                status_code=429,
                detail="PIN 입력 시도가 너무 많습니다. 잠시 후 다시 시도해주세요",
                headers={"Retry-After": str(limiter.retry_after(key))},
            )


def record_pin_failure(request, nickname: str) -> None:
    """PIN 인증 실패 시 호출."""
    pin_attempts_by_nickname.record_failure(nickname)
    pin_attempts_by_ip.record_failure(client_ip(request))


def reset_pin_attempts(request, nickname: str) -> None:
    """PIN 인증 성공 시 호출 — 정상 사용자의 실패 이력을 지운다."""
    pin_attempts_by_nickname.reset(nickname)
    pin_attempts_by_ip.reset(client_ip(request))
