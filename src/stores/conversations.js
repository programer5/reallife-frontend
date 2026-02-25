// src/stores/conversations.js
import { defineStore } from "pinia";
import { fetchConversations } from "../api/conversations";

function preview(text) {
    const s = (text ?? "").toString().trim();
    if (!s) return "";
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

export const useConversationsStore = defineStore("conversations", {
    state: () => ({
        items: [],
        nextCursor: null,
        hasNext: false,
        loading: false,
        error: "",
        _refreshTimer: null,

        // ✅ DM 상세 화면에서 현재 보고 있는 대화방
        activeConversationId: null,

        // ✅ 목록에 없던 대화가 들어올 때 “보정용 refresh” 한번 돌리기 위한 타이머
        _softSyncTimer: null,
    }),

    actions: {
        setActiveConversation(conversationId) {
            this.activeConversationId = conversationId ? String(conversationId) : null;
        },

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
                this.items = res.items || [];
                this.nextCursor = res.nextCursor ?? null;
                this.hasNext = !!res.hasNext;
            } catch (e) {
                this.error = e?.response?.data?.message || "대화 목록을 불러오지 못했습니다.";
            } finally {
                this.loading = false;
            }
        },

        async loadMore() {
            if (!this.hasNext || !this.nextCursor) return;
            const res = await fetchConversations({ size: 20, cursor: this.nextCursor });
            this.items.push(...(res.items || []));
            this.nextCursor = res.nextCursor ?? null;
            this.hasNext = !!res.hasNext;
        },

        /**
         * ✅ 추천 핵심: SSE message-created payload로 목록을 즉시 부분 업데이트
         * payload: { messageId, conversationId, senderId, content, createdAt }
         */
        ingestMessageCreated(payload) {
            if (!payload?.conversationId) return;

            const cid = String(payload.conversationId);
            const createdAt = payload.createdAt || new Date().toISOString();
            const lastMessagePreview = preview(payload.content);

            const active = this.activeConversationId && String(this.activeConversationId) === cid;

            const idx = this.items.findIndex((c) => String(c.conversationId) === cid);

            if (idx >= 0) {
                const cur = this.items[idx];
                const next = {
                    ...cur,
                    lastMessageAt: createdAt,
                    lastMessagePreview,
                    unreadCount: active ? (cur.unreadCount || 0) : (cur.unreadCount || 0) + 1,
                };

                // ✅ 리스트 맨 위로
                const copy = this.items.slice();
                copy.splice(idx, 1);
                copy.unshift(next);
                this.items = copy;
                return;
            }

            // ✅ 목록에 없던 대화면 임시 카드로 먼저 추가하고, 잠깐 뒤 refresh로 보정
            const placeholder = {
                conversationId: cid,
                peerUser: null,
                lastMessageAt: createdAt,
                lastMessagePreview,
                unreadCount: active ? 0 : 1,
            };

            this.items = [placeholder, ...(this.items || [])];

            // peerUser 닉네임 같은 정확한 데이터는 refresh로 한번 보정
            this.softSyncSoon();
        },

        /**
         * ✅ “보정용 refresh” - 잦게 부르지 않도록 800ms 디바운스
         */
        softSyncSoon() {
            if (this._softSyncTimer) clearTimeout(this._softSyncTimer);
            this._softSyncTimer = setTimeout(() => {
                this.refresh();
            }, 800);
        },
    },
});