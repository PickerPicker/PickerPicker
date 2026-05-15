# 게임 화면 UI 다듬기 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 갈무리9 픽셀 폰트를 전역 적용하고, 본게임 시작 시 노트가 오른쪽 끝에서 순서대로 등장하도록 수정한다.

**Architecture:** index.html에 CDN 폰트를 추가하고 CSS에서 전역 적용. PlayStage의 startTime에 travel 오프셋을 더해 NoteTrack의 delay가 항상 양수가 되도록 수정.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite

---

## 파일 구조

| 파일 | 변경 |
|------|------|
| `index.html` | Galmuri9 CDN link 추가 |
| `src/index.css` | 전역 font-family에 Galmuri9 우선 적용 |
| `src/components/game/PlayStage.tsx` | startTime = Date.now() + travelDuration |
| `src/components/game/NoteTrack.tsx` | delay = i * beatMs (음수 제거) |

---

## Task 1: 갈무리9 폰트 적용

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: index.html에 CDN 추가**

`<title>` 태그 다음 줄에 추가:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css" />
```

최종 `<head>`:
```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>pickerpicker-init</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css" />
</head>
```

- [ ] **Step 2: src/index.css 전역 폰트 선언 추가**

`@plugin "daisyui/theme"` 블록 닫는 `}` 바로 다음에 추가:
```css
* {
  font-family: 'Galmuri9', monospace;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: `✓ built in ~XXXms` 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add index.html src/index.css
git commit -m "feat: 갈무리9 픽셀 폰트 전역 적용"
```

---

## Task 2: 노트 스폰 위치 수정

**Files:**
- Modify: `src/components/game/PlayStage.tsx` (line 109)
- Modify: `src/components/game/NoteTrack.tsx` (line 33)

- [ ] **Step 1: PlayStage startTime 오프셋 추가**

`src/components/game/PlayStage.tsx` 의 useEffect 내 startTime 설정 (line ~109):

```ts
// 변경 전
startTimeRef.current = Date.now()

// 변경 후
const travelDuration = NOTE_TRAVEL_BEATS * beatMs
startTimeRef.current = Date.now() + travelDuration
```

단, `NOTE_TRAVEL_BEATS`는 PlayStage에 없으므로 상단 상수 추가:
```ts
const NOTE_TRAVEL_BEATS = 4  // NoteTrack과 동일한 값
```

- [ ] **Step 2: NoteTrack delay 계산 수정**

`src/components/game/NoteTrack.tsx` line 33:

```ts
// 변경 전
const delay = i * beatMs - travelDuration

// 변경 후
const delay = i * beatMs
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/components/game/PlayStage.tsx src/components/game/NoteTrack.tsx
git commit -m "fix: 본게임 시작 시 노트가 오른쪽 끝에서 순서대로 등장하도록 수정"
```

---

## Task 3: upstream main push

- [ ] **Step 1: upstream push**

```bash
git push upstream HEAD:main
```
