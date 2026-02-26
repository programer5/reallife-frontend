// src/lib/sse.js
import { fetchEventSource } from "@microsoft/fetch-event-source";
import axios from "axios";

const LAST_EVENT_ID_KEY = "sse:lastEventId";

function getLastEventId() {
  return localStorage.getItem(LAST_EVENT_ID_KEY) || "";
}
function setLastEventId(id) {
  if (id) localStorage.setItem(LAST_EVENT_ID_KEY, id);
}
export function clearLastEventId() {
  localStorage.removeItem(LAST_EVENT_ID_KEY);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// refresh는 SSE용으로도 별도 client 사용 (루프 방지)
const refreshClient = axios.create({
  baseURL: "",
  withCredentials: true,
  timeout: 15000,
});
async function refreshCookie() {
  await refreshClient.post("/api/auth/refresh-cookie");
}

class SSEManager {
  constructor() {
    this.running = false;
    this.connected = false;
    this.controller = null;

    this.retryCount = 0;
    this.maxBackoffMs = 30000;

    this.refreshRetryCount = 0;
    this.maxRefreshRetry = 1;

    this.eventListeners = new Set();
    this.statusListeners = new Set();

    // store binder (optional)
    this._boundStore = null;
  }

  // ---- event subscription API ----
  onEvent(cb) {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  onStatus(cb) {
    this.statusListeners.add(cb);
    cb({ running: this.running, connected: this.connected });
    return () => this.statusListeners.delete(cb);
  }

  _emitStatus() {
    const payload = { running: this.running, connected: this.connected };
    this.statusListeners.forEach((cb) => cb(payload));
  }

  _emitEvent(evt) {
    // evt: { type, data, id, refId? }
    this.eventListeners.forEach((cb) => cb(evt));

    // if a Pinia store is bound, update it too
    if (this._boundStore && typeof this._boundStore.handleIncomingEvent === "function") {
      try {
        const refId = evt.data && evt.data.refId ? evt.data.refId : evt.refId || null;
        this._boundStore.handleIncomingEvent({
          type: evt.type,
          refId,
          data: evt.data,
          id: evt.id || "",
        });
      } catch {
        // ignore store errors
      }
    }
  }

  bindStore(store) {
    // store must implement handleIncomingEvent({type, refId, data, id})
    this._boundStore = store;
  }

  // ---- start/stop ----
  start() {
    if (this.running) return;
    this.running = true;
    this.connected = false;
    this.retryCount = 0;
    this.refreshRetryCount = 0;
    this._emitStatus();
    this._loop();
  }

  stop({ clearLastEvent = false } = {}) {
    this.running = false;
    this.connected = false;
    this._emitStatus();
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (clearLastEvent) clearLastEventId();
  }

  // ---- main loop using fetchEventSource ----
  async _loop() {
    while (this.running) {
      const controller = new AbortController();
      this.controller = controller;

      try {
        const lastEventId = getLastEventId();

        await fetchEventSource("/api/sse/subscribe", {
          signal: controller.signal,
          credentials: "include",
          openWhenHidden: true,
          headers: lastEventId ? { "Last-Event-ID": lastEventId } : {},

          onopen: async (res) => {
            if (res.ok) {
              this.connected = true;
              this.retryCount = 0;
              this.refreshRetryCount = 0;
              this._emitStatus();
              return;
            }

            // 401 -> refresh 1회 시도
            if (res.status === 401) {
              this.connected = false;
              this._emitStatus();

              if (this.refreshRetryCount < this.maxRefreshRetry) {
                this.refreshRetryCount += 1;
                await refreshCookie();
                throw new Error("SSE unauthorized - refreshed, reconnect");
              }
              throw new Error("SSE unauthorized - refresh failed");
            }

            throw new Error(`SSE open failed: ${res.status}`);
          },

          onmessage: (msg) => {
            // msg: { id, data, event? }
            if (msg?.id) setLastEventId(msg.id);

            // try to parse data
            let parsed = null;
            try {
              parsed = msg?.data ? JSON.parse(msg.data) : null;
            } catch {
              parsed = msg?.data ?? null;
            }

            // ✅ FIX: 서버 SSE의 event: 값을 최우선으로 사용 (payload.type 과 충돌 방지)
            // (pin-created 같은 SSE 이벤트가 payload.type=SCHEDULE 때문에 깨지던 문제 해결)
            const type = msg.event || (parsed && parsed.eventType) || "message";

            // refId often in payload as parsed.refId or parsed.conversationId — we keep payload intact
            const refId =
                parsed && (parsed.refId || parsed.conversationId)
                    ? parsed.refId || parsed.conversationId
                    : null;

            this._emitEvent({
              type,
              data: parsed,
              id: msg.id || "",
              refId,
            });
          },

          onerror: (err) => {
            throw err;
          },
        });
      } catch (err) {
        if (!this.running) break;
        this.connected = false;
        this._emitStatus();

        // exponential backoff + jitter
        const backoff = Math.min(this.maxBackoffMs, 1000 * Math.pow(2, this.retryCount));
        this.retryCount += 1;
        const jitter = Math.floor(Math.random() * 300);
        await sleep(backoff + jitter);
      } finally {
        if (this.controller === controller) this.controller = null;
      }
    }
  }
}

const sse = new SSEManager();
export default sse;