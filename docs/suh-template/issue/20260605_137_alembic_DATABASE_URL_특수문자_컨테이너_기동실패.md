🗒️ 설명
---

백엔드 컨테이너(`pickerpicker-back`) 기동 시 `alembic upgrade` 단계에서 `ValueError`가 발생하여 서버가 즉시 죽고 배포가 실패한다.

`DATABASE_URL`의 비밀번호에 `@` 같은 특수문자가 포함되면 URL 인코딩되어 `%40` 형태가 되는데, alembic이 내부적으로 사용하는 Python `configparser`가 `%`를 interpolation 문법(`%(key)s`)으로 오인하면서 파싱에 실패한다.

문제 위치: `backend/alembic/env.py:21` — `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`

🔄 재현 방법
---

1. `DATABASE_URL`의 비밀번호에 `@` 등 URL 인코딩 대상 특수문자가 포함된 환경에서 백엔드 컨테이너 기동
2. 컨테이너 시작 시 `alembic upgrade` 자동 실행
3. `alembic/env.py`에서 `set_main_option` 호출 → `configparser`가 `%`를 interpolation으로 해석 → `ValueError` 발생, 컨테이너 종료

📸 참고 자료
---

```
ValueError: invalid interpolation syntax in
'postgresql+asyncpg://kimchi:********@suh-project.synology.me:5430/pickerpicker'
at position 37
  File "/app/alembic/env.py", line 21, in <module>
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
  File ".../configparser.py", line 422, in before_set
    raise ValueError("invalid interpolation syntax ...")
```

`position 37`은 인코딩된 비밀번호의 `%` 위치와 정확히 일치한다.

✅ 예상 동작
---

- 비밀번호에 특수문자(`@` 등)가 포함되어도 alembic 마이그레이션이 정상 실행되어야 한다.
- 컨테이너가 죽지 않고 정상 기동하여 배포가 완료되어야 한다.

🛠️ 해결 방안
---

`backend/alembic/env.py`에서 `set_main_option` 호출 시 URL의 `%`를 `%%`로 이스케이프한다. configparser가 `%%`를 리터럴 `%`로 복원하므로 SQLAlchemy 엔진이 받는 URL은 원본과 동일하게 유지된다.

```python
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))
```

⚙️ 환경 정보
---

- **OS**: 시놀로지 NAS Docker (Linux)
- **컨테이너**: `pickerpicker-back` (Python 3.13)
- **기타**: alembic + configparser BasicInterpolation

🙋‍♂️ 담당자
---

- **백엔드**: Cassiiopeia
