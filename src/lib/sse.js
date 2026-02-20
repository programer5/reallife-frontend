// vue-front/src/lib/sse.js
import { fetchEventSource } from "@microsoft/fetch-event-source";
import axios from "axios";

// 서버와 프론트가 같은 오리진이면 그냥 "/api/sse/subscribe" 사용
const SSE_URL = "/api/sse/subscribe";

// last-event-id 저장 키
const LAST_EVENT_ID_KEY = "reallife:lastEventId";

// 재연결 백오프(최대 30초)
const BACKOFF_BASE_MS = 800;
const BACKOFF_MAX_MS = 30_000;

// 401 refresh 무한루프 방지
const MAX_REFRESH_RETRY = 1;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function computeBackoffMs(attempt) {
  // 지수 백오프 + 약간의 jitter
  const raw = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 250);
  return raw + jitter;
}

function getLastEventId() {
  return localStorage.getItem(LAST_EVENT_ID_KEY) || "";
}

function setLastEventId(id) {
  if (!id) return;
  localStorage.setItem(LAST_EVENT_ID_KEY, id);
}

function clearLastEventId() {
  localStorage.removeItem(LAST_EVENT_ID_KEY);
}

async function refreshCookieOnce() {
  // axios 인스턴스가 withCredentials 설정돼 있더라도 안전하게 명시
  return axios.post("/api/auth/refresh-cookie", null, { withCredentials: true });
}

/**
 * SSEManager
 * - singleton으로 하나의 연결만 유지
 * - 401이면 refresh-cookie 후 재연결(최대 1회)
 * - Last-Event-ID 저장/전달
 * - 네트워크/서버 오류 시 백오프 재연결
 */
class SSEManager {
  constructor() {
    this._abortController = null;
    this._isRunning = false;
    this._isConnecting = false;
    this._attempt = 0;

    this._refreshRetryCount = 0;

    // 이벤트 핸들러들
    this._handlers = new Map(); // eventName -> Set<fn>
    this._anyHandlers = new Set(); // 모든 이벤트를 받는 핸들러
  }

  on(eventName, handler) {
    if (!eventName || typeof handler !== "function") return () => {};
    if (!this._handlers.has(eventName)) this._handlers.set(eventName, new Set());
    this._handlers.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const set = this._handlers.get(eventName);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(eventName);
  }

  onAny(handler) {
    if (typeof handler !== "function") return () => {};
    this._anyHandlers.add(handler);
    return () => this._anyHandlers.delete(handler);
  }

  _emit(eventName, data, rawEvent) {
    // 특정 이벤트 구독자
    const set = this._handlers.get(eventName);
    if (set) {
      for (const fn of set) {
        try {
          fn(data, rawEvent);
        } catch (e) {
          console.error("[SSE] handler error:", e);
        }
      }
    }

    // 전체 이벤트 구독자
    for (const fn of this._anyHandlers) {
      try {
        fn({ eventName, data, rawEvent });
      } catch (e) {
        console.error("[SSE] onAny handler error:", e);
      }
    }
  }

  isConnected() {
    return this._isRunning && !!this._abortController;
  }

  /**
   * connect()
   * - 이미 연결 중/연결됨이면 중복 연결 방지
   */
  connect() {
    if (this._isConnecting || this.isConnected()) return;
    this._isRunning = true;
    this._isConnecting = true;

    // 새 연결 시작
    this._startLoop().catch((e) => {
      console.error("[SSE] startLoop fatal:", e);
    });
  }

  /**
   * disconnect()
   * - 연결 중단 + 상태 초기화
   */
  disconnect({ clearLastEvent = false } = {}) {
    this._isRunning = false;
    this._isConnecting = false;
    this._attempt = 0;
    this._refreshRetryCount = 0;

    if (this._abortController) {
      try {
        this._abortController.abort();
      } catch {}
      this._abortController = null;
    }

    if (clearLastEvent) clearLastEventId();
  }

  async _startLoop() {
    try {
      while (this._isRunning) {
        try {
          await this._openOnce();
          // 정상 종료(서버가 연결을 종료)도 재연결 대상으로 본다.
          if (this._isRunning) {
            this._attempt++;
            await sleep(computeBackoffMs(this._attempt));
          }
        } catch (err) {
          if (!this._isRunning) break;

          // fetch-event-source는 에러를 throw로 올림
          const status = err?.status ?? err?.response?.status;

          // 401이면 refresh-cookie 시도 후 재연결
          if (status === 401 && this._refreshRetryCount < MAX_REFRESH_RETRY) {
            this._refreshRetryCount++;
            try {
              await refreshCookieOnce();
              // refresh 성공 → 즉시 재연결(백오프 리셋)
              this._attempt = 0;
              continue;
            } catch (refreshErr) {
              // refresh 실패 → 세션 만료로 보고 종료
              console.warn("[SSE] refresh-cookie failed; disconnecting:", refreshErr);
              this.disconnect();
              break;
            }
          }

          // 그 외 오류는 백오프 재연결
          console.warn("[SSE] connection error:", err);
          this._attempt++;
          await sleep(computeBackoffMs(this._attempt));
        }
      }
    } finally {
      this._isConnecting = false;
    }
  }

  async _openOnce() {
    // 새 연결 준비
    this._abortController = new AbortController();

    // 연결 직전에는 refresh 루프 카운트를 리셋(정상 연결되면 새 세션 기준)
    // 단, 401에서 refresh 성공 후 바로 open되는 케이스도 있으니 여기서 리셋해도 OK
    // (401이 다시 터지면 MAX_REFRESH_RETRY로 보호됨)
    // 연결 성공 신호는 'connected' 이벤트로도 확인 가능
    const lastEventId = getLastEventId();

    await fetchEventSource(SSE_URL, {
      method: "GET",
      signal: this._abortController.signal,
      credentials: "include",
      headers: {
        ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
        Accept: "text/event-stream",
      },

      onopen: async (res) => {
        // 2xx면 연결 OK
        if (res.ok) {
          // 연결됐으니 백오프 리셋
          this._attempt = 0;
          // 정상 연결되면 refresh retry 카운트도 리셋
          this._refreshRetryCount = 0;
          return;
        }

        // 401/403 등은 에러로 처리해서 onerror로 보내기
        const err = new Error(`[SSE] open failed: ${res.status}`);
        err.status = res.status;
        throw err;
      },

      onmessage: (ev) => {
        // ev: { id, event, data, retry }
        const eventName = ev.event || "message";

        // id가 있으면 저장(서버가 Event ID를 부여하는 경우)
        if (ev.id) setLastEventId(ev.id);

        let parsed = ev.data;
        try {
          // data가 JSON이면 파싱, 아니면 문자열 그대로
          parsed = ev.data ? JSON.parse(ev.data) : ev.data;
        } catch {
          // ignore
        }

        this._emit(eventName, parsed, ev);
      },

      onclose: () => {
        // 서버가 연결을 종료 → 루프에서 재연결
        // 여기서는 그냥 반환되도록 두면 _openOnce가 resolve되며 loop에서 백오프 재연결됨
      },

      onerror: (err) => {
        // err에 status가 없을 수도 있어, onopen에서 throw한 err는 status 포함
        throw err;
      },
    });
  }
}

// 싱글톤 export
export const sse = new SSEManager();

// 편의 함수: 앱 시작 시 1회 호출
export function startSse() {
  sse.connect();
}

// 편의 함수: 로그아웃 시 호출
export function stopSse({ clearLastEvent = false } = {}) {
  sse.disconnect({ clearLastEvent });
}