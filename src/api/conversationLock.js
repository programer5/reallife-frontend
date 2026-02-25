// src/api/conversationLock.js
import api from "@/lib/api";

export async function getConversationLock(conversationId) {
    const res = await api.get(`/api/conversations/${conversationId}/lock`);
    return res.data; // { enabled: boolean }
}

export async function setConversationLock(conversationId, password) {
    const res = await api.post(`/api/conversations/${conversationId}/lock`, { password });
    return res.data; // { enabled: true }
}

export async function disableConversationLock(conversationId, password) {
    const res = await api.post(`/api/conversations/${conversationId}/unlock`, { password });
    return res.data; // { enabled: false }
}

export async function issueUnlockToken(conversationId, password) {
    const res = await api.post(`/api/conversations/${conversationId}/unlock-token`, { password });
    return res.data; // { token, expiresAt }
}