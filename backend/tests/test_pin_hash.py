"""PIN 해시 — bcrypt 전환 및 레거시 SHA-256 판별 테스트 (DB 불필요)."""
import hashlib

from src.core.pin import hash_pin, is_legacy_sha256, verify_legacy_sha256, verify_pin


def test_hash_is_bcrypt():
    h = hash_pin("1234")
    assert h.startswith("$2"), "bcrypt 해시가 아님"
    assert verify_pin("1234", h)


def test_hash_is_salted():
    """같은 PIN이라도 매번 다른 해시가 나와야 한다 (레인보우 테이블 방어)."""
    assert hash_pin("1234") != hash_pin("1234")


def test_wrong_pin_rejected():
    assert not verify_pin("1235", hash_pin("1234"))


def test_legacy_sha256_detected():
    """레거시 SHA-256 해시를 정확히 판별해야 재해싱 경로를 탄다."""
    assert is_legacy_sha256(hashlib.sha256(b"1234").hexdigest())


def test_bcrypt_not_treated_as_legacy():
    assert not is_legacy_sha256(hash_pin("1234"))


def test_legacy_hash_still_verifies():
    """마이그레이션 전 기존 사용자가 로그인할 수 있어야 한다."""
    legacy = hashlib.sha256(b"1234").hexdigest()
    assert verify_legacy_sha256("1234", legacy)
    assert not verify_legacy_sha256("9999", legacy)
    # verify_pin이 형식을 자동 판별하는지
    assert verify_pin("1234", legacy)
    assert not verify_pin("9999", legacy)


def test_hash_fits_column():
    """pin_hash 컬럼(VARCHAR 255)에 들어가야 한다."""
    assert len(hash_pin("1234")) <= 255


def test_all_four_digit_pins_hash_distinctly():
    """PIN마다 해시가 달라야 한다 (샘플 검증)."""
    samples = ["0000", "1234", "9999"]
    hashes = [hash_pin(p) for p in samples]
    for pin, h in zip(samples, hashes):
        assert verify_pin(pin, h)
        for other in samples:
            if other != pin:
                assert not verify_pin(other, h)
