// src/stores/sse.js
import { defineStore } from "pinia";

export const useSseStore = defineStore("sse", {
    state: () => ({
        status: "idle", // idle | connecting | connected | error
        lastEventId: localStorage.getItem("sse:lastEventId") || null,
        lastEventAt: null, // ISO string
        lastEvent: null, // { type, refId, data, id, receivedAt }
    }),

    actions: {
        // Called by external SSE manager binder to update store
        handleIncomingEvent({ type, refId = null, data = null, id = null }) {
            if (id) {
                this.lastEventId = id;
                localStorage.setItem("sse:lastEventId", id);
            }
            this.lastEventAt = new Date().toISOString();
            this.lastEvent = { type, refId, data, id, receivedAt: this.lastEventAt };
        },

        // small helpers for other parts of app to mark status
        setStatus(st) {
            this.status = st;
        },

        clearLastEventId() {
            this.lastEventId = null;
            localStorage.removeItem("sse:lastEventId");
        },
    },
});