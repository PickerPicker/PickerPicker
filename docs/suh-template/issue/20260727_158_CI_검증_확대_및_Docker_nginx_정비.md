🗒️ 설명
---

CI가 빌드 성공 여부만 확인하고 있어 테스트·린트가 전부 통과 없이 main에 들어간다. 여기에 Docker/nginx 설정 문제가 겹쳐 있다.

**1. CI 검증 공백**

| 검증 | 상태 |
|---|---|
| `npm run build` (tsc 포함) | 실행됨 |
| ESLint (`npm run lint`) | **미실행** |
| prettier (`npm run format:check`) | **미실행** |
| 백엔드 pytest | **미실행** |

`backend/tests/`에 테스트 파일이 7개(`test_admin_auth`, `test_word_crud`, `test_word_pick`, `test_word_stats`, `test_seed`, `test_result_with_stage_results`, `conftest`) 있는데 **CI에서 한 번도 실행되지 않는다.** `PROJECT-PYTHON-CI.yaml`은 Docker 빌드만 검증한다.

`package.json`에 `lint`와 `format:check` 스크립트가 정의되어 있는데도 `PROJECT-REACT-CI.yaml`은 호출하지 않는다. #151에서 prettier를 도입했지만 포맷 위반을 잡아줄 게이트가 없다.

**2. 프로젝트 규칙 위반 — heredoc + secrets**

`.github/workflows/PROJECT-PYTHON-CI.yaml:55-59`

```yaml
run: |
  cat > backend/.env << 'EOF'
  ${{ secrets.BACKEND_ENV_FILE }}
  EOF
```

`CLAUDE.md`의 "GitHub Actions YAML 규칙"이 **명시적으로 금지한 패턴**이다. secrets는 `env:` 섹션으로 받아 `$BACKEND_ENV_FILE`로 참조해야 한다.

**3. Vite 프로젝트에 Next.js 잔재**

`PROJECT-REACT-CI.yaml`에 `.next/cache` 캐싱 스텝이 남아 있다. 이 프로젝트는 Vite라 해당 경로가 생기지 않으므로 매 실행마다 무의미한 캐시 조회가 발생한다.

**4. `.dockerignore` 부재 + `npm install`**

루트 `Dockerfile`이 `COPY . .`를 쓰는데 `.dockerignore`가 없다. 빌드 컨텍스트로 `node_modules` 178MB + `dist` 34MB + `.git` 46MB가 통째로 전송된다.

또한 `RUN npm install`을 쓰고 있어 `package-lock.json`이 무시된다. 잠긴 버전과 다른 의존성이 설치될 수 있어 재현성이 없다. #151에서 실제로 package-lock 관련 CI 사고(`7a2e7ce`)가 있었다.

**5. nginx 설정 미비**

`nginx.conf`에 보안 헤더가 하나도 없고 캐시 정책도 없다. 특히 `index.html`에 `no-cache`가 지정되지 않아, **배포 후 브라우저가 캐시된 옛 index.html을 들고 새 해시 asset을 요청하면 404 → 흰 화면**이 발생할 수 있다.

🔄 재현 방법
---

**CI 공백**

1. ESLint 규칙을 위반하거나 prettier 포맷에 어긋나는 코드를 커밋해 main에 푸시한다
2. CI가 초록불로 통과한다
3. 백엔드 테스트를 깨뜨리는 변경도 동일하게 통과한다

**nginx 캐시**

1. 사이트를 방문해 `index.html`을 캐시시킨다
2. 새 버전을 배포한다 (asset 파일 해시 변경)
3. 하드 리프레시 없이 재방문하면 캐시된 index.html이 사라진 asset을 요청해 흰 화면이 뜬다

📸 참고 자료
---

`package.json`에 스크립트는 이미 준비되어 있다.

```json
"lint": "eslint .",
"format:check": "prettier --check ."
```

`Dockerfile` (루트)

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install          # ← npm ci 여야 함
COPY . .                 # ← .dockerignore 없음
RUN npm run build
```

✅ 예상 동작
---

- 린트 위반·포맷 위반·테스트 실패가 있으면 CI가 빨간불이어야 한다
- workflow YAML이 프로젝트 규칙(`env:` 경유 secrets 주입)을 따라야 한다
- Docker 빌드 컨텍스트에 불필요한 디렉터리가 포함되지 않아야 한다
- 의존성 설치가 `package-lock.json` 기준으로 재현 가능해야 한다
- 배포 직후 하드 리프레시 없이도 새 버전이 정상 로드되어야 한다

🛠️ 해결 방안
---

1. **PYTHON-CI에 pytest 스텝 추가** — Docker 빌드 검증 앞이나 뒤에 `uv pip install` + `pytest` 실행 단계를 넣는다. `conftest.py`가 요구하는 DB 설정을 확인해 필요하면 SQLite/테스트 컨테이너로 분리한다
2. **REACT-CI에 lint + format:check 추가** — 빌드 앞 단계에 넣어 빠르게 실패하도록 한다
3. **heredoc secrets 제거** — `env: BACKEND_ENV_FILE: ${{ secrets.BACKEND_ENV_FILE }}` 로 받고 `printf '%s' "$BACKEND_ENV_FILE" > backend/.env` 형태로 교체한다. 기존 배포 로직(`PROJECT-PYTHON-CICD.yaml`) 구조는 건드리지 않는다
4. **`.next/cache` 스텝 제거**
5. **루트 `.dockerignore` 추가** — `node_modules`, `dist`, `.git`, `docs`, `backend`, `*.md` 등 제외
6. **`npm install` → `npm ci`**
7. **nginx 보강**
   - 보안 헤더: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`
   - `/assets/` 해시 파일: `Cache-Control: public, max-age=31536000, immutable`
   - `index.html`: `Cache-Control: no-cache`
   - `gzip_types`에 `image/svg+xml` 추가

⚙️ 환경 정보
---

- **버전**: v0.0.133
- **CI/CD**: GitHub Actions → DockerHub → 시놀로지 NAS Docker
- **프론트 배포 포트**: 3010 / **백엔드 배포 포트**: 8001
- **관련 이슈**: #90 (env 파일 자동 업로드), #151 (prettier 도입, package-lock CI 사고)

🙋‍♂️ 담당자
---

- **인프라**: Cassiiopeia
