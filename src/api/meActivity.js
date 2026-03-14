
import api from "../lib/api";

export async function fetchMyActions() {
  const res = await api.get("/api/me/activity/actions");
  return res.data || { items: [] };
}

export async function fetchMyCapsules() {
  const res = await api.get("/api/me/activity/capsules");
  return res.data || { items: [] };
}

export async function fetchMyShares() {
  const res = await api.get("/api/me/activity/shares");
  return res.data || { items: [] };
}
