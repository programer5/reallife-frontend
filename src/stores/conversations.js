// src/stores/conversations.js
import { defineStore } from "pinia";
import { fetchConversations } from "../api/conversations";

export const useConversationsStore = defineStore("conversations", {
    state: () => ({
        items: [],
        nextCursor: null,
        hasNext: false,
        loading: false,
        error: "",
        _refreshTimer: null,
    }),

    actions: {
        async refresh() {
            // SSE 연속 이벤트 대비 디바운스
            if (this._refreshTimer) clearTimeout(this._refreshTimer);
            this._refreshTimer = setTimeout(() => this._refreshNow(), 400);
        },

        async _refreshNow() {
            this.loading = true;
            this.error = "";
            try {
                const res = await fetchConversations({ size: 20 });
                this.items = res.items;
                this.nextCursor = res.nextCursor;
                this.hasNext = res.hasNext;
            } catch (e) {
                this.error = e?.response?.data?.message || "대화 목록을 불러오지 못했습니다.";
            } finally {
                this.loading = false;
            }
        },

        async loadMore() {
            if (!this.hasNext || !this.nextCursor) return;
            const res = await fetchConversations({ size: 20, cursor: this.nextCursor });
            this.items.push(...res.items);
            this.nextCursor = res.nextCursor;
            this.hasNext = res.hasNext;
        },
    },
});