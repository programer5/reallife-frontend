// src/api/me.js
import api from "@/lib/api";

export async function fetchMe() {
  const res = await api.get("/api/me");
  return res.data;
}

export async function updateMyProfile(payload = {}) {
  const res = await api.patch("/api/me/profile", payload);
  return res.data;
}
