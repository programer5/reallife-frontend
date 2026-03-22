import api from "@/lib/api";

export async function unifiedSearch({ q, type = "ALL", conversationId = null, limit = 6 } = {}) {
  const params = { q, type, limit };
  if (conversationId) params.conversationId = conversationId;
  const res = await api.get('/api/search', { params });
  return res.data || { items: [], sections: [], meta: {} };
}
