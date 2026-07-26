"""HMAC 서명 조립 규약 테스트.

여기 있는 기대값은 프론트엔드(`src/services/authService.ts`의 `buildSignatureMessage`)
구현으로 실제 생성한 서명이다. 이 테스트가 깨지면 FE/BE 서명이 어긋난 것이고,
배포되면 전 API가 401이 된다. 한쪽만 고치지 말 것.
"""
import pytest

from src.core.signing import build_signature_message, sign, verify

SECRET = "test-secret-키"


@pytest.mark.parametrize(
    "method,path,query,body,expected",
    [
        # 한글 닉네임 — path는 퍼센트 디코딩된 값으로 서명한다 (ASGI scope["path"] 기준)
        (
            "GET",
            "/players/홍길동/stats",
            "",
            b"",
            "17cb3857e23c02c4c7972772e20e74133ace54703ae83d5dd9c7ea5adb00cc46",
        ),
        # 쿼리스트링은 '?' 없이 서명에 포함
        (
            "GET",
            "/players/홍길동/sessions",
            "days=30",
            b"",
            "79d5de93368121b0a2f023fb776de4770f4b7928ed6e28099c82366ef76022a1",
        ),
        # 본문이 있는 POST
        (
            "POST",
            "/players/result",
            "",
            '{"nickname":"홍길동","score":1234}'.encode(),
            "c38e2a33ad7b4d3686518f2c2f56770507f6a490d0de4c9c072c86748593e265",
        ),
        (
            "PATCH",
            "/players/abc/stats-visibility",
            "",
            b'{"is_public":false}',
            "3ad36f2ebd0ba0dd96c3e5fcc0d849ab964c5985de8eb58bb1a4c23701a1e0cb",
        ),
    ],
)
def test_signature_matches_frontend(method, path, query, body, expected):
    """FE가 만든 서명과 BE 계산 결과가 같아야 한다."""
    message = build_signature_message("1700000000000", method, path, query, body)
    assert sign(SECRET, message) == expected


def test_signature_binds_to_path():
    """같은 timestamp라도 경로가 다르면 서명이 달라야 한다 (재사용 방지)."""
    a = build_signature_message("1700000000000", "GET", "/players/a/stats", "", b"")
    b = build_signature_message("1700000000000", "GET", "/players/b/stats", "", b"")
    assert sign(SECRET, a) != sign(SECRET, b)


def test_signature_binds_to_body():
    """본문이 바뀌면 서명이 달라야 한다 (점수 변조 방지)."""
    a = build_signature_message("1700000000000", "POST", "/players/result", "", b'{"score":100}')
    b = build_signature_message("1700000000000", "POST", "/players/result", "", b'{"score":999999}')
    assert sign(SECRET, a) != sign(SECRET, b)


def test_signature_binds_to_method():
    """메서드가 바뀌면 서명이 달라야 한다."""
    a = build_signature_message("1700000000000", "GET", "/players/a", "", b"")
    b = build_signature_message("1700000000000", "DELETE", "/players/a", "", b"")
    assert sign(SECRET, a) != sign(SECRET, b)


def test_method_is_case_insensitive():
    """메서드는 대문자로 정규화된다 (FE가 소문자로 보내도 통과)."""
    upper = build_signature_message("1700000000000", "POST", "/x", "", b"")
    lower = build_signature_message("1700000000000", "post", "/x", "", b"")
    assert upper == lower


def test_verify_rejects_wrong_signature():
    message = build_signature_message("1700000000000", "GET", "/players/a/stats", "", b"")
    assert verify(SECRET, message, sign(SECRET, message))
    assert not verify(SECRET, message, "deadbeef")
    assert not verify("다른키", message, sign(SECRET, message))
