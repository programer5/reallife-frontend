// src/api/users.js
import api from "../lib/api";

/**
 * GET /api/users/search?q=...&cursor=...&size=...
 * 응답: { items, nextCursor, hasNext }
 */
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