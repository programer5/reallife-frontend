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

export async function fetchConversationReadState(conversationId) {
    const res = await api.get(`/api/conversations/${conversationId}/read-state`);
    return res.data; // { lastReadAt }
}

export async function fetchConversationReadReceipts(conversationId) {
    const res = await api.get(`/api/conversations/${conversationId}/read-receipts`);
    return res.data; // { items: [{ userId, lastReadAt }] }
}

export async function createGroupConversation({ title, participantIds = [], coverImageFileId = null }) {
  const res = await api.post("/api/conversations/group", {
    title,
    participantIds,
    coverImageFileId,
  });
  return res.data;
}


export async function updateGroupConversation(conversationId, { title, coverImageFileId = null }) {
  const res = await api.patch(`/api/conversations/${conversationId}/group`, { title, coverImageFileId });
  return res.data;
}

export async function inviteGroupMembers(conversationId, participantIds = []) {
  const res = await api.post(`/api/conversations/${conversationId}/members`, { participantIds });
  return res.data;
}

export async function removeGroupMember(conversationId, userId) {
  const res = await api.delete(`/api/conversations/${conversationId}/members/${userId}`);
  return res.data;
}

export async function fetchConversationMembers(conversationId) {
    const res = await api.get(`/api/conversations/${conversationId}/members`);
    return res.data; // { conversationId, items: [...] }
}

