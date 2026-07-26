🗒️ 설명
---

플레이어 PIN 인증에 취약점이 네 가지 있다. 4자리 숫자 PIN이라는 태생적 한계를 감안해도 현재 구현은 방어선이 거의 없다.

**1. salt 없는 SHA-256 해시**

`backend/src/services/player_service.py:26`

```python
def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()
```

경우의 수가 10,000개뿐인 4자리 숫자를 salt 없이 SHA-256으로 해싱하면, 해시 테이블 1만 개로 즉시 원문을 역산할 수 있다. DB가 한 번 유출되면 전 계정 PIN이 평문이나 다름없다. **같은 프로젝트의 admin 계정은 bcrypt를 쓰는데 player만 SHA-256으로 불일치**한다.

**2. rate limit 부재**

`POST /auth/login`, `POST /players/verify-pin` 어디에도 시도 횟수 제한이 없다. 자동화 스크립트로 1만 회를 순회하면 어떤 계정이든 뚫린다.

**3. 레거시 계정 선점 가능**

`backend/src/services/player_service.py:46-50`

```python
if player.pin_hash is None:
    # 레거시 플레이어 — PIN 미설정 상태, 입력한 PIN으로 자동 설정
    player.pin_hash = _hash_pin(pin)
    await db.commit()
    return True
```

`pin_hash`가 NULL이면 **입력한 PIN을 그대로 설정하고 로그인 성공 처리**한다. 여기에 `POST /players/result`가 미등록 닉네임으로 `pin_hash=None` 계정을 새로 만드는 경로(#이슈1)가 겹치면, 공격자가 임의 닉네임 계정을 양산한 뒤 아무 PIN이나 걸어 선점할 수 있다.

**4. SECRET_KEY fail-open**

`backend/src/core/config.py`

```python
SECRET_KEY: str = ""  # HMAC-SHA256 서명 검증용 시크릿 키 (비어있으면 검증 비활성화)
```

`main.py:110`의 HMAC 미들웨어는 `settings.SECRET_KEY`가 truthy일 때만 검증한다. 즉 **prod 배포에서 환경변수가 누락되면 모든 API 인증이 조용히 꺼진다.** 로그 한 줄 없이 무방비 상태가 되므로 알아차리기도 어렵다.

🔄 재현 방법
---

**PIN 브루트포스**

1. 대상 닉네임을 랭킹 화면에서 확인한다
2. `POST /auth/login` 에 `{"nickname": "대상", "pin": "0000"}` 부터 `"9999"` 까지 순차 요청한다
3. 차단·지연 없이 전부 처리되며 정답 PIN에서 200이 반환된다

**레거시 계정 선점**

1. `POST /players/result` 로 존재하지 않는 닉네임에 점수를 저장한다 → `pin_hash=None` 계정 생성
2. `POST /auth/login` 에 그 닉네임과 임의 PIN을 보낸다
3. PIN이 그대로 설정되며 로그인에 성공한다 → 계정 탈취 완료

**fail-open**

1. 백엔드 컨테이너에서 `SECRET_KEY` 환경변수를 제거하고 재기동한다
2. 서명 헤더 없이 아무 API나 호출한다
3. 401이 아니라 200이 반환된다 (기동 로그에 경고 없음)

📸 참고 자료
---

```python
# main.py:109-114 — SECRET_KEY가 비면 블록 전체를 건너뛴다
if (
    settings.SECRET_KEY          # ← 여기가 falsy면 검증 없이 통과
    and request.method != "OPTIONS"
    and request.url.path not in _PUBLIC_PATHS
    and not request.url.path.startswith("/docs")
):
```

✅ 예상 동작
---

- PIN 해시는 salt가 포함된 느린 해시(bcrypt)로 저장되어야 한다
- 동일 닉네임/IP에 대한 로그인 시도가 일정 횟수를 넘으면 차단되어야 한다
- `pin_hash`가 NULL인 계정에 아무나 PIN을 설정할 수 없어야 한다
- prod 환경에서 `SECRET_KEY`가 비어 있으면 **기동에 실패**해야 한다 (fail-closed)

🛠️ 해결 방안
---

1. **bcrypt 전환** — `_hash_pin`/`verify_pin`을 bcrypt 기반으로 교체한다. `pyproject.toml`에 bcrypt는 이미 포함되어 있고 admin 쪽에서 쓰는 방식을 그대로 따른다
2. **점진적 마이그레이션** — 기존 SHA-256 해시(길이 64 hex)는 로그인 성공 시점에 bcrypt로 재해싱해 갈아끼운다. 일괄 마이그레이션은 원문을 모르므로 불가능하다
3. **rate limit** — 닉네임+IP 조합 기준으로 로그인/PIN 검증에 시도 제한을 건다 (예: 5분 내 10회 초과 시 429). 단일 인스턴스이므로 인메모리 슬라이딩 윈도우로 충분하다
4. **레거시 경로 제거** — `pin_hash is None`이면 자동 설정 대신 인증 실패로 처리한다. 기존 레거시 계정은 admin PIN 초기화(#81) 경로로 안내한다
5. **fail-closed** — `ENVIRONMENT == "prod"` 이고 `SECRET_KEY`가 비면 `lifespan`에서 예외를 던져 기동을 중단한다

⚙️ 환경 정보
---

- **버전**: v0.0.133
- **백엔드**: FastAPI (Python 3.13), PostgreSQL (시놀로지 NAS, 포트 5430)
- **관련 이슈**: #72 (API 인증 강화), #81 (Admin PIN 초기화), #88 (HMAC 도입)
- **선행 이슈**: 미등록 닉네임 계정 생성 차단은 인증 흐름 복원 이슈와 함께 처리한다

🙋‍♂️ 담당자
---

- **백엔드**: Cassiiopeia
