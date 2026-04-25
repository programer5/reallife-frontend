# Ops Dashboard Health UI Check

## 이번 단계 목적

백엔드에서 추가한 리마인더/SSE 헬스 추적값을 운영 대시보드에서 바로 볼 수 있게 프론트 표시 항목을 확장했다.

## 변경 확인 경로

- `/ops/dashboard`
- 또는 프로젝트 라우터에서 연결된 Admin Dashboard 화면

## 확인할 항목

### Realtime 흐름

아래 값이 화면에 보여야 한다.

- 실시간 상태
- 활성 SSE 연결
- 마지막 SSE 이벤트
- 최근 연결 등록
- 최근 연결 해제
- SSE 실패 수
- 최근 SSE 실패
- SSE 실패 메시지
- health 체크 시각

### Reminder 흐름

아래 값이 화면에 보여야 한다.

- Reminder 상태
- 마지막 실행
- 마지막 성공
- 마지막 실패
- 실패 메시지
- 최근 reminder 생성

## 로컬 확인 순서

```bash
npm install
npm run build
npm run dev
```

백엔드가 떠 있는 상태에서 `/ops/dashboard`에 접속하고, 운영자 allowlist 계정으로 로그인되어 있는지 확인한다.

## Redis/SSE 실데이터 참고 명령

```bash
docker exec -it reallife-redis redis-cli
keys sse:events:*
type sse:events:<id>
lrange sse:events:<id> 0 -1
```

`type` 결과가 stream이면 `xrange sse:events:<id> - +`를 사용한다.
