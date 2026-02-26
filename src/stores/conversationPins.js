// src/stores/conversationPins.js
import { defineStore } from "pinia";
import { fetchConversationPins } from "@/api/pins";

function cidKey(conversationId) {
    return String(conversationId || "");
}

export const useConversationPinsStore = defineStore("conversationPins", {
    state: () => ({
        // { [conversationId]: { items: [], loadedAt: ISO } }
        byConversationId: {},
        loading: false,
        error: "",
    }),

    actions: {
        getPins(conversationId) {
            const key = cidKey(conversationId);
            return this.byConversationId[key]?.items || [];
        },

        setPins(conversationId, pins) {
            const key = cidKey(conversationId);
            this.byConversationId[key] = {
                items: Array.isArray(pins) ? pins : [],
                loadedAt: new Date().toISOString(),
            };
        },

        appendPin(conversationId, pin) {
            const key = cidKey(conversationId);
            if (!pin?.pinId) return;

            const cur = this.byConversationId[key]?.items || [];
            const exists = cur.some((p) => String(p.pinId) === String(pin.pinId));
            if (exists) return;

            // 최신이 위로 오도록 unshift
            this.byConversationId[key] = {
                items: [pin, ...cur],
                loadedAt: this.byConversationId[key]?.loadedAt || new Date().toISOString(),
            };
        },

        ingestPinCreated(payload) {
            if (!payload?.conversationId) return;
            this.appendPin(payload.conversationId, payload);
        },

        async refresh(conversationId, { size = 10 } = {}) {
            this.loading = true;
            this.error = "";
            try {
                const pins = await fetchConversationPins({ conversationId, size });
                this.setPins(conversationId, pins);
            } catch (e) {
                this.error = e?.response?.data?.message || "핀 목록을 불러오지 못했습니다.";
            } finally {
                this.loading = false;
            }
        },
    },
});