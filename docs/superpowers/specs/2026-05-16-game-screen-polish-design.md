# 게임 화면 UI 다듬기 설계

## 범위

1. 갈무리9 폰트 전역 적용
2. 노트 스폰 위치 수정 (오른쪽 끝에서 순서대로 등장)
3. 업스트림 main(PickerPicker/PickerPicker)에서 직접 작업

---

## 1. 갈무리9 폰트

**CDN:** `https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css`
**font-family:** `'Galmuri9'`

- `index.html` `<head>`에 `<link>` 태그로 CDN 추가
- `src/index.css`의 전체 폰트 선언에 `'Galmuri9'` 우선 적용
- 노트 카드, 키보드 키, 판정 텍스트 등 게임 UI 전반에 반영

---

## 2. 노트 스폰 위치 수정

### 현재 문제

```
startTime = Date.now()
delay(노트 i) = i * beatMs - NOTE_TRAVEL_BEATS * beatMs
```

- 노트 0: delay = -4*beatMs → 게임 시작 즉시 판정선에 도달해 있음
- 노트 1~3: 이미 화면 중간에서 이동 중

### 수정 방식

```
startTime = Date.now() + NOTE_TRAVEL_BEATS * beatMs
delay(노트 i) = i * beatMs  (항상 ≥ 0)
```

- 노트 0: delay = 0 → 즉시 오른쪽 끝에서 출발, 4 beat 후 판정선 도달
- 노트 1: delay = beatMs → 1 beat 후 오른쪽 끝에서 출발
- 모든 노트가 오른쪽 끝에서 순서대로 등장

### 판정 타이밍 유지

```
arrivalTime = startTimeRef.current + i * beatMs
= (now + 4*beatMs) + i*beatMs
```

자동 MISS, 키 입력 판정 모두 동일하게 동작.

---

## 수정 파일

| 파일 | 변경 |
|------|------|
| `index.html` | Galmuri9 CDN link 추가 |
| `src/index.css` | font-family에 Galmuri9 추가 |
| `src/components/game/PlayStage.tsx` | startTime offset 추가 |
| `src/components/game/NoteTrack.tsx` | delay = i * beatMs |
