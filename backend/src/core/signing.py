"""src.core.signing
HMAC 서명 대상 문자열 조립 + 검증. 순수 함수라 DB/앱 설정 없이 테스트할 수 있다.
"""
import hashlib
import hmac


def build_signature_message(
    timestamp: str, method: str, path: str, query: str, body: bytes
) -> str:
    """서명 대상 문자열 조립.

    timestamp만 서명하던 방식은 서명 1개를 캡처하면 유효기간(5분) 동안 모든 경로·본문에
    재사용할 수 있었다. 메서드/경로/쿼리/본문해시를 함께 묶어 요청 단위로 고정한다.

    path는 퍼센트 디코딩된 값을 쓴다 (ASGI scope["path"] 기준).
    FE(`src/services/authService.ts`의 `buildSignatureMessage`)와 조립 순서가
    반드시 일치해야 하며, 한쪽만 바꾸면 전 API가 401이 된다.
    """
    body_hash = hashlib.sha256(body).hexdigest()
    return "\n".join([timestamp, method.upper(), path, query, body_hash])


def sign(secret_key: str, message: str) -> str:
    """HMAC-SHA256 hex 서명 생성."""
    return hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()


def verify(secret_key: str, message: str, signature: str) -> bool:
    """서명 검증. constant-time 비교로 timing attack 방지."""
    return hmac.compare_digest(sign(secret_key, message), signature)
