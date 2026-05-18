# ⚙️[기능추가][튜토리얼] 신규 플레이어 튜토리얼 미노출 문제 및 사용자 기준 tutorial_seen 관리

- 라벨: 작업전
- 담당자: Cassiiopeia

---

📝 현재 문제점
---

- 튜토리얼 노출 여부를 `localStorage`(`pickerpicker_tutorial_seen`)로 관리 중
- 브라우저 기준이므로 다음 케이스에서 잘못 동작함:
  - 신규 플레이어가 이미 튜토리얼을 본 브라우저에서 가입 → 튜토리얼 스킵됨 (버그 핵심)
  - 기존 플레이어가 다른 브라우저/기기에서 접속 → 튜토리얼 재노출
- 결과적으로 PIN 2회 입력 후 게임을 시작하는 신규 가입자에게 튜토리얼이 표시되지 않음

🛠️ 해결 방안 / 제안 기능
---

- `players` 테이블에 `tutorial_seen: boolean DEFAULT false` 컬럼 추가 (DB 마이그레이션 필요)
- 로그인/신규가입 완료 시 서버에서 `tutorial_seen` 값을 읽어 튜토리얼 노출 여부 결정
- 튜토리얼 완료 시 서버에 `tutorial_seen = true` 업데이트
- API 미연결 상태에서는 `localStorage` fallback으로 동작 유지

⚙️ 작업 내용
---

**백엔드:**
- `backend/src/models/player.py` — `tutorial_seen: Mapped[bool]` 컬럼 추가
- `backend/src/apis/player_router.py` — `GET /players/{nickname}` 응답에 `tutorial_seen` 포함
- `backend/src/apis/player_router.py` — `PATCH /players/{nickname}/tutorial-seen` 엔드포인트 추가
- DB 마이그레이션: `ALTER TABLE players ADD COLUMN tutorial_seen BOOLEAN DEFAULT FALSE`
  - 기존 플레이어 전원 `false`로 초기화됨 (튜토리얼 1회 재노출 발생)

**프론트엔드:**
- `src/App.tsx` — `handleLoginComplete` 시 서버 `tutorial_seen` 조회 후 `goToGameOrTutorial` 결정
- `src/App.tsx` — `handleTutorialComplete` 시 서버 PATCH 호출 후 localStorage도 동기화
- API 실패 시 localStorage fallback 유지

🙋‍♂️ 담당자
---

- 백엔드: SUH SAECHAN
- 프론트엔드: SUH SAECHAN
