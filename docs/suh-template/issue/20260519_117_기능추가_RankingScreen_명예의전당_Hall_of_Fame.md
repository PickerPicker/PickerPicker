# ⚙️[기능추가][RankingScreen] 명예의 전당(Hall of Fame) 기능 추가

- 라벨: 작업전
- 담당자: Cassiiopeia

---

📝 현재 문제점
---

- 랭킹 화면은 단순 점수 기반 테이블만 존재하며, 역대 1위 플레이어를 특별하게 기념하는 공간이 없다.
- 1위 달성 시 특별한 피드백이 없어 성취감이 부족하다.

🛠️ 해결 방안 / 제안 기능
---

- 랭킹 화면에 **HALL OF FAME** 탭을 추가하여, 현재 1위와 역대 1위 기록을 표시한다.
- 현재 챔피언은 **CSS 픽셀아트 동상** (부유 애니메이션 + 반짝이 파티클, 보라/핑크/황금 계열)으로 시각적으로 강조한다.
- 1위 달성 플레이어의 재위 기간(N일째), 최고 점수·스테이지·콤보·플레이 횟수를 표시한다.
- 1위 경험자만 **한마디(motto)** 를 등록·수정할 수 있다.
- 1위 달성 시 게임 결과 화면에서 "명예의 전당 등록" 알림 모달이 표시되며 한마디를 즉시 입력할 수 있다.
- 역대 1위 목록(닉네임·재위일수·한마디)을 하단에 표시한다.

⚙️ 작업 내용
---

- `hall_of_fame` 테이블 신규 생성 (nickname, score, started_at, ended_at, motto)
- `players` 테이블에 `is_hall_of_famer`, `motto` 컬럼 추가
- `save_game_result` 로직에 1위 교체 감지 및 hall_of_fame 갱신 트리거 추가
- `is_new_champion` 필드를 게임 결과 응답에 추가
- `GET /hall-of-fame` API 신규 구현
- `PATCH /hall-of-fame/motto` API 신규 구현 (인증 필수, is_hall_of_famer 검증)
- `RankingScreen`에 RANKING / HALL OF FAME 탭 전환 추가
- `HallOfFameScreen` 컴포넌트 신규 구현 (픽셀아트 동상 포함)
- `GameScreen` 결과 화면에 1위 달성 알림 모달 추가
- `playerService.ts`에 `getHallOfFame`, `updateMotto` 함수 추가
- DB 초기 마이그레이션 (현재 1위 기준 hall_of_fame 초기 레코드 삽입)

🙋‍♂️ 담당자
---

- 백엔드: Cassiiopeia
- 프론트엔드: Cassiiopeia
