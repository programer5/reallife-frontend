import api from "../lib/api";

export async function createCapsule({ messageId, conversationId, title, unlockAt, userId }) {
  const params = new URLSearchParams();
  params.set("messageId", messageId);
  params.set("conversationId", conversationId);
  params.set("title", title || "");
  params.set("unlockAt", String(unlockAt || "").replace("Z",""));
  params.set("userId", userId);
  const res = await api.post(`/api/capsules?${params.toString()}`);
  return res.data;
}

export async function openCapsule(capsuleId) {
  const res = await api.post(`/api/capsules/${capsuleId}/open`);
  return res.data;
}

export async function fetchConversationCapsules(conversationId) {
  const res = await api.get(`/api/conversations/${conversationId}/capsules`);
  return res.data || { conversationId, items: [] };
}
