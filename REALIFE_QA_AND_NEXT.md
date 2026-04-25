# RealLife QA and next

## 이번 수정 이유
- 웹 Home은 독립된 웹 피드처럼 보여야 하고, 좌우 레일/랜딩 느낌보다 **정돈된 중앙 피드**가 더 맞다.
- PostDetail의 하단 등록 버튼은 작은 화면에서 **무조건 입력창 아래**에 내려와야 한다.

## 바로 다음
1. 회원가입 / 공개 피드 / 댓글 수 / Reminder 회귀 테스트
2. Feed 공유 메타 polish 마무리
3. 프로필 / 팔로우 / 검색 마지막 polish
4. 운영 체크
   - SSE
   - Cookie / CORS
   - backup
   - docs / asciidoctor

## 이번에 추가한 정리
- 공동 플레이 MVP를 런칭 전 차별화 기능 후보로 명시
- ConversationDetail 구조 정리 이후 shared play를 얹는 순서로 재정렬
- 백엔드에는 Search / Elasticsearch 운영 체크를 별도 항목으로 보강
---

## 2026-04-25 안정화 기준 메모

이번 단계부터는 기능 추가보다 `ConversationDetailView.vue` 분리 후 안정화가 우선이다.

### 로컬에서 먼저 확인할 순서

```bash
# 압축본에 포함된 node_modules를 믿지 말고 재설치
rm -rf node_modules package-lock.json
npm install

# 빌드 확인
npm run build
```

### 대화 상세 화면 우선 점검

1. `/inbox/conversations/:conversationId` 진입
2. 잠금된 대화 / 잠금 없는 대화 각각 확인
3. Lens 열기/닫기
4. Stage Sheet 열기/닫기
5. SessionHub 최근/진행 중 세션 확인
6. ActivePinDock 액션/제안 탭 확인
7. 메시지 전송/수정/재시도/후보 저장 확인
8. 캡슐 패널 열기/접기/삭제 확인
9. 검색에서 대화로 복귀했을 때 SearchReturnBar 확인

### 지금부터의 우선순위

1. 빌드 에러 0
2. 런타임 콘솔 에러 0
3. unused import/변수/함수 정리
4. CSS 경계 문제 정리
5. Pin Reminder E2E 확인
6. SSE 재연결 확인
7. 공동 플레이는 그 다음 단계에서 마감
