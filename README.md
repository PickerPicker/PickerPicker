<div align="center">

![배너](여기에_배너_이미지_URL)

<br/>

**한국 음절로 즐기는 생존형 리듬게임**

[![지금 플레이하기](https://img.shields.io/badge/▶%20지금%20플레이하기-00BFFF?style=for-the-badge)](http://suh-project.synology.me:3010)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/PickerPicker/PickerPicker)

</div>

---

## 🎮 PickerPicker란?

한국 음절을 키보드로 입력하는 **생존형 리듬게임**이에요.

리드미컬한 음악에 맞춰 15개 스테이지를 쉬지 않고 달려야 하고, 리듬을 놓칠수록 게이지가 뚝 떨어져요.  
마지막 스테이지까지 살아남으면 **ALL CLEAR** — 과연 버틸 수 있을까요?

> 🤖 **[SUH-DEVOPS-TEMPLATE](https://github.com/Cassiiopeia/SUH-DEVOPS-TEMPLATE)** 의 25개 AI Agent 스킬과 GitHub Actions 자동화 파이프라인을 활용해  
> **단 10시간 만에** 기획부터 배포까지 완성한 프로젝트예요.

<br/>

![메인 이미지](여기에_메인_게임_이미지_URL)

---

## ✨ 주요 기능

<br/>

### 🎵 15스테이지 생존 도전

한국 음절 단어들이 쏟아지는 15개 스테이지.  
스테이지가 올라갈수록 빨라지고 복잡해져요. 절대 멈추지 않아요.

![본게임](여기에_본게임_이미지_URL)

<br/>

### 🎓 튜토리얼

처음이라도 걱정 없어요. 리듬 읽는 법부터 키 배치까지 차근차근 알려줘요.

![튜토리얼](여기에_튜토리얼_이미지_URL)

<br/>

### 🏋️ 연습 모드

원하는 단어를 골라 반복 연습할 수 있어요. 본 게임 전 워밍업으로 딱이에요.

![연습모드](여기에_연습모드_이미지_URL)

<br/>

### 🏆 전국 랭킹

닉네임으로 로그인하면 내 최고 기록이 서버에 저장돼요.  
점수, 클리어 스테이지, 콤보로 다른 플레이어와 경쟁해요.

![랭킹](여기에_랭킹_이미지_URL)

---

## 🛠️ 기술 스택

<div align="center">

**Frontend**

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![DaisyUI](https://img.shields.io/badge/DaisyUI_v5-5A0EF8?style=flat-square&logo=daisyui&logoColor=white)

**Backend**

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**Infra / DevOps**

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![DockerHub](https://img.shields.io/badge/DockerHub-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Linux Server](https://img.shields.io/badge/Linux_Server-FCC624?style=flat-square&logo=linux&logoColor=black)

</div>

---

## ⚙️ 자동화 파이프라인

`main` 브랜치 푸시 한 번으로 배포까지 전 과정이 자동으로 돌아가요.

```
main push
  → 버전 자동 태깅 (VERSION-CONTROL)
  → React 빌드 검증 (CI)
  → FastAPI Docker 빌드 검증 (CI)
  → deploy 브랜치 생성
  → DockerHub 이미지 빌드 & 푸시
  → 서버 SSH 접속 → 컨테이너 교체 → 헬스체크
  → CHANGELOG 자동 업데이트
```

프론트엔드(포트 3010)와 백엔드(포트 8001) 배포가 독립적으로 병렬 실행돼요.

---

## 👥 팀 소개

> **2026 INTERCON** 출품작

<div align="center">

| <img width="1376" height="1371" alt="KakaoTalk_Photo_2026-05-16-18-45-49" src="https://github.com/user-attachments/assets/4b9d30dc-5c04-4fb0-abd5-9ae814ec4af7" width="80" style="border-radius:50%"/> | <img src="여기에_프로필사진" width="80" style="border-radius:50%"/> | <img src="여기에_프로필사진" width="80" style="border-radius:50%"/> | <img width="834" height="834" alt="KakaoTalk_Photo_2026-05-16-18-45-56" src="https://github.com/user-attachments/assets/c12043a5-c906-4533-a535-85e860094465" width="80" style="border-radius:50%"/> | <img width="1081" height="1080" alt="KakaoTalk_Photo_2026-05-16-18-44-09" src="https://github.com/user-attachments/assets/d368999d-cfea-4dc8-9bd4-21f067cd47ce" width="80" style="border-radius:50%"/> |
|:---:|:---:|:---:|:---:|:---:|
| **이하경** | **배나현** | **이건희** | **황시선** | **서새찬** |
| PM | DESIGN | FRONTEND | BACKEND | LEAD |

</div>

---

<!-- AUTO-VERSION-SECTION: DO NOT EDIT MANUALLY -->
## 최신 버전 : v0.0.72 (2026-05-16)

[전체 버전 기록 보기](CHANGELOG.md)
