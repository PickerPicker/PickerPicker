"""src.core.pin
PIN 해싱/검증 순수 로직. DB 없이 테스트할 수 있도록 서비스 레이어에서 분리했다.
"""
import hashlib
import hmac

import bcrypt


def hash_pin(pin: str) -> str:
    """PIN을 bcrypt 해시로 변환.

    PIN이 4자리 숫자라 경우의 수가 1만개뿐이다. salt 없는 SHA-256으로는
    해시 테이블 1만개로 즉시 역산되므로 salt가 포함된 느린 해시를 쓴다.
    """
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def is_legacy_sha256(pin_hash: str) -> bool:
    """레거시 SHA-256 해시 여부. bcrypt 해시는 '$2'로 시작하고, SHA-256 hex는 64자다."""
    return len(pin_hash) == 64 and not pin_hash.startswith("$2")


def verify_legacy_sha256(pin: str, pin_hash: str) -> bool:
    """레거시 SHA-256 해시 검증 (constant-time 비교)."""
    return hmac.compare_digest(hashlib.sha256(pin.encode()).hexdigest(), pin_hash)


def verify_pin(pin: str, pin_hash: str) -> bool:
    """저장된 해시 형식(bcrypt/레거시 SHA-256)에 맞춰 검증."""
    if is_legacy_sha256(pin_hash):
        return verify_legacy_sha256(pin, pin_hash)
    return bcrypt.checkpw(pin.encode(), pin_hash.encode())
