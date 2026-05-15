# 🚀[기능개선][Audio] SFX 오디오 딜레이 제거 — AudioContext 프리로드 적용

- 라벨: 작업전
- 담당자: Cassiiopeia

---

📝 현재 문제점
---

- `playSfx()` 함수가 매 호출마다 `new Audio(src)`로 오디오 객체를 새로 생성하여 로드 → 클릭/판정 시 SFX 딜레이 발생
- `sfx_note_miss.mp3` 파일에 앞부분 약 48ms 무음 구간 존재 → 파일 자체적인 초기 딜레이 가중
- `sfx_note_hit.mp3` 파일의 뒷부분 약 580ms가 무음 → 불필요한 파일 크기(25KB → 7KB)

🛠️ 해결 방안 / 제안 기능
---

- `useAudio.ts`의 SFX 재생 방식을 `new Audio()` → `AudioContext` + `AudioBuffer` 프리로드 방식으로 전환
- 앱 첫 사용자 인터랙션 시 `ensureAudioCtx()`로 `AudioContext` 초기화 및 SFX 파일 전체 프리디코딩
- `AudioBufferSourceNode.start(0, MP3_PREGAP_SEC)`로 MP3 프리갭(~26ms) 건너뛰어 즉각 재생
- ffmpeg으로 `sfx_note_hit.mp3` 뒷 무음 제거 (0.81초 → 0.25초), `sfx_note_miss.mp3` 앞뒤 무음 제거

⚙️ 작업 내용
---

- `src/hooks/useAudio.ts`: `playSfx` 함수를 `AudioContext` 버퍼 방식으로 교체, `ensureAudioCtx` 추가
- `src/App.tsx`: `handleStart`에서 첫 클릭 시 `ensureAudioCtx()` 호출하여 AudioContext 초기화 트리거
- `public/audio/sfx_note_hit.mp3`: 뒷 무음 제거 (25KB → 7KB)
- `public/audio/sfx_note_miss.mp3`: 앞뒤 무음 제거 (3.4KB → 2KB)
- `public/audio/backup_original/`: 원본 파일 백업 저장

🙋‍♂️ 담당자
---

- 프론트엔드: Cassiiopeia
