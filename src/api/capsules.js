import api from "../lib/api";

export async function createCapsule(payload) {
  const clean = Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const res = await api.post("/api/capsules", null, { params: clean });
  return res.data;
}

export async function openCapsule(id) {
  return api.post(`/api/capsules/${id}/open`);
}

export async function deleteCapsule(id) {
  return api.delete(`/api/capsules/${id}`);
}

export async function fetchConversationCapsules(conversationId) {
  const res = await api.get(`/api/conversations/${conversationId}/capsules`);
  return res.data || { conversationId, items: [] };
}
