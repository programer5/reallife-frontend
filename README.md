# RealLife Frontend (Vue 3)

RealLife 서비스의 프론트엔드 프로젝트입니다.  
Vue 3 + Vite 기반 SPA이며, 로컬 개발에서는 백엔드(Nginx 게이트웨이)를 **Vite Proxy**로 연결합니다.

운영 안정화 단계 기준으로 현재 프론트의 우선순위는 다음과 같습니다.

1. 운영 대시보드(`AdminDashboardView.vue`) 마감
2. 운영자 진입 UX(`MeView.vue`, `/ops/dashboard`, `/me?denied=ops`) 마감
3. 운영 문서 정합성 마감
4. 이후 사용자 UX polish 복귀

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

## Ops Access (운영자 진입 설정)

현재 프론트는 백엔드 `/api/me` 응답에 `role`, `isAdmin` 같은 운영 권한 필드가 없기 때문에,  
운영 대시보드 노출 여부를 **프론트 Vite env allowlist** 기준으로 판단합니다.

사용 환경변수:
- `VITE_OPS_ALLOWED_EMAILS`
- `VITE_OPS_ALLOWED_HANDLES`

예시:
```env
VITE_OPS_ALLOWED_EMAILS=seed@test.com
VITE_OPS_ALLOWED_HANDLES=seed_001
```

적용 위치:
- 로컬 개발: `.env.local`
- 배포/운영 빌드: `.env.production`

중요:
- 백엔드 `.env`에 넣어도 프론트 운영자 노출에는 반영되지 않습니다.
- `import.meta.env`로 읽기 때문에 **프론트 재시작 또는 재빌드가 필요**합니다.
- 쉼표(`,`) 기준으로 여러 값을 넣을 수 있고, 비교는 대소문자 구분 없이 처리합니다.

관련 화면:
- `src/views/MeView.vue`
- `src/router/index.js`
- `src/views/AdminDashboardView.vue`

운영자 접근 흐름:
1. 운영자 allowlist에 포함된 계정으로 로그인
2. `/me`에서 **운영 도구** 카드 노출 확인
3. `/ops/dashboard` 진입
4. 비허용 계정이면 `/me?denied=ops`로 리다이렉트되고 설정 안내 문구 확인

---

## Admin Dashboard (운영 대시보드)

운영 대시보드는 단순 조회 화면이 아니라,  
운영자가 **지금 볼 것 → 왜 봐야 하는지 → 어디로 갈지**를 빠르게 판단할 수 있도록 만든 화면입니다.

핵심 화면:
- `src/views/AdminDashboardView.vue`

핵심 데이터 소스:
- `GET /admin/dashboard`
- `GET /admin/errors`
- `GET /admin/health`
- `GET /admin/health/realtime`
- `GET /admin/health/reminder`
- `POST /admin/alerts/test`
- `GET /admin/alerts/history`

현재 대시보드에서 바로 확인 가능한 항목:
- health / realtime / reminder 상태
- 최근 notification 5개
- 최근 서버 에러
- FAILED alert pinned 영역
- 조사 결과 요약
- 권장 다음 액션
- Slack 테스트 버튼
- 최근 운영 알림 이력
- 30초 자동 새로고침

운영 확인 권장 순서:
1. 상단 상태 strip에서 DOWN / DEGRADED / FAILED 존재 여부 확인
2. FAILED alert pinned 영역 우선 확인
3. 최근 서버 에러와 운영 알림 이력 비교
4. realtime / reminder 이상 여부 확인
5. 필요 시 Slack 테스트 전송
6. 결과가 운영 알림 이력에 기록되는지 재확인

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
  api/          # admin / posts / comments 등 API 모듈
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

> 참고: 이번에 받은 zip에는 `node_modules`와 `dist`가 포함되어 있었는데, 실제 레포에서는 반드시 제외하는 것을 권장합니다.

---

## Notes

- 이 프로젝트는 백엔드 repo와 분리 운영될 수 있습니다.
- API 문서는 로컬에서 http://localhost/docs 에서 확인할 수 있습니다.
- 운영자 접근 문제를 점검할 때는 백엔드보다 먼저 **프론트 env 값과 재빌드 여부**를 확인하는 것이 가장 빠릅니다.

---

## Product Roadmap

### Phase 1 — 프론트 완성도(UX) 마감
- [ ] 프로필/DM/알림/읽음 정합성 점검 (탭 뱃지, 목록 unreadCount, 상세 read 처리)
- [ ] 에러 UX 통일 (토스트/리트라이/빈 상태/로딩 스켈레톤)
- [x] 운영 대시보드 최종 polish
- [x] 운영자 진입 UX 마감
- [ ] 운영 문서 정합성 마감
- [ ] 접근성/키보드 UX (Enter/ESC, 포커스, aria-label)
- [ ] 성능/체감 개선 (리스트 가상화 필요 시, 이미지 lazy-load)
- [ ] 디자인 시스템 정리
  - 버튼/카드/입력/배지/모달 토큰화
  - 다크 테마 기준 대비/가독성 체크

### Phase 2 — 차별화 1~2개 먼저 출시
**추천 1) 락 메시지(비밀번호 잠금)**
- 특정 메시지/이미지에 PIN(또는 생체/비번) 잠금
- 열람 시간 제한/횟수 제한(선택)

**추천 2) 약속/장소 자동 넛지(채팅 상단 핀 + 알림)**
- “내일 7시”, “다음 주 홍대” 등 감지 → 채팅 상단 임시 핀
- 1시간 전 알림(참여자 전체)

### Phase 3 — AI 기능은 선택형(옵션)으로 확장
- Catch-up 카드(최근 n개 중 핵심)
- To-do 추출(“추출 → 사용자가 확정” UX)

---

## Differentiation Ideas

### A. 실사용 락인 기능
- 약속/장소 자동 넛지(채팅 상단 핀 + 알림)
- 대화 내 검색(키워드+필터) + 중요 메시지 북마크
- 타임캡슐 메시지(날짜/장소 조건 해제)

### B. 시그니처(바이럴/재방문)
- 메시지 “비밀번호 잠금(락 메시지)”
  - 특정 메시지/사진에 PIN 또는 생체/비번 잠금
  - 상대가 볼 수 있는 시간/횟수 제한까지 붙이면 파괴력 큼
- 감정 이펙트(축하/응원/위로 등 키워드 기반 UI 효과)
  - 구현 난이도 대비 “멋있다” 체감이 큼

### C. AI는 “선택형”으로 (비용/정확도 때문에)
- Catch-up 카드(최근 n개 중 핵심) + To-do 추출(확정 버튼형)
- 자동 등록보다 “추출 → 사용자가 확정” UX를 권장 (품질/신뢰/비용 밸런스)

---

## Release Checklist (프론트)

- [ ] 모든 API 호출 `withCredentials`/401 refresh 루프 방지 확인
- [ ] SSE 재연결/토큰 만료 시 재구독 확인
- [ ] `/me` 운영 도구 카드 노출 확인
- [ ] `/me?denied=ops` 안내 문구 확인
- [ ] `/ops/dashboard` 진입 가능 여부 확인
- [ ] `VITE_OPS_ALLOWED_EMAILS` / `VITE_OPS_ALLOWED_HANDLES` 적용 후 재빌드 확인
- [ ] `POST /admin/alerts/test` 실행 후 운영 알림 이력 갱신 확인
- [ ] 모바일 뷰(320px) 깨짐 점검
- [ ] Lighthouse(성능/접근성/베스트프랙티스) 1회 점검
