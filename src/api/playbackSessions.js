import api from "../lib/api";

export async function fetchPlaybackSessions(conversationId) {
  const res = await api.get(`/api/conversations/${conversationId}/playback-sessions`);
  const d = res.data || {};
  return Array.isArray(d.items) ? d.items : [];
}

export async function createPlaybackSession(conversationId, payload) {
  const res = await api.post(`/api/conversations/${conversationId}/playback-sessions`, payload);
  return res.data;
}

export async function updatePlaybackSessionState(conversationId, sessionId, payload) {
  const res = await api.patch(`/api/conversations/${conversationId}/playback-sessions/${sessionId}/state`, payload);
  return res.data;
}

export async function endPlaybackSession(conversationId, sessionId, payload = {}) {
  const res = await api.post(`/api/conversations/${conversationId}/playback-sessions/${sessionId}/end`, payload);
  return res.data;
}
