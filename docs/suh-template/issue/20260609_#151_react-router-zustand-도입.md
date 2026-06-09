📝 현재 문제점
---

- react-router 없이 `App.tsx`의 `currentScreen` 상태로만 화면을 전환하여 URL이 항상 `/` 하나다.
- 그 결과 화면 공유(`/ranking` 링크), 새로고침 시 화면 유지, 검색엔진 화면별 색인(SEO), 애드센스 다중 페이지 구조가 모두 불가능하다.
- 전역 상태(nickname/offset/isStatsPublic)가 App.tsx에 몰려 props drilling이 발생한다.
- Prettier 미설정, ESLint는 Vite 기본 수준이라 코드 스타일 일관성 보장이 약하다.

🛠️ 해결 방안 / 제안 기능
---

- react-router-dom을 전면 도입하되 "공유·새로고침할 화면만 URL 부여"(A안) 원칙 적용.
- 게임 플레이(game)는 진행 상태가 메모리에만 있으므로 URL 미부여, 기존 상태 로직 유지(재작성 위험 최소화).
- 전역 상태는 Zustand(`usePlayerStore`)로 정리.
- 개인정보처리방침 페이지(`/privacy`)를 이 라우팅 체계에 포함(애드센스 필수).
- React Query는 설치 + Provider 기반만 마련(실제 페칭 교체는 별도 이슈).
- React 패치 업데이트(19.2.6 → 19.2.7) + Prettier 국룰 설정.

⚙️ 작업 내용
---

- 라이브러리 도입: react-router-dom, zustand, @tanstack/react-query(기반만), prettier, eslint-config-prettier
- 라우트 구조
  - `/` HomePage(start+game 상태 렌더), `/ranking`, `/stats`(로그인 가드), `/tutorial`, `/practice`(플레이 가드), `/privacy`(신규), `/admin/*`(기존 유지), `*`→홈
- 신규: `pages/HomePage.tsx`, `store/playerStore.ts`, `lib/queryClient.ts`, `components/common/{RequireAuth,RequirePlayed,Toast}.tsx`, `pages/PrivacyScreen.tsx`, `components/admin/AdminApp.tsx`, `.prettierrc`
- 수정: `main.tsx`(Provider 래핑), `App.tsx`(라우트 정의로 축소), 각 화면 콜백 `setCurrentScreen`→`navigate` 교체, `package.json`, `eslint.config.js`
- 가드 미충족 시 홈 리다이렉트 + daisyUI 토스트 안내
- 검증: `tsc --noEmit`, `npm run lint`, `prettier --check`, 라우트 직접 접속/새로고침 200 OK

> 설계 문서: `docs/superpowers/specs/2026-06-09-react-router-zustand-design.md`
> 별도 이슈로 분리: React Query 실제 페칭 마이그레이션(36곳), 애드센스 신청(#149).
> 연관: SEO 기반 작업(#147), 색인 등록(#148), 애드센스(#149).

🙋‍♂️ 담당자
---

- 프론트엔드: Cassiiopeia
