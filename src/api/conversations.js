// src/api/conversations.js
import api from "../lib/api";

export async function createDirectConversation(targetUserId) {
    const res = await api.post("/api/conversations/direct", { targetUserId });
    return res.data; // { conversationId }
}

export async function fetchConversations({ size = 20, cursor = null } = {}) {
    const params = { size };
    if (cursor) params.cursor = cursor;

    const res = await api.get("/api/conversations", { params });
    const d = res.data || {};
    return {
        items: d.items || [],
        nextCursor: d.nextCursor ?? null,
        hasNext: !!d.hasNext,
    };
}

export async function markConversationRead(conversationId) {
    // 문서: Content-Type x-www-form-urlencoded 이지만 body 없이도 통과하는 경우 많음
    // 확실하게 하려면 api.post(url, null, { headers: ... })
    await api.post(`/api/conversations/${conversationId}/read`);
}