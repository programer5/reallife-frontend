import api from "../lib/api";

export async function fetchTodayWidget() {
  const res = await api.get("/api/home/today-widget");
  return res.data || { summary: { total: 0, upcoming: 0, done: 0 }, items: [] };
}

export async function fetchReminderSummary(params = {}) {
  const res = await api.get("/api/home/reminder-summary", { params });
  return res.data || {
    summary: { unreadCount: 0, unreadReminderCount: 0, todayReminderCount: 0 },
    settings: { browserNotifyEnabled: false, settingsSource: "CLIENT_SYNC" },
    lead: null,
  };
}

