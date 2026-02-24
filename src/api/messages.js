// src/api/messages.js
import api from "../lib/api";

export async function fetchMessages({ conversationId, size = 20, cursor = null } = {}) {
    const params = { size };
    if (cursor) params.cursor = cursor;

    const res = await api.get(`/api/conversations/${conversationId}/messages`, { params });
    const d = res.data || {};
    return {
        items: d.items || [],
        nextCursor: d.nextCursor ?? null,
        hasNext: !!d.hasNext,
    };
}

export async function sendMessage({ conversationId, content, attachmentIds = [] }) {
    const res = await api.post(`/api/conversations/${conversationId}/messages`, {
        content,
        attachmentIds,
    });
    return res.data; // message object
}

export async function hideMessage(messageId) {
    await api.post(`/api/messages/${messageId}/hide`);
}

export async function deleteMessageForAll(messageId) {
    await api.post(`/api/messages/${messageId}/delete-for-all`);
}