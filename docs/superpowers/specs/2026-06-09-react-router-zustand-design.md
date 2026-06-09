# React Router + Zustand 전면 도입 설계

작성일: 2026-06-09

## 배경 / 목적

현재 PickerPicker는 react-router 없이 `App.tsx`의 `currentScreen` 상태로만 화면을 전환한다.
URL이 항상 `/` 하나라서 다음이 불가능하다:

- 화면 공유 (`/ranking` 링크 전달)
- 새로고침 시 현재 화면 유지 (항상 시작화면으로 복귀)
- 검색엔진의 화면별 색인 (SEO)
- Google AdSense 심사에 유리한 다중 페이지 구조 + 개인정보처리방침 독립 URL

목표: 주요 화면에 고유 URL을 부여하고, 전역 상태를 Zustand로 정리한다.

## 핵심 원칙 (A안)

> **URL은 "공유·북마크·새로고침하고 싶은 화면"에만 부여한다.
> 게임 내부 플로우(튜토리얼→게임 자동 진행, 비동기 로그인 분기, BGM 제어)는
> 기존 상태 로직을 그대로 유지한다.**

게임 플레이(`game`)는 진행 상태가 메모리에만 있으므로 URL을 주지 않는다(항상 `/`에서 상태로 렌더). 이로써 App.tsx 재작성 위험을 최소화하면서 목표(공유·SEO·애드센스)를 달성한다.

## 도입 라이브러리

| 라이브러리 | 버전 | 용도 |
|------------|------|------|
| react-router-dom | 7.17.0 | 클라이언트 라우팅 |
| zustand | 5.0.14 | 전역 상태 (nickname/offset/isStatsPublic) |
| @tanstack/react-query | 5.101.0 | **설치 + Provider 기반만**. 실제 페칭 교체는 별도 이슈 |
| react / react-dom | 19.2.6 → 19.2.7 | 패치 업데이트 |
| prettier + eslint-config-prettier | latest | 코드 포매팅 국룰 |

> zustand peer: react >=18 → React 19 호환 확인됨.
> 모든 패키지는 사내 npm mirror(`npm.mirror.lab.somansa.com`)로 설치 가능 확인됨.

## 라우트 구조

| URL | 화면 | 가드 |
|-----|------|------|
| `/` | HomePage (start + game을 상태로 렌더) | 없음 |
| `/ranking` | RankingScreen | 없음 (공개) |
| `/stats` | StatsScreen | 로그인 필요 → 없으면 `/`로 + 토스트 |
| `/tutorial` | TutorialScreen | 없음 |
| `/practice` | PracticeScreen | 게임 1회+ 필요 → 안 되면 `/`로 + 토스트 |
| `/privacy` | PrivacyScreen (신규) | 없음 (공개, 애드센스용) |
| `/admin`, `/admin/login` | AdminApp (기존 인증 유지) | 기존 토큰 |
| `*` | `<Navigate to="/" />` | 없는 경로 홈으로 |

## 컴포넌트 아키텍처

```
main.tsx
 └─ <BrowserRouter>
     └─ <QueryClientProvider>
         └─ <AudioProvider>
             └─ <AppRoutes>            (App.tsx — 라우트 정의만)
                 ├─ "/"         → <HomePage>
                 ├─ "/ranking"  → <RankingScreen>
                 ├─ "/stats"    → <RequireAuth><StatsScreen/></RequireAuth>
                 ├─ "/tutorial" → <TutorialScreen>
                 ├─ "/practice" → <RequirePlayed><PracticeScreen/></RequirePlayed>
                 ├─ "/privacy"  → <PrivacyScreen>
                 ├─ "/admin/*"  → <AdminApp>
                 └─ "*"         → <Navigate to="/">
         (Toast 컨테이너는 최상단에 1개)
```

### 단위별 책임

| 단위 | 책임 | 비고 |
|------|------|------|
| `HomePage` (신규) | start↔game 상태 전환, `afterTutorial`, `handleStart` 비동기 분기, 화면별 BGM 제어 | 기존 App.tsx 플로우 로직을 거의 그대로 이사. ranking/stats/tutorial/practice로 가던 `setCurrentScreen`은 `navigate`로 교체 |
| `playerStore` (신규, zustand) | `nickname`, `offset`, `isStatsPublic` + 핸들러(`setNickname`/`logout`/`setOffset`/`toggleStatsPublic`) | Provider 불필요. localStorage 동기화 포함 |
| `RequireAuth` (신규) | `nickname` 없으면 `/`로 리다이렉트 + 토스트 | 가드 |
| `RequirePlayed` (신규) | `LS_BEST_KEY` 없으면 `/`로 + 토스트 | 가드 |
| `Toast` (신규) | daisyUI `toast` + 표시 함수 (zustand store 또는 context) | 가드 안내·향후 재사용 |
| `PrivacyScreen` (신규) | 개인정보처리방침 본문 (수집 항목·쿠키·광고 식별자 안내) | 애드센스 필수 |
| `AdminApp` (신규) | 기존 `isAdminRoute`/`adminAuthed` 분기 로직 이사 | `/admin/*` |
| `queryClient` (신규) | QueryClient 인스턴스 + 기본 옵션 | 페칭 교체는 별도 이슈 |

## 상태 관리 (Zustand)

`usePlayerStore`:
- `nickname: string` — localStorage(`pickerpicker_nickname`) 동기화
- `offset: number` — localStorage(`pickerpicker_offset`) 동기화, [-100,100] clamp
- `isStatsPublic: boolean` — 기본 true, 서버값(`getPlayer.is_stats_public`)으로 초기화
- 액션: `setNickname`, `logout`, `setOffset`, `setStatsPublic`, `toggleStatsPublic`(낙관적 업데이트+롤백)

audio는 기존 `AudioContext` 유지(이미 분리됨).

## 가드 미충족 처리

홈(`/`)으로 리다이렉트하면서 daisyUI 토스트로 안내한다.
- `/stats` 비로그인: "로그인이 필요합니다"
- `/practice` 미플레이: "게임을 한 번 이상 플레이해야 이용할 수 있습니다"

## 코드 품질 도구

### Prettier (신규 `.prettierrc`)
```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```
현재 코드 스타일(세미콜론 없음·싱글쿼트)에 맞춤.

### ESLint
- `eslint-config-prettier` 추가 → 포매팅 규칙 충돌 제거
- `package.json`에 `format` 스크립트(`prettier --write .`) 추가

## 별도 이슈로 분리 (이번 작업 제외)

1. **React Query 실제 페칭 마이그레이션** — 서버 함수 호출 36곳, useEffect 페칭 화면 10여 곳을
   `useQuery`/`useInfiniteQuery`로 점진 교체. 라우터 안정화 후 진행.
2. **Google AdSense 신청** (#149) — 색인 완료 + 트래픽 발생 후.

## 검증

- `npx -p typescript tsc --noEmit` (타입)
- `npm run lint` / `npx prettier --check .`
- 라우트 직접 접속·새로고침 200 OK (`/ranking`, `/stats`→홈+토스트, `/privacy`)
  - 시놀로지 역방향 프록시 SPA fallback은 이미 설정 완료됨(사용자 확인). 배포 후 실제 검증.

## 리스크 / 완화

| 리스크 | 완화 |
|--------|------|
| App.tsx 재작성 회귀 버그 | A안으로 게임 플로우 로직은 이사만, 변경 최소화 |
| 화면 콜백(navigate 교체) 누락 | grep으로 `setCurrentScreen` 잔여 참조 전수 확인 |
| 내부망 빌드 불가 | 코드 작성 + dart format 대상 아님. tsc/lint/build는 사용자가 별도 환경에서 |
| SPA fallback 미동작 | 이미 설정됨. 배포 후 `/ranking` 새로고침으로 검증 |
