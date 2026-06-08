# 랭킹 프로필 공개 통계 + 통계 비공개 설정

작성일: 2026-06-08

## 목표

1. **공개 프로필 보기** — 랭킹에서 사람을 클릭하면 그 사람의 **요약 통계**를 모달로 본다.
2. **통계 비공개 설정** — 설정 모달에 "통계 공개" 토글을 두어, 끄면 남이 내 통계를 볼 수 없다.

## 핵심 원칙

- 비공개 판단은 **서버에서** 한다.
- 남에게 보여주는 통계는 **요약만** — 시간대별 습관/세션 간격/단어별 약점 등 민감정보는 절대 노출하지 않는다.
- 기존 본인용 `/players/{nickname}/stats`(전체 통계)는 그대로 둔다. 남에게 줄 데이터는 **신규 요약 전용 엔드포인트**로 분리한다.

## 데이터 흐름

```
랭킹 행 클릭
  → GET /players/{nickname}/public-stats   (HMAC 서명)
  → is_public=false 면 { "is_public": false } 반환
  → 모달: 공개면 요약 카드, 비공개면 "이 사용자는 통계를 비공개했습니다"

설정 토글 변경
  → PATCH /players/me/stats-visibility  (Bearer 토큰 필수)
  → 낙관적 업데이트, 실패 시 롤백
```

## 백엔드 변경

### DB 스키마

`players` 테이블에 컬럼 추가:

```python
is_stats_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

기본값 `TRUE`(기존 유저 전원 공개 시작). `create_all`은 컬럼 추가를 안 하므로 **수동 ALTER 필요**(배포 후 시놀로지 컨테이너에서 1회):

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_stats_public BOOLEAN NOT NULL DEFAULT TRUE;
```

### 신규 엔드포인트 `GET /players/{nickname}/public-stats`

HMAC 서명으로 보호(Bearer 불필요 — 남의 요약은 공개 정보). 단 **민감필드는 응답에 아예 포함하지 않는다.**

- 비공개: `{ "nickname": ..., "is_public": false }`
- 공개:
  ```json
  {
    "is_public": true,
    "nickname": "...",
    "motto": "... | null",
    "totals": { "play_count", "best_score", "best_stage", "best_combo" },
    "averages": { "avg_score" },
    "percentile": { "rank_top_pct" }
  }
  ```
- `habit` / `words` / `session_gap` / `stage_best` 는 **절대 포함 금지**.

### 비공개 토글 엔드포인트 `PATCH /players/me/stats-visibility`

- Bearer 토큰 필수 (본인만 변경) — `updateMotto`와 동일 패턴.
- body: `{ "is_public": bool }`

### `GET /players/{nickname}` 응답 확장

`PlayerRecord` 응답에 `is_stats_public` 필드 추가 — 로그인/플레이어 조회 시점에 토글 초기값을 별도 조회 없이 받기 위함.

## 프론트엔드 변경

### 신규 컴포넌트 `PublicStatsModal.tsx`

- props: `{ nickname: string; myNickname?: string; onClose: () => void }`
- 마운트 시 `getPublicStats(nickname)` 호출 → 상태:
  - `loading`: 스피너
  - `public`: 요약 카드(최고점/최고스테이지/최고콤보/플레이횟수/평균점수/상위%, motto 있으면 상단 인용구)
  - `private`: 자물쇠 아이콘 + "이 사용자는 통계를 비공개했습니다"
- **본인 예외**: `nickname === myNickname`이면 비공개여도 요약을 보여주고 "내 통계 (비공개 중)" 문구 표기.
- 디자인은 기존 랭킹의 보라/네온 톤(`#e879f9`, `rgba(0,0,20,...)`) 일관 유지.
- 모달 바깥 클릭 / ✕ 로 닫기(SettingsModal 패턴 재사용).

### `RankingScreen.tsx` 수정

- 각 랭킹 `<tr>`에 `onClick` + `cursor: pointer`. sticky 내 행도 클릭 가능.
- 하단에 `{selectedNickname && <PublicStatsModal ... />}`.
- 본인 행 클릭도 동일 모달로 통일(별도 분기 없음).

### `statsService.ts` 함수/타입 추가

```ts
export interface PublicStatsResponse {
  is_public: boolean
  nickname: string
  motto?: string | null
  totals?: { play_count: number; best_score: number; best_stage: number; best_combo: number }
  averages?: { avg_score: number }
  percentile?: { rank_top_pct: number }
}
export async function getPublicStats(nickname: string): Promise<PublicStatsResponse | null>
export async function setStatsVisibility(isPublic: boolean): Promise<boolean>  // PATCH, Bearer
```

### `SettingsModal.tsx` 토글 추가

props 추가:

```ts
nickname?: string                    // 없으면 비로그인 → 토글 미표시
isStatsPublic?: boolean
onToggleStatsPublic?: () => void
```

- "효과음" 토글 아래에 같은 `toggle toggle-primary` 스타일 "통계 공개" 토글(체크=공개).
- 설명: "끄면 다른 사람이 내 통계를 볼 수 없어요".
- **비로그인 시 토글 자체 미표시.**

### 상태 관리

- 부모(App/설정 호출 화면)가 `isStatsPublic` 보유.
- `GET /players/{nickname}` 응답의 `is_stats_public`로 초기화.
- 토글 → 낙관적 업데이트(즉시 UI 반영) → `setStatsVisibility()` 실패 시 롤백 + 알림.
- `PlayerRecord` 타입에 `is_stats_public?: boolean` 추가.

## 엣지케이스

- **비로그인 랭킹 클릭**: 남의 공개 통계 조회 가능(HMAC만 필요). 정상.
- **레거시 플레이어**: `DEFAULT TRUE`로 자동 공개.
- **`/public-stats` Bearer 미부착**: 의도적. 민감필드가 응답에 없는 것이 보안 핵심.
- **토글 PATCH 실패**: 롤백 + 알림. 토큰 없으면 토글 미표시라 호출 안 됨.
- **본인이 비공개 후 본인 행 클릭**: 본인은 항상 볼 수 있게("내 통계 (비공개 중)").
- **motto**: 명예의전당 경험자만 보유. 없으면 인용구 영역 생략.

## 검증

- FE: `npx -p typescript tsc --noEmit` 통과.
- BE: import/문법 확인.
- 잔여 참조 `grep`.
- 수동 ALTER는 배포 후 시놀로지 컨테이너에서 1회 실행.

## 테스트 포인트

- 공개 유저 클릭 → 요약 모달(민감정보 없음 확인).
- 비공개 유저 클릭 → "비공개" 안내.
- 설정 토글 OFF → 다른 기기에서 클릭 시 비공개 확인.
- 비로그인 시 설정에 토글 미표시.
- 본인 비공개 후 본인 행 클릭 → 요약 표시 + "비공개 중" 문구.
