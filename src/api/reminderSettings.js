import api from "../lib/api";

export async function fetchReminderSettings() {
  const res = await api.get("/api/me/reminder-settings");
  return res.data;
}

export async function updateReminderSettings(payload = {}) {
  const res = await api.patch("/api/me/reminder-settings", payload);
  return res.data;
}
