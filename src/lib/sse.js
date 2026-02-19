import { fetchEventSource } from '@microsoft/fetch-event-source'

/**
 * ✅ 실서비스 추천: 쿠키 기반 로그인
 * - credentials: 'include' 로 쿠키 자동 전송
 * - token은 선택(토큰 로그인 옵션 유지)
 */
export function connectSse({ url, token, onMessage, onError, onOpen }) {
  const ctrl = new AbortController()

  fetchEventSource(url, {
    signal: ctrl.signal,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onopen(res) {
      onOpen?.(res)
    },
    onmessage(ev) {
      onMessage?.(ev)
    },
    onerror(err) {
      onError?.(err)
      // 기본은 재시도. 완전히 끊고 싶으면 throw err;
    },
  })

  return () => ctrl.abort()
}
