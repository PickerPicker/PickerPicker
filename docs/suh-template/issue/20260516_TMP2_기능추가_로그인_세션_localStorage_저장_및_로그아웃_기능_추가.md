---
title: "⚙️[기능추가][Auth] 로그인 세션 localStorage 저장 및 로그아웃 기능 추가"
label: 작업전
assignee: Cassiiopeia
---

# ⚙️[기능추가][Auth] 로그인 세션 localStorage 저장 및 로그아웃 기능 추가

📝 현재 문제점
---

- 앱을 새로고침하거나 재접속할 때마다 닉네임과 PIN을 매번 입력해야 한다.
- 로그인 상태가 메모리에만 유지되어 페이지 이탈 시 초기화된다.
- 다른 사용자로 전환할 수 있는 로그아웃 수단이 없다.

🛠️ 해결 방안 / 제안 기능
---

- 로그인 성공(기존 플레이어 PIN 검증 / 신규 플레이어 등록) 시 닉네임을 `localStorage`에 저장한다.
- 앱 시작 시 `localStorage`에 닉네임이 존재하면 자동으로 로그인 상태로 복원한다.
- 로그인 상태에서 StartScreen에 `안녕하세요, {닉네임}님!` 문구와 `플레이하기` 버튼을 표시한다.
- 로그아웃 버튼을 추가하여 `localStorage`에서 닉네임을 삭제하고 로그인 화면으로 돌아갈 수 있도록 한다.
- PIN은 보안상 절대 저장하지 않는다.

⚙️ 작업 내용
---

- `App.tsx`: `LS_NICKNAME_KEY` 상수 추가, nickname 초기값을 localStorage에서 복원, 로그인 성공 시 저장, `handleLogout` 추가, `handleStart`에서 로그인 상태면 바로 게임 진입
- `StartScreen.tsx`: `nickname`, `onLogout` prop 추가, 로그인 상태 조건부 UI 렌더링

🙋‍♂️ 담당자
---

- 프론트엔드: 서새찬
