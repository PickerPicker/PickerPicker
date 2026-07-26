"""PIN 브루트포스 방어 — 슬라이딩 윈도우 rate limiter 테스트."""
import time

from src.core.rate_limit import SlidingWindowLimiter


def test_allows_until_limit():
    limiter = SlidingWindowLimiter(max_attempts=3, window_seconds=60)
    for _ in range(3):
        assert limiter.is_allowed("user")
        limiter.record_failure("user")
    assert not limiter.is_allowed("user")


def test_success_resets_attempts():
    """정상 사용자가 몇 번 틀렸다가 맞히면 이력이 지워져야 한다."""
    limiter = SlidingWindowLimiter(max_attempts=3, window_seconds=60)
    limiter.record_failure("user")
    limiter.record_failure("user")
    limiter.reset("user")
    for _ in range(3):
        assert limiter.is_allowed("user")
        limiter.record_failure("user")
    assert not limiter.is_allowed("user")


def test_window_expires():
    """윈도우가 지나면 다시 허용된다."""
    limiter = SlidingWindowLimiter(max_attempts=2, window_seconds=1)
    limiter.record_failure("user")
    limiter.record_failure("user")
    assert not limiter.is_allowed("user")
    time.sleep(1.1)
    assert limiter.is_allowed("user")


def test_keys_are_isolated():
    """한 닉네임이 차단돼도 다른 닉네임은 영향받지 않는다."""
    limiter = SlidingWindowLimiter(max_attempts=1, window_seconds=60)
    limiter.record_failure("a")
    assert not limiter.is_allowed("a")
    assert limiter.is_allowed("b")


def test_retry_after():
    limiter = SlidingWindowLimiter(max_attempts=1, window_seconds=60)
    assert limiter.retry_after("user") == 0
    limiter.record_failure("user")
    assert 0 < limiter.retry_after("user") <= 61


def test_brute_force_is_blocked():
    """4자리 PIN 전수조사(1만회)가 제한 안에서 막히는지."""
    limiter = SlidingWindowLimiter(max_attempts=10, window_seconds=300)
    blocked_at = None
    for attempt in range(10_000):
        if not limiter.is_allowed("victim"):
            blocked_at = attempt
            break
        limiter.record_failure("victim")
    assert blocked_at == 10, f"10회에서 막혀야 하는데 {blocked_at}회에서 막힘"
