// src/stores/conversationPins.js
import { defineStore } from "pinia";
import { fetchConversationPins } from "@/api/pins";

function keyOf(conversationId) {
    return String(conversationId || "");
}

export const useConversationPinsStore = defineStore("conversationPins", {
    state: () => ({
        byConversationId: {}, // { [cid]: { items: [], loadedAt } }
        // ✅ NEW: PIN_REMIND 배지 상태
        remindBadgeByConversationId: {}, // { [cid]: true }
        loading: false,
        error: "",
    }),

    getters: {
        hasRemindBadge: (state) => (conversationId) => {
            const k = keyOf(conversationId);
            return !!state.remindBadgeByConversationId[k];
        },
    },

    actions: {
        getPins(conversationId) {
            return this.byConversationId[keyOf(conversationId)]?.items || [];
        },

        setPins(conversationId, pins) {
            this.byConversationId[keyOf(conversationId)] = {
                items: Array.isArray(pins) ? pins : [],
                loadedAt: new Date().toISOString(),
            };
        },

        appendPin(conversationId, pin) {
            if (!pin?.pinId) return;
            const k = keyOf(conversationId);
            const cur = this.byConversationId[k]?.items || [];
            const exists = cur.some((p) => String(p.pinId) === String(pin.pinId));
            if (exists) return;

            this.byConversationId[k] = {
                items: [pin, ...cur],
                loadedAt: this.byConversationId[k]?.loadedAt || new Date().toISOString(),
            };
        },

        removePin(conversationId, pinId) {
            const k = keyOf(conversationId);
            const cur = this.byConversationId[k]?.items || [];
            this.byConversationId[k] = {
                items: cur.filter((p) => String(p.pinId) !== String(pinId)),
                loadedAt: this.byConversationId[k]?.loadedAt || new Date().toISOString(),
            };
        },

        ingestPinCreated(payload) {
            const cid = payload?.conversationId;
            if (!cid) return;
            this.appendPin(cid, payload);
        },

        ingestPinUpdated(payload) {
            const cid = payload?.conversationId;
            const pinId = payload?.pinId;
            const action = payload?.action;
            if (!cid || !pinId) return;

            // DONE/CANCELED/DISMISSED => pinned에서 제거
            if (action === "DONE" || action === "CANCELED" || action === "DISMISSED") {
                this.removePin(cid, pinId);
            }
        },

        // ✅ NEW: PIN_REMIND 배지 ON/OFF
        markRemindBadge(conversationId) {
            const k = keyOf(conversationId);
            if (!k) return;
            this.remindBadgeByConversationId[k] = true;
        },

        clearRemindBadge(conversationId) {
            const k = keyOf(conversationId);
            if (!k) return;
            if (this.remindBadgeByConversationId[k]) {
                delete this.remindBadgeByConversationId[k];
            }
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