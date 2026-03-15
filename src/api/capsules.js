import api from "../lib/api";

export async function createCapsule(payload) {
  const res = await api.post("/api/capsules", payload);
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
