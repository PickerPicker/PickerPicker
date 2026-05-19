# Hall of Fame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랭킹 화면에 Hall of Fame 탭을 추가하여 CSS 픽셀아트 동상으로 역대 1위를 기념하고, 1위 달성 시 한마디를 남길 수 있게 한다.

**Architecture:** 백엔드에 `hall_of_fame` 테이블과 전용 라우터를 추가하고, `save_game_result`에 1위 교체 감지 로직을 삽입한다. 프론트엔드는 `RankingScreen`에 탭 전환을 추가하고 `HallOfFameTab` 컴포넌트를 신규 생성한다.

**Tech Stack:** FastAPI (SQLAlchemy asyncpg), React 19 + TypeScript, DaisyUI/Tailwind CSS

**이슈:** https://github.com/PickerPicker/PickerPicker/issues/117

---

## File Map

### 신규 생성
- `backend/src/models/hall_of_fame.py` — HallOfFame ORM 모델
- `backend/src/apis/hall_of_fame_router.py` — GET /hall-of-fame, PATCH /hall-of-fame/motto
- `src/components/HallOfFameTab.tsx` — 픽셀아트 동상 + 챔피언 정보 + 역대 목록

### 수정
- `backend/src/models/__init__.py` — HallOfFame import 추가
- `backend/src/models/player.py` — is_hall_of_famer, motto 컬럼 추가
- `backend/src/services/player_service.py` — save_game_result에 1위 교체 트리거, get_current_champion 조회
- `backend/src/apis/player_router.py` — SaveResultResponse에 is_new_champion 필드 추가
- `backend/src/main.py` — hall_of_fame_router 등록
- `src/services/playerService.ts` — HallOfFameEntry 타입, getHallOfFame(), updateMotto()
- `src/components/RankingScreen.tsx` — 탭 UI 추가, HallOfFameTab 조건부 렌더링
- `src/components/GameScreen.tsx` — is_new_champion 감지, ChampionModal 표시

---

## Task 1: DB 모델 — HallOfFame 테이블 + Player 컬럼 추가

**Files:**
- Create: `backend/src/models/hall_of_fame.py`
- Modify: `backend/src/models/player.py`
- Modify: `backend/src/models/__init__.py`

- [ ] **Step 1: HallOfFame 모델 생성**

```python
# backend/src/models/hall_of_fame.py
"""src.models.hall_of_fame
역대 1위 기록. ended_at IS NULL = 현재 챔피언 (항상 최대 1개).
"""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from src.core.database import Base


class HallOfFame(Base):
    __tablename__ = "hall_of_fame"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    motto: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
```

- [ ] **Step 2: Player 모델에 is_hall_of_famer, motto 컬럼 추가**

`backend/src/models/player.py` 의 `play_count` 컬럼 아래에 추가:

```python
    is_hall_of_famer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    motto: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
```

- [ ] **Step 3: `__init__.py`에 HallOfFame import 추가**

`backend/src/models/__init__.py` 파일 확인 후 HallOfFame import 추가:

```python
from src.models.hall_of_fame import HallOfFame  # noqa: F401
```

- [ ] **Step 4: 서버 재시작으로 테이블 자동 생성 확인**

로컬 또는 개발 환경에서 uvicorn 재시작:
```bash
cd backend
uvicorn src.main:app --reload
```
Expected: `INFO: DB 테이블 준비 완료` 로그 출력, `hall_of_fame` 테이블 생성.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/hall_of_fame.py backend/src/models/player.py backend/src/models/__init__.py
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : DB 모델 추가 (hall_of_fame 테이블, Player 컬럼) https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 2: 백엔드 서비스 — 1위 교체 트리거 + get_hall_of_fame

**Files:**
- Modify: `backend/src/services/player_service.py`

- [ ] **Step 1: 파일 상단 import에 HallOfFame 추가**

`backend/src/services/player_service.py` 상단의 import 블록에:

```python
from src.models.hall_of_fame import HallOfFame
```

- [ ] **Step 2: `get_hall_of_fame` 함수 추가**

파일 끝에 추가:

```python
async def get_hall_of_fame(db: AsyncSession) -> list[HallOfFame]:
    """명예의 전당 목록. ended_at IS NULL (현재 1위) 먼저, 이후 started_at 내림차순."""
    result = await db.execute(
        select(HallOfFame).order_by(
            HallOfFame.ended_at.is_(None).desc(),
            HallOfFame.started_at.desc(),
        )
    )
    return list(result.scalars().all())
```

- [ ] **Step 3: `save_game_result`에 1위 교체 트리거 삽입**

`save_game_result` 함수에서 `player.best_score = max(player.best_score, score)` 라인 **이전**에 현재 전체 1위 점수를 조회하고, `await db.commit()` **이전**에 트리거 로직 삽입.

기존 `# 1) Player` 블록을 아래로 교체:

```python
    # 전체 1위 점수 미리 조회 (챔피언 교체 판정용)
    top_result = await db.execute(
        select(func.max(Player.best_score))
    )
    current_top_score: int = top_result.scalar() or 0

    # 1) Player
    result = await db.execute(select(Player).where(Player.nickname == nickname))
    player = result.scalar_one_or_none()
    if not player:
        player = Player(nickname=nickname)
        db.add(player)

    is_new_champion = score > current_top_score and score > player.best_score

    player.best_score = max(player.best_score, score)
    player.best_stage = max(player.best_stage, stage)
    player.best_combo = max(player.best_combo, combo)
    player.play_count += 1
```

그리고 `# 2) GameSession 스냅샷` 블록 바로 **앞**에 챔피언 교체 블록 삽입:

```python
    # 1-b) 챔피언 교체
    if is_new_champion:
        # 기존 현재 챔피언 종료
        prev_champ_result = await db.execute(
            select(HallOfFame).where(HallOfFame.ended_at.is_(None))
        )
        prev_champ = prev_champ_result.scalar_one_or_none()
        if prev_champ:
            prev_champ.ended_at = now

        # 새 챔피언 등록
        new_entry = HallOfFame(
            nickname=nickname,
            score=score,
            started_at=now,
            ended_at=None,
        )
        db.add(new_entry)
        player.is_hall_of_famer = True
```

- [ ] **Step 4: `save_game_result` 반환값에 is_new_champion 포함**

현재 `return player` 대신:

```python
    await db.commit()
    await db.refresh(player)
    player._is_new_champion = is_new_champion  # 임시 속성으로 전달
    return player
```

> 참고: SQLAlchemy ORM 인스턴스에 임시 속성을 붙이는 방식. player_router에서 읽어 응답 스키마에 포함.

- [ ] **Step 5: `update_motto` 함수 추가**

파일 끝에 추가:

```python
async def update_motto(db: AsyncSession, nickname: str, motto: str) -> None:
    """한마디 수정. is_hall_of_famer가 False이면 PermissionError."""
    player = await get_player(db, nickname)
    if not player.is_hall_of_famer:
        raise PermissionError("1위 경험자만 한마디를 남길 수 있습니다")

    # 해당 닉네임의 가장 최근 hall_of_fame 레코드 업데이트
    result = await db.execute(
        select(HallOfFame)
        .where(HallOfFame.nickname == nickname)
        .order_by(HallOfFame.started_at.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.motto = motto

    player.motto = motto
    await db.commit()
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/player_service.py
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : player_service 1위 교체 트리거 + hall_of_fame 조회/motto 수정 https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 3: 백엔드 API — hall_of_fame_router + player_router 수정

**Files:**
- Create: `backend/src/apis/hall_of_fame_router.py`
- Modify: `backend/src/apis/player_router.py`
- Modify: `backend/src/main.py`

- [ ] **Step 1: hall_of_fame_router 생성**

```python
# backend/src/apis/hall_of_fame_router.py
"""src.apis.hall_of_fame_router
명예의 전당 API
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.services import player_service
from src.services.auth_service import verify_token

router = APIRouter(prefix="/hall-of-fame", tags=["hall-of-fame"])


class HallOfFameEntry(BaseModel):
    nickname: str
    score: int
    started_at: datetime
    ended_at: datetime | None
    motto: str | None
    days: int

    class Config:
        from_attributes = True


class MottoRequest(BaseModel):
    motto: str


@router.get("", response_model=list[HallOfFameEntry])
async def get_hall_of_fame(db: AsyncSession = Depends(get_db)):
    """명예의 전당 전체 목록 (현 1위 먼저, 이후 역대순)"""
    entries = await player_service.get_hall_of_fame(db)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = []
    for e in entries:
        end = e.ended_at or now
        days = max(0, (end - e.started_at).days)
        result.append(HallOfFameEntry(
            nickname=e.nickname,
            score=e.score,
            started_at=e.started_at,
            ended_at=e.ended_at,
            motto=e.motto,
            days=days,
        ))
    return result


@router.patch("/motto", status_code=204)
async def update_motto(
    body: MottoRequest,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """한마디 수정 — Bearer 토큰 필수, is_hall_of_famer 검증"""
    if not authorization:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer 토큰 형식이 올바르지 않습니다")

    nickname = await verify_token(db, parts[1])
    if not nickname:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    try:
        await player_service.update_motto(db, nickname, body.motto)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return None
```

- [ ] **Step 2: auth_service에 `verify_token` 함수 확인**

`backend/src/services/auth_service.py` 열어서 토큰 검증 함수명 확인. 없으면 아래를 `auth_service.py`에 추가:

```python
async def verify_token(db: AsyncSession, token: str) -> str | None:
    """토큰 유효성 검증. 유효하면 닉네임 반환, 아니면 None."""
    from src.models.player_session import PlayerSession
    from sqlalchemy import select
    from datetime import datetime
    result = await db.execute(
        select(PlayerSession).where(
            PlayerSession.token == token,
            PlayerSession.expires_at > datetime.utcnow(),
        )
    )
    session = result.scalar_one_or_none()
    return session.nickname if session else None
```

- [ ] **Step 3: player_router에 SaveResultResponse 추가 및 `/result` 엔드포인트 수정**

`backend/src/apis/player_router.py`에 `SaveResultResponse` 스키마 추가:

```python
class SaveResultResponse(BaseModel):
    nickname: str
    best_score: int
    best_stage: int
    best_combo: int
    play_count: int
    tutorial_seen: bool
    is_new_champion: bool

    class Config:
        from_attributes = True
```

`/result` 엔드포인트 response_model을 `SaveResultResponse`로 변경하고 반환 수정:

```python
@router.post("/result", response_model=SaveResultResponse)
async def save_result(body: SaveResultRequest, db: AsyncSession = Depends(get_db)):
    """게임 결과 저장 — 최고 기록 갱신 + 세션 스냅샷 + 일별 집계 UPSERT"""
    validated_stage_scores: dict[str, int] = {}
    if body.stage_scores:
        for k, v in body.stage_scores.items():
            try:
                stage_num = int(k)
            except (TypeError, ValueError):
                continue
            if not (1 <= stage_num <= MAX_STAGE):
                continue
            if not isinstance(v, int) or not (0 <= v <= MAX_SCORE):
                continue
            validated_stage_scores[str(stage_num)] = v

    player = await player_service.save_game_result(
        db, body.nickname, body.score, body.stage, body.combo, validated_stage_scores
    )
    is_new_champion = getattr(player, '_is_new_champion', False)
    return SaveResultResponse(
        nickname=player.nickname,
        best_score=player.best_score,
        best_stage=player.best_stage,
        best_combo=player.best_combo,
        play_count=player.play_count,
        tutorial_seen=player.tutorial_seen,
        is_new_champion=is_new_champion,
    )
```

- [ ] **Step 4: main.py에 hall_of_fame_router 등록**

`backend/src/main.py`의 import 블록에 추가:

```python
from src.apis.hall_of_fame_router import router as hall_of_fame_router
```

라우터 등록 블록에 추가:

```python
app.include_router(hall_of_fame_router)
```

- [ ] **Step 5: 서버 재시작 후 Swagger 확인**

```bash
cd backend && uvicorn src.main:app --reload
```
브라우저에서 `http://localhost:8000/docs` → `GET /hall-of-fame`, `PATCH /hall-of-fame/motto` 엔드포인트 확인.

- [ ] **Step 6: Commit**

```bash
git add backend/src/apis/hall_of_fame_router.py backend/src/apis/player_router.py backend/src/main.py backend/src/services/auth_service.py
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : hall_of_fame_router + SaveResultResponse is_new_champion 필드 https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 4: 초기 마이그레이션 스크립트

**Files:**
- Create: `backend/scripts/migrate_hall_of_fame_init.py`

> **주의:** 이 스크립트는 배포 후 DB에서 1회만 실행한다. 현재 1위 플레이어를 hall_of_fame에 초기 삽입.

- [ ] **Step 1: 마이그레이션 스크립트 작성**

```python
# backend/scripts/migrate_hall_of_fame_init.py
"""
hall_of_fame 테이블 초기 데이터 삽입.
현재 DB 1위 플레이어를 hall_of_fame에 1개 레코드 삽입하고
is_hall_of_famer = True 업데이트.
이미 hall_of_fame에 데이터가 있으면 실행 중단.
실행: python -m scripts.migrate_hall_of_fame_init
"""
import asyncio
from datetime import datetime
from sqlalchemy import select, func
from src.core.database import engine, Base
from src.models.player import Player
from src.models.hall_of_fame import HallOfFame
import src.models  # noqa


async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(engine) as db:
        # 이미 데이터 있으면 중단
        count_result = await db.execute(select(func.count()).select_from(HallOfFame))
        if count_result.scalar() > 0:
            print("hall_of_fame에 이미 데이터가 있습니다. 중단.")
            return

        # 현재 1위 조회
        top_result = await db.execute(
            select(Player).order_by(Player.best_score.desc()).limit(1)
        )
        top_player = top_result.scalar_one_or_none()
        if not top_player:
            print("플레이어 데이터가 없습니다.")
            return

        now = datetime.utcnow()
        entry = HallOfFame(
            nickname=top_player.nickname,
            score=top_player.best_score,
            started_at=now,
            ended_at=None,
        )
        db.add(entry)
        top_player.is_hall_of_famer = True
        await db.commit()
        print(f"초기 챔피언 등록 완료: {top_player.nickname} (점수: {top_player.best_score})")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/migrate_hall_of_fame_init.py
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : hall_of_fame 초기 마이그레이션 스크립트 https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 5: 프론트엔드 서비스 레이어

**Files:**
- Modify: `src/services/playerService.ts`

- [ ] **Step 1: HallOfFameEntry 타입 및 함수 추가**

`src/services/playerService.ts` 끝에 추가:

```typescript
export interface HallOfFameEntry {
  nickname: string
  score: number
  started_at: string
  ended_at: string | null
  motto: string | null
  days: number
}

/** 명예의 전당 목록 조회 */
export async function getHallOfFame(): Promise<HallOfFameEntry[]> {
  try {
    const res = await apiFetch(`${BASE_URL}/hall-of-fame`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

/** 한마디 수정 — Bearer 토큰 필수 */
export async function updateMotto(motto: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${BASE_URL}/hall-of-fame/motto`, {
      method: 'PATCH',
      body: JSON.stringify({ motto }),
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}
```

- [ ] **Step 2: saveGameResult 반환 타입에 is_new_champion 추가**

`src/services/playerService.ts`의 `PlayerRecord` 인터페이스에 필드 추가:

```typescript
export interface PlayerRecord {
  nickname: string
  best_score: number
  best_stage: number
  best_combo: number
  play_count: number
  tutorial_seen: boolean
  is_new_champion?: boolean  // 추가
}
```

- [ ] **Step 3: TypeScript 타입 검사**

```bash
npx -p typescript tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 4: Commit**

```bash
git add src/services/playerService.ts
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : FE 서비스 레이어 (HallOfFameEntry, getHallOfFame, updateMotto) https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 6: HallOfFameTab 컴포넌트

**Files:**
- Create: `src/components/HallOfFameTab.tsx`

- [ ] **Step 1: HallOfFameTab 컴포넌트 작성**

```tsx
// src/components/HallOfFameTab.tsx
import React, { useEffect, useState } from 'react'
import { getHallOfFame, updateMotto, type HallOfFameEntry } from '../services/playerService'
import { getStoredToken, getStoredTokenNickname } from '../services/authService'

interface HallOfFameTabProps {
  nickname: string
}

export function HallOfFameTab({ nickname }: HallOfFameTabProps) {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mottoInput, setMottoInput] = useState('')
  const [editingMotto, setEditingMotto] = useState(false)
  const [mottoMsg, setMottoMsg] = useState('')

  useEffect(() => {
    getHallOfFame().then(data => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  const champion = entries.find(e => e.ended_at === null) ?? entries[0] ?? null
  const history = entries.filter(e => e.ended_at !== null)

  const isMyChampion = !!nickname && champion?.nickname === nickname
  const canEditMotto = !!getStoredToken() && getStoredTokenNickname() === nickname &&
    entries.some(e => e.nickname === nickname)

  const handleMottoSubmit = async () => {
    if (!mottoInput.trim()) return
    const ok = await updateMotto(mottoInput.trim())
    if (ok) {
      setMottoMsg('한마디가 등록되었습니다!')
      setEditingMotto(false)
      // 목록 새로고침
      getHallOfFame().then(setEntries)
    } else {
      setMottoMsg('등록 실패. 1위 경험자만 한마디를 남길 수 있습니다.')
    }
    setTimeout(() => setMottoMsg(''), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!champion) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p style={{ color: '#6b7280', fontSize: 14 }}>아직 챔피언이 없습니다</p>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-2xl rounded-xl flex flex-col flex-1 min-h-0 overflow-y-auto"
      style={{ background: 'rgba(0, 0, 20, 0.72)', backdropFilter: 'blur(2px)', padding: '24px 20px' }}
    >
      {/* 챔피언 레이블 */}
      <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: 4, color: '#fbbf24', textShadow: '0 0 10px #f59e0b', marginBottom: 16 }}>
        👑 CURRENT CHAMPION
      </div>

      {/* 픽셀아트 동상 */}
      <PixelStatue />

      {/* 닉네임 */}
      <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 900, color: '#e879f9', textShadow: '0 0 16px #a21caf, 0 2px 4px #000', letterSpacing: 3, marginBottom: 6 }}>
        {champion.nickname}
      </div>

      {/* 재위 기간 */}
      <div style={{ textAlign: 'center', fontSize: 14, color: '#fbbf24', textShadow: '0 0 8px #f59e0b', letterSpacing: 2, marginBottom: 16 }}>
        👑 1위 달성 후 {champion.days}일째
      </div>

      {/* 스탯 뱃지 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <StatBadge gold label="점수" value={champion.score.toLocaleString()} />
        <StatBadge label="플레이 기간" value={`${champion.days}일`} />
      </div>

      {/* 한마디 */}
      <div style={{
        width: '100%',
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.25)',
        borderLeft: '3px solid #e879f9',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 8,
        fontSize: 14,
        color: '#f0abfc',
        fontStyle: 'italic',
        textAlign: 'center',
        letterSpacing: 1,
      }}>
        {champion.motto ? `" ${champion.motto} "` : '—'}
      </div>

      {/* 한마디 수정 버튼 (본인 + 인증된 hall_of_famer) */}
      {canEditMotto && !editingMotto && (
        <button
          onClick={() => { setEditingMotto(true); setMottoInput(champion.motto ?? '') }}
          style={{ alignSelf: 'center', marginBottom: 12, padding: '4px 16px', fontSize: 12, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 20, color: '#c084fc', cursor: 'pointer' }}
        >
          한마디 수정
        </button>
      )}

      {editingMotto && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            type="text"
            maxLength={100}
            value={mottoInput}
            onChange={e => setMottoInput(e.target.value)}
            placeholder="한마디를 입력하세요 (100자 이내)"
            style={{ flex: 1, background: 'rgba(0,0,20,0.5)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8, padding: '6px 12px', color: '#e2e8f0', fontSize: 13 }}
          />
          <button onClick={handleMottoSubmit} style={{ padding: '6px 14px', background: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 8, color: '#e879f9', cursor: 'pointer', fontSize: 13 }}>등록</button>
          <button onClick={() => setEditingMotto(false)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>취소</button>
        </div>
      )}

      {mottoMsg && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#a78bfa', marginBottom: 8 }}>{mottoMsg}</p>
      )}

      {/* 구분선 */}
      <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(168,85,247,0.4), transparent)', margin: '8px 0 16px' }} />

      {/* 역대 목록 */}
      <div style={{ fontSize: 10, letterSpacing: 4, color: '#6b7280', textAlign: 'center', marginBottom: 12 }}>HALL OF FAME RECORD</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 8, fontSize: 13, color: '#9ca3af' }}>
            <span style={{ color: '#c084fc', fontWeight: 'bold', width: 24 }}>{i + 1}</span>
            <span style={{ flex: 1, padding: '0 12px', color: '#e2e8f0' }}>{e.nickname}</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>{e.days}일 재위</span>
            <span style={{ color: '#7c3aed', fontSize: 11, fontStyle: 'italic', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>{e.motto ?? '—'}</span>
          </div>
        ))}
        {history.length === 0 && (
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: 12 }}>역대 기록이 없습니다</p>
        )}
      </div>
    </div>
  )
}

function StatBadge({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{
      background: gold ? 'rgba(251,191,36,0.08)' : 'rgba(168,85,247,0.15)',
      border: `1px solid ${gold ? 'rgba(251,191,36,0.4)' : 'rgba(168,85,247,0.35)'}`,
      borderRadius: 20,
      padding: '4px 14px',
      fontSize: 12,
      color: gold ? '#fde68a' : '#c084fc',
      letterSpacing: 1,
    }}>
      {label} <span style={{ color: gold ? '#fbbf24' : '#e879f9', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

function PixelStatue() {
  const c: Record<string, string> = {
    c0: 'transparent', c1: '#fbbf24', c2: '#f59e0b', c3: '#fde68a',
    c4: '#f3c4a0', c5: '#d97706', c6: '#1e1b4b', c7: '#e879f9',
    c8: '#7c3aed', c9: '#a855f7', ca: '#c084fc', cb: '#6d28d9',
    cc: '#db2777', cd: '#9d174d', ce: '#4c1d95', cf: '#3b0764', cg: '#5b21b6',
  }

  // 11×20 픽셀 맵 (row별 11개 셀 키)
  const rows: string[][] = [
    ['c0','c1','c0','c0','c3','c0','c0','c0','c1','c0','c0'],
    ['c0','c1','c0','c2','c3','c2','c0','c0','c1','c0','c0'],
    ['c0','c1','c2','c3','c1','c3','c2','c1','c2','c1','c0'],
    ['c0','c2','c1','c1','c2','c1','c1','c2','c1','c2','c0'],
    ['c0','c0','c4','c4','c4','c4','c4','c4','c4','c0','c0'],
    ['c0','c4','c4','c4','c4','c4','c4','c4','c4','c4','c0'],
    ['c0','c4','c4','c7','c6','c4','c6','c7','c4','c4','c0'],
    ['c0','c4','c4','c4','c5','c4','c5','c4','c4','c4','c0'],
    ['c0','c4','c4','c5','c4','c5','c4','c5','c4','c4','c0'],
    ['c0','c0','c0','c4','c4','c4','c4','c4','c0','c0','c0'],
    ['cc','cc','c9','ca','c9','ca','c9','ca','c9','cc','cc'],
    ['cd','cc','c8','c9','ca','c1','ca','c9','c8','cc','cd'],
    ['cd','cc','cb','c8','c9','c9','c9','c8','cb','cc','cd'],
    ['cd','c8','c9','cb','c9','c9','c9','cb','c9','c8','cd'],
    ['c0','cd','c8','c9','c8','c9','c8','c9','c8','cd','c0'],
    ['c0','c0','cb','c8','c0','c0','c0','c8','cb','c0','c0'],
    ['c0','c0','cb','c8','c0','c0','c0','c8','cb','c0','c0'],
    ['ce','ce','cg','cg','cg','cg','cg','cg','cg','ce','ce'],
    ['cf','ce','cg','ce','ce','cg','ce','ce','cg','ce','cf'],
    ['cf','cf','cf','cf','cf','cf','cf','cf','cf','cf','cf'],
  ]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
      {/* 반짝이 파티클 */}
      {[
        { top: 10, left: -12, color: '#fbbf24', delay: 0 },
        { top: 30, right: -10, color: '#fbbf24', delay: 0.4 },
        { top: -4, left: 40, color: '#e879f9', delay: 0.8 },
        { top: 50, left: -18, color: '#c084fc', delay: 1.2 },
        { top: 20, right: -16, color: '#fde68a', delay: 1.6 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 4, height: 4,
          background: s.color,
          borderRadius: '50%',
          top: s.top,
          ...(s.left !== undefined ? { left: s.left } : { right: (s as { right: number }).right }),
          animation: `sparkle 2s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}

      {/* 픽셀 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(11, 10px)',
        gridTemplateRows: 'repeat(20, 10px)',
        filter: 'drop-shadow(0 0 12px #a21caf) drop-shadow(0 0 24px #7c3aed)',
        animation: 'float 3s ease-in-out infinite',
      }}>
        {rows.flat().map((key, i) => (
          <div key={i} style={{ width: 10, height: 10, background: c[key] }} />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 타입 검사**

```bash
npx -p typescript tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 3: Commit**

```bash
git add src/components/HallOfFameTab.tsx
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : HallOfFameTab 컴포넌트 (픽셀아트 동상, 챔피언 정보, 역대 목록) https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 7: RankingScreen 탭 전환 추가

**Files:**
- Modify: `src/components/RankingScreen.tsx`

- [ ] **Step 1: HallOfFameTab import + 탭 상태 추가**

`src/components/RankingScreen.tsx` 상단 import에 추가:

```tsx
import { HallOfFameTab } from './HallOfFameTab'
```

컴포넌트 내부 상태에 추가:

```tsx
const [activeTab, setActiveTab] = useState<'ranking' | 'hall'>('ranking')
```

- [ ] **Step 2: 헤더 아래 탭 UI 삽입**

기존 `{/* 헤더 */}` div 바로 아래, `{/* 본문 */}` 로딩 분기 위에 탭 삽입:

```tsx
{/* 탭 */}
<div style={{ display: 'flex', gap: 0, border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, overflow: 'hidden', marginBottom: 4 }}>
  {(['ranking', 'hall'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '8px 28px',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 2,
        cursor: 'pointer',
        border: 'none',
        color: activeTab === tab ? '#e879f9' : '#9ca3af',
        background: activeTab === tab ? 'rgba(168,85,247,0.25)' : 'rgba(0,0,20,0.6)',
        textShadow: activeTab === tab ? '0 0 10px #a21caf' : 'none',
        transition: 'all 0.2s',
      }}
    >
      {tab === 'ranking' ? 'RANKING' : 'HALL OF FAME'}
    </button>
  ))}
</div>
```

- [ ] **Step 3: 본문 조건부 렌더링**

기존 `{loading ? ... : ranking.length === 0 ? ... : ( ... )}` 전체를 아래로 래핑:

```tsx
{activeTab === 'ranking' ? (
  /* 기존 랭킹 본문 전체 그대로 */
  loading ? ( ... ) : ranking.length === 0 ? ( ... ) : ( ... )
) : (
  <HallOfFameTab nickname={nickname} />
)}
```

- [ ] **Step 4: TypeScript 타입 검사**

```bash
npx -p typescript tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add src/components/RankingScreen.tsx
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : RankingScreen RANKING / HALL OF FAME 탭 전환 https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 8: GameScreen — 1위 달성 모달

**Files:**
- Modify: `src/components/GameScreen.tsx`

- [ ] **Step 1: is_new_champion 상태 + updateMotto import 추가**

`src/components/GameScreen.tsx` import에:

```tsx
import { saveGameResult, getRanking, updateMotto } from '../services/playerService'
```

상태 추가 (기존 state 선언 블록 아래):

```tsx
const [isNewChampion, setIsNewChampion] = useState(false)
const [championMotto, setChampionMotto] = useState('')
const [championMottoSubmitted, setChampionMottoSubmitted] = useState(false)
```

- [ ] **Step 2: finishGame 내 saveGameResult 응답 처리 수정**

기존:
```tsx
.then(record => setServerPlayCount(record.play_count))
```

교체:
```tsx
.then(record => {
  setServerPlayCount(record.play_count)
  if (record.is_new_champion) setIsNewChampion(true)
})
```

- [ ] **Step 3: 결과 화면에 ChampionModal 추가**

`phase === 'result'` 렌더링 블록 안, 기존 결과 UI 아래에 추가:

```tsx
{/* 1위 달성 모달 */}
{isNewChampion && !championMottoSubmitted && (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      background: 'rgba(0,0,20,0.95)', border: '1px solid rgba(168,85,247,0.5)',
      borderRadius: 16, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#e879f9', textShadow: '0 0 12px #a21caf', marginBottom: 8, letterSpacing: 2 }}>
        명예의 전당 등록!
      </div>
      <div style={{ fontSize: 13, color: '#c084fc', marginBottom: 20 }}>
        전체 1위를 달성했습니다. 한마디를 남겨보세요.
      </div>
      <textarea
        maxLength={100}
        value={championMotto}
        onChange={e => setChampionMotto(e.target.value)}
        placeholder="한마디 (선택사항, 100자 이내)"
        rows={2}
        style={{
          width: '100%', background: 'rgba(0,0,20,0.5)',
          border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8,
          padding: '8px 12px', color: '#e2e8f0', fontSize: 13,
          resize: 'none', marginBottom: 16,
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button
          onClick={async () => {
            if (championMotto.trim()) await updateMotto(championMotto.trim())
            setChampionMottoSubmitted(true)
            setIsNewChampion(false)
          }}
          style={{ padding: '8px 24px', background: 'rgba(168,85,247,0.3)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 8, color: '#e879f9', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {championMotto.trim() ? '등록하기' : '확인'}
        </button>
        <button
          onClick={() => { setChampionMottoSubmitted(true); setIsNewChampion(false) }}
          style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: '#9ca3af', cursor: 'pointer' }}
        >
          나중에
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript 타입 검사**

```bash
npx -p typescript tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add src/components/GameScreen.tsx
git commit -m "명예의 전당(Hall of Fame) 기능 추가 : feat : GameScreen 1위 달성 챔피언 모달 https://github.com/PickerPicker/PickerPicker/issues/117"
```

---

## Task 9: 배포 및 마이그레이션 실행

- [ ] **Step 1: 전체 push**

```bash
git push origin main
```

CI/CD 자동 트리거: VERSION-CONTROL → PROJECT-REACT-CI → PROJECT-PYTHON-CI

- [ ] **Step 2: 배포 완료 후 마이그레이션 실행**

시놀로지 NAS 백엔드 컨테이너 내부에서 1회 실행:

```bash
docker exec -it <backend-container-name> python -m scripts.migrate_hall_of_fame_init
```

Expected: `초기 챔피언 등록 완료: {닉네임} (점수: {점수})` 출력

- [ ] **Step 3: 배포 확인**

- `http://suh-project.synology.me:8001/hall-of-fame` → JSON 응답 확인
- `http://suh-project.synology.me:3010` → 랭킹 → HALL OF FAME 탭 → 동상 표시 확인

---

## Self-Review

**Spec 커버리지:**
- ✅ hall_of_fame 테이블 (Task 1)
- ✅ players.is_hall_of_famer, motto (Task 1)
- ✅ save_game_result 1위 교체 트리거 (Task 2)
- ✅ is_new_champion 응답 필드 (Task 3)
- ✅ GET /hall-of-fame + days 계산 (Task 3)
- ✅ PATCH /hall-of-fame/motto + 403 처리 (Task 3)
- ✅ 초기 마이그레이션 (Task 4)
- ✅ getHallOfFame, updateMotto 서비스 (Task 5)
- ✅ CSS 픽셀아트 동상 (11×20, 부유 + 파티클) (Task 6)
- ✅ 한마디 박스 + 수정 UI (Task 6)
- ✅ 역대 목록 (Task 6)
- ✅ 데이터 없음 처리 (Task 6)
- ✅ RANKING / HALL OF FAME 탭 전환 (Task 7)
- ✅ 1위 달성 모달 + 한마디 입력 (Task 8)

**타입 일관성:**
- `HallOfFameEntry` — Task 5에서 정의, Task 6에서 import 사용 ✅
- `updateMotto` — Task 5에서 정의, Task 6·8에서 import 사용 ✅
- `is_new_champion` — BE Task 3에서 SaveResultResponse 추가, FE Task 5에서 PlayerRecord에 추가 ✅
- `verify_token` — Task 3 Step 2에서 정의, hall_of_fame_router에서 사용 ✅
