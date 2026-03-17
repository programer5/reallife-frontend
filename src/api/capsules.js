import api from "../lib/api";

export async function createCapsule(payload = {}) {
  const params = {};
  if (payload.messageId !== undefined && payload.messageId !== null && payload.messageId !== "") params.messageId = payload.messageId;
  if (payload.conversationId !== undefined && payload.conversationId !== null && payload.conversationId !== "") params.conversationId = payload.conversationId;
  if (payload.title !== undefined && payload.title !== null) params.title = payload.title;
  if (payload.unlockAt !== undefined && payload.unlockAt !== null && payload.unlockAt !== "") params.unlockAt = payload.unlockAt;
  if (payload.userId !== undefined && payload.userId !== null && payload.userId !== "") params.userId = payload.userId;
  const res = await api.post("/api/capsules", null, { params });
  return res.data;
}

export async function openCapsule(id) {
  return api.post(`/api/capsules/${id}/open`);
}

export async function updateCapsule(id, { title, unlockAt } = {}) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (unlockAt !== undefined) body.unlockAt = unlockAt;
  await api.patch(`/api/capsules/${id}`, body);
}

export async function deleteCapsule(id) {
  await api.delete(`/api/capsules/${id}`);
}

export async function fetchConversationCapsules(conversationId) {
  const res = await api.get(`/api/conversations/${conversationId}/capsules`);
  return res.data || { conversationId, items: [] };
}
