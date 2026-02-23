// src/api/notifications.js
import api from "../lib/api";

export async function fetchNotifications({ size = 20, cursor = null } = {}) {
    const params = { size };
    if (cursor) params.cursor = cursor;

    const res = await api.get("/api/notifications", { params });
    const d = res.data || {};
    return {
        items: d.items || [],
        nextCursor: d.nextCursor ?? null,
        hasNext: !!d.hasNext,
        hasUnread: !!d.hasUnread,
    };
}

export async function readNotification(id) {
    await api.post(`/api/notifications/${id}/read`);
}

export async function readAllNotifications() {
    const res = await api.post("/api/notifications/read-all");
    return res.data; // { updatedCount }
}

export async function clearReadNotifications() {
    const res = await api.delete("/api/notifications/read");
    return res.data; // { deletedCount }
}