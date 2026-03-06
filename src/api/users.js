// src/api/users.js
import api from "../lib/api";

export async function signUp({ email, handle, password, name }) {
  const res = await api.post("/api/users", { email, handle, password, name });
  return res.data;
}

export async function existsHandle(handle) {
  const res = await api.get("/api/users/exists", { params: { handle } });
  return !!res.data?.exists;
}

export async function searchUsers({ q, cursor = null, size = 20 } = {}) {
  const params = { q, size };
  if (cursor) params.cursor = cursor;

  const res = await api.get("/api/users/search", { params });
  const d = res.data || {};
  return {
    items: d.items || [],
    nextCursor: d.nextCursor ?? null,
    hasNext: !!d.hasNext,
  };
}

export async function fetchUserProfileByHandle(handle) {
  const res = await api.get(`/api/users/${encodeURIComponent(handle)}`);
  return res.data;
}

export async function fetchUserProfileById(userId) {
  const res = await api.get(`/api/users/id/${encodeURIComponent(userId)}`);
  return res.data;
}

export async function followUser(targetUserId) {
  await api.post(`/api/follows/${encodeURIComponent(targetUserId)}`);
}

export async function unfollowUser(targetUserId) {
  await api.delete(`/api/follows/${encodeURIComponent(targetUserId)}`);
}
