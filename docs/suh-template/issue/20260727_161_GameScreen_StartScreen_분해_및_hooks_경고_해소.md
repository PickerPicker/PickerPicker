🗒️ 설명
---

#159에서 구조 정리를 진행하며, **게임 로직에 손을 대야 하는 항목은 의도적으로 분리**했다.
동작이 바뀌면 게임 판정·타이밍이 깨지므로 별도로 신중히 다루기 위함이다.

#159에서 완료한 것:

- Bearer 파싱 4벌 → `core/security` 하나로 통합
- `datetime.utcnow()` → `core/timeutil.utcnow()` 일괄 교체
- `save_game_result` 반환을 `SaveResultOutcome` 데이터클래스로 변경
- react-query 실도입 (통계 / 명예의전당 / 공개통계 / 어드민 단어목록)
- `playerStore`에서 네트워크 호출 분리
- `HomePage` 렌더 중 `window.innerWidth` 참조 정리
- 어드민 단어목록 ESLint 오류 해소

이 이슈에서 다룰 남은 항목은 아래 둘이다.

### 1. 대형 컴포넌트 분해

| 파일 | 줄 수 | 담당 |
|---|---|---|
| `src/features/game/GameScreen.tsx` | 842 | 게임 루프 + 판정 + 결과 저장 + 게임오버 UI + 랭킹 조회 + 모토 수정 |
| `src/features/player/StartScreen.tsx` | 728 | 닉네임 입력 + PIN 로그인/생성/확인 + 설정 + 홈 UI |

한 파일이 너무 많은 책임을 갖고 있어 변경 시 영향 범위를 가늠하기 어렵다.

### 2. react-hooks 경고 8건

`npm run lint` 기준 (오류 0, 경고 8):

| 파일 | 위치 | 내용 |
|---|---|---|
| `features/game/GameScreen.tsx` | 259 | missing dep `onGameBgm` |
| `features/game/JudgmentDisplay.tsx` | 24 | missing dep `judgment` |
| `features/game/NoteTrack.tsx` | 67 | missing dep `lastJudgment` |
| `features/game/PlayStage.tsx` | 277 | missing dep `validSyllables` |
| `features/practice/PracticePlayStage.tsx` | 211 | missing dep `validSyllables` |
| `features/practice/PracticeScreen.tsx` | 219 | missing deps `backToMenu`, `exitToHome` |
| `features/tutorial/TutorialStage.tsx` | 117 | unnecessary dep `step.missMode` |
| `features/tutorial/TutorialStage.tsx` | 237 | missing dep `step.gaugeLoss` |

전부 게임/튜토리얼 타이밍·판정 경로다. 의존성을 무심코 추가하면 effect가 매 프레임 재실행되어
노트 타이밍이 어긋나거나 판정이 중복될 수 있다.

또한 `eslint-disable` 주석이 20곳 남아 있다.

🔄 재현 방법
---

```bash
npm run lint          # 경고 8건
grep -rn "eslint-disable" src | wc -l   # 20
wc -l src/features/game/GameScreen.tsx  # 842
```

✅ 예상 동작
---

- 각 파일이 하나의 책임을 갖고, 내부를 읽지 않아도 무엇을 하는지 알 수 있어야 한다
- 린트 경고가 0이거나, 남은 것은 **왜 의도적인지 사유가 주석에 적혀** 있어야 한다
- **게임 판정·타이밍 동작은 이전과 완전히 동일해야 한다**

🛠️ 해결 방안
---

### 컴포넌트 분해

- `GameScreen`
  - 게임 루프/판정 상태를 `useGameSession` 훅으로 추출
  - 게임오버 화면을 `GameOverScreen` 컴포넌트로 분리 (순수 프레젠테이션이라 가장 안전)
  - 랭킹 조회·모토 수정은 이미 react-query가 들어왔으므로 해당 훅으로 위임
- `StartScreen`
  - PIN 플로우(`pin-login` / `pin-create` / `pin-confirm`)를 `usePinFlow` 훅 + 별도 컴포넌트로 분리
  - 설정 패널은 이미 `SettingsModal`이 있으므로 중복 정리

### 린트 경고

한 건씩 아래 순서로 처리한다.

1. effect가 **왜** 그 의존성을 제외했는지 파악한다 (마운트 1회 실행 / ref로 최신값 참조 / 의도적 스냅샷)
2. 안전하게 고칠 수 있으면 고친다 — 핸들러를 `useCallback`으로 감싸거나, 최신값을 `useRef`로 읽는다
3. 구조상 불가피하면 `eslint-disable-next-line`을 유지하되 **사유를 한 줄로 명시**한다

### 검증 (필수)

- `npm run build`(tsc 포함) + `npm run lint` + 백엔드 `pytest`
- **수동 플레이 검증**: 15스테이지 완주, PERFECT/GOOD/MISS 판정이 이전과 동일한지,
  게이지 감소량·콤보 누적·FEVER 진입이 그대로인지 확인
- 연습 모드와 튜토리얼 5단계도 동일하게 확인

> 판정 로직에 확신이 서지 않으면 그 부분은 건드리지 말고 사유 주석만 남긴다.
> 리팩터링으로 게임 감각이 바뀌는 것이 파일이 큰 것보다 훨씬 나쁘다.

⚙️ 환경 정보
---

- **버전**: v0.0.134 기준
- **프론트엔드**: React 19 + Vite + TypeScript + react-router-dom 7 + Zustand + react-query
- **관련 이슈**: #159 (구조 정리 1차), #151 (react-router 도입 시 eslint-disable 발생)

🙋‍♂️ 담당자
---

- **프론트엔드**: Cassiiopeia
