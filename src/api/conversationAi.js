// src/api/conversationAi.js
import api from "../lib/api";

export async function suggestConversationReplies({ conversationId, messageId = null, text = "" }) {
  const res = await api.post("/api/ai/reply", {
    conversationId,
    messageId,
    text,
  });
  return res.data || { replies: [], actions: [] };
}

export async function executeConversationAiAction({ conversationId, messageId = null, type, text = "", payload = {} }) {
  const res = await api.post("/api/ai/actions/execute", {
    conversationId,
    messageId,
    type,
    text,
    payload,
  });
  return res.data;
}
