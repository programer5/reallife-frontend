import api from "../lib/api";


export async function createCapsule(payload){
  const res = await api.post("/api/capsules", payload);
  return res.data;
}

export async function openCapsule(id){
  return api.post(`/api/capsules/${id}/open`);
}


export async function fetchConversationCapsules(conversationId){
  const res = await api.get(`/api/conversations/${conversationId}/capsules`);
  return res.data || { conversationId, items: [] };
}
