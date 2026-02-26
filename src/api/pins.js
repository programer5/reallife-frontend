// src/api/pins.js
import api from "../lib/api";

export async function fetchConversationPins({ conversationId, size = 10 } = {}) {
    const res = await api.get(`/api/conversations/${conversationId}/pins`, {
        params: { size },
    });
    return Array.isArray(res.data) ? res.data : [];
}