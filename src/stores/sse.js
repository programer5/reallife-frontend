// src/stores/sse.js
import { defineStore } from "pinia";

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * SSE Store (Global)
 * - Connect once per tab
 * - Auto reconnect with backoff
 * - Use cookie auth via withCredentials:true (recommended by backend docs)
 */
export const useSseStore = defineStore("sse", {
    state: () => ({
        status: "idle", // idle | connecting | connected | error
        lastEventId: localStorage.getItem("sse:lastEventId") || null,
        lastEventAt: null,
        lastEvent: null, // { event, data, id }
        _es: null,
        _stop: false,
    }),

    actions: {
        async connect() {
            // already connected/connecting
            if (this._es) return;

            this._stop = false;
            this.status = "connecting";

            let attempt = 0;

            while (!this._stop) {
                try {
                    // EventSource with credentials (cookie)
                    const url = this.lastEventId
                        ? `/api/sse/subscribe?lastEventId=${encodeURIComponent(this.lastEventId)}`
                        : `/api/sse/subscribe`;

                    const es = new EventSource(url, { withCredentials: true });
                    this._es = es;

                    es.addEventListener("open", () => {
                        this.status = "connected";
                        attempt = 0;
                    });

                    // server-sent named event in docs: event:connected
                    es.addEventListener("connected", (e) => {
                        this._handleEvent("connected", e);
                    });

                    // default message handler (event name may vary by server)
                    es.onmessage = (e) => {
                        this._handleEvent("message", e);
                    };

                    es.onerror = async () => {
                        this.status = "error";
                        this._cleanup();

                        // backoff: 0.5s -> 1s -> 2s -> 4s -> 8s (max)
                        attempt += 1;
                        const wait = Math.min(8000, 500 * Math.pow(2, attempt - 1));
                        await sleep(wait);
                        // loop will reconnect
                    };

                    // break the loop; reconnect handled via onerror
                    return;
                } catch {
                    this.status = "error";
                    this._cleanup();
                    attempt += 1;
                    const wait = Math.min(8000, 500 * Math.pow(2, attempt - 1));
                    await sleep(wait);
                }
            }
        },

        disconnect() {
            this._stop = true;
            this._cleanup();
            this.status = "idle";
        },

        _cleanup() {
            try {
                if (this._es) this._es.close();
            } catch {}
            this._es = null;
        },

        _handleEvent(eventName, e) {
            // Some servers expose Last-Event-ID via e.lastEventId (not always)
            const id = e?.lastEventId || null;
            if (id) {
                this.lastEventId = id;
                localStorage.setItem("sse:lastEventId", id);
            }

            let data = null;
            try {
                data = e?.data ? JSON.parse(e.data) : null;
            } catch {
                data = e?.data ?? null;
            }

            this.lastEventAt = new Date().toISOString();
            this.lastEvent = { event: eventName, data, id };

            // (Optional) debugging:
            // console.log("[SSE]", eventName, data);
        },
    },
});