// src/api/me.js
import api from "@/lib/api.js";

export async function getMe() {
  const res = await api.get("/api/me");
  return res.data;
}

export async function getMyProfile(handle) {
  const res = await api.get(`/api/users/${encodeURIComponent(handle)}`);
  return res.data;
}

export async function updateMyProfile(payload) {
  const res = await api.patch("/api/me/profile", payload);
  return res.data;
}
