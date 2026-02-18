# RealLife Frontend (Vue 3)

RealLife 서비스의 프론트엔드 프로젝트입니다.  
Vue 3 + Vite 기반 SPA이며, 로컬 개발에서는 백엔드(Nginx 게이트웨이)를 **Vite Proxy**로 연결합니다.

---

## Tech Stack

- Vue 3
- Vite
- Vue Router
- Pinia (상태 관리)
- Axios (API)

---

## Requirements

- Node.js 18+ (권장: 20+)
- npm 9+

---

## Getting Started

### 1) Install

~~~bash
npm install
~~~

### 2) Run Dev Server

~~~bash
npm run dev
~~~

기본 접속:

- http://localhost:5173

---

## Backend Connection (Local)

로컬 개발에서 프론트는 **Vite Proxy**로 백엔드(Nginx)를 호출합니다.

### Expected Backend

- Nginx: http://localhost (port 80)
- App (backend): 내부 8080 (외부 노출 X)
- Docs: http://localhost/docs

### Vite Proxy

`vite.config.js`에서 아래처럼 프록시를 설정합니다.

- `/api` → `http://localhost`
- `/docs` → `http://localhost`

백엔드가 80 포트를 사용하지 못하는 환경이라면, 프록시 `target`을 환경에 맞게 변경하세요.

---

## Scripts

~~~bash
npm run dev       # 개발 서버 실행
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 결과 프리뷰
~~~

---

## Project Structure (high-level)

~~~text
src/
  layouts/      # AppShell(탭/상단바 등 레이아웃)
  router/       # Vue Router 설정
  views/        # 화면 단위 페이지
  stores/       # Pinia store (추가 예정)
  lib/          # API client 등 공통 유틸 (추가 예정)
~~~

---

## Roadmap (Frontend)

- [ ] Login 연결 (POST `/api/auth/login`)
- [ ] Auth 상태 관리 (Pinia)
- [ ] `/api/me` 연결 및 프로필 화면 구성
- [ ] 프로필 이미지 업로드 + 썸네일 표시
- [ ] SSE 연결(인박스): 알림/메시지 실시간 반영
- [ ] 메시지(대화방) UI
- [ ] 배포(Netlify/Cloudflare Pages) + 환경변수 분리

---

## Notes

- 이 프로젝트는 백엔드 repo와 분리 운영됩니다.
- API 문서는 로컬에서 http://localhost/docs 에서 확인할 수 있습니다.