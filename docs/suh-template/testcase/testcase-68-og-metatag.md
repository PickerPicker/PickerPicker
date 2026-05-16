## 🧪 테스트 케이스: URL 공유 시 OG 메타태그 및 타이틀 설정
**이슈**: #68  **담당자**: @Cassiiopeia

### ✅ 1. 기본 기능 동작 확인
- [ ] 브라우저 탭 제목이 `PickerPicker — 한글 음절로 리듬을 타는 생존 리듬게임`으로 표시됨
- [ ] `index.html` 소스에 `og:title`, `og:description`, `og:type`, `og:url`, `og:image` 태그 존재
- [ ] `index.html` 소스에 `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` 태그 존재
- [ ] `og:image` URL(`http://suh-project.synology.me:3010/og-image.png`)로 직접 접근 시 이미지 정상 로드
- [ ] `og:url`이 실서버 주소와 일치

### ⚠️ 2. SNS 플랫폼별 공유 미리보기 확인
- [ ] **카카오톡**: URL 공유 시 썸네일·제목·설명이 정상 노출
- [ ] **디스코드**: URL 붙여넣기 시 embed 카드 정상 노출
- [ ] **슬랙**: URL 붙여넣기 시 미리보기 카드 정상 노출
- [ ] **트위터/X**: URL 공유 시 `summary_large_image` 카드 형태로 노출

### 🔧 3. 디버거 도구 검증
- [ ] [Facebook OG 디버거](https://developers.facebook.com/tools/debug/) — `og:*` 태그 정상 파싱 확인
- [ ] [Twitter Card Validator](https://cards-dev.twitter.com/validator) — `twitter:*` 태그 정상 파싱 확인
- [ ] [카카오 공유 디버거](https://developers.kakao.com/tool/clear/og) — 캐시 초기화 후 정상 노출 확인

### 🎨 4. UI/UX 확인
- [ ] 브라우저 북마크 저장 시 탭 제목이 올바르게 표시됨
- [ ] 모바일 브라우저에서 탭 제목 정상 노출
- [ ] og-image가 가로로 넓은 비율(1200×630 권장)로 노출되는지 확인

### 📊 테스트 결과 요약
| 항목 | 내용 |
|------|------|
| 테스트 일자 | |
| 테스터 | |
| 환경 | 실서버 `http://suh-project.synology.me:3010` |
| 전체 결과 | ⬜ 미진행 / ✅ 통과 / ❌ 실패 |
