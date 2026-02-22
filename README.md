# RealLife Frontend (Vue 3)

RealLife 서비스의 프론트엔드 프로젝트입니다.  
Vue 3 + Vite 기반 SPA이며, 로컬 개발에서는 백엔드(Nginx 게이트웨이)를 **Vite Proxy**로 연결합니다.

---

## Tech Stack

- Vue 3
- Vite *(현재 프로젝트는 `rolldown-vite`를 사용합니다)*
- Vue Router
- Pinia
- Axios
- SSE: `@microsoft/fetch-event-source`

---

## Requirements

- Node.js 18+ (권장: 20+)
- npm 9+

---

## Getting Started

### 1) Install
```bash
npm install
```

### 2) Run Dev Server
```bash
npm run dev
```

기본 접속:
- http://localhost:5173

---

## Backend Connection (Local)

로컬 개발에서 프론트는 **Vite Proxy**로 백엔드(Nginx)를 호출합니다.

### Expected Backend (권장)
- Nginx(Gateway): http://localhost (port 80)
- API: http://localhost/api
- Docs: http://localhost/docs

### Vite Proxy 설정
`vite.config.js`에서 아래처럼 프록시를 설정합니다.

- `/api` → `http://localhost`
- `/docs` → `http://localhost`

환경변수로 프록시 타겟 변경 가능:
- `VITE_PROXY_TARGET=http://서버IP` (기본값: `http://localhost`)

---

## Authentication (Cookie 권장)

이 프로젝트는 **HttpOnly 쿠키 기반 인증**을 기본 전제로 합니다.

- 모든 API 요청: `withCredentials: true`로 쿠키 자동 전송
- 401 발생 시:
  1) `POST /api/auth/refresh-cookie` 호출
  2) 성공하면 원래 요청을 **딱 1회 재시도**
  3) refresh 실패 시 로그인으로 유도 (세션 만료)

관련 코드:
- `src/lib/api.js` (axios 인스턴스 + refresh 큐/락 처리)
- `src/stores/auth.js` (login/logout/ensureSession)

---

## SSE (Server-Sent Events)

백엔드 SSE:
- `GET /api/sse/subscribe`

프론트는 아래 방식으로 연결합니다:
- `fetchEventSource("/api/sse/subscribe", { credentials: "include" })`

구현 포인트:
- 자동 재연결 (지수 백오프 + jitter)
- Last-Event-ID 저장/전송 (연결 끊김 이후 재연결 시 이벤트 유실 최소화)
- 401이면 refresh 후 재구독 (무한루프 방지)

관련 코드:
- `src/lib/sse.js`

---

## Scripts

```bash
npm run dev       # 개발 서버 실행
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 결과 프리뷰
```

---

## Project Structure (high-level)

```text
src/
  layouts/      # AppShell(탭/상단바 등 레이아웃)
  router/       # Vue Router 설정
  views/        # 화면 단위 페이지
  stores/       # Pinia store
  lib/          # API client, SSE 등 공통 유틸
  components/   # 공용 컴포넌트
```

---

## Git / Repo Hygiene (중요)

✅ 아래는 레포에 포함되면 안 됩니다.
- `node_modules/`
- `dist/`
- `.env*` (환경변수 파일)

예시 `.gitignore`:
```gitignore
node_modules/
dist/
.env
.env.*
.DS_Store
```

> 참고: 이번에 받은 zip에는 `node_modules`가 포함되어 있었는데, 실제 레포에서는 반드시 제외하는 것을 권장합니다.

---

## Notes

- 이 프로젝트는 백엔드 repo와 분리 운영될 수 있습니다.
- API 문서는 로컬에서 http://localhost/docs 에서 확인할 수 있습니다.
