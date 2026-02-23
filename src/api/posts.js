// src/api/posts.js
import api from "../lib/api";

/**
 * Backend spec (confirmed):
 * - GET /api/feed?size=...&cursor=...
 *   -> { items: [...], nextCursor: string|null, hasNext: boolean }
 *
 * - POST /api/posts
 *   -> { postId, ... } (shape may vary)
 */

export async function fetchFeed({ size = 10, cursor = null } = {}) {
    const params = { size };
    if (cursor) params.cursor = cursor;

    const res = await api.get("/api/feed", { params });
    const data = res.data || {};

    return {
        items: data.items || [],
        nextCursor: data.nextCursor ?? null,
        hasNext: !!data.hasNext,
    };
}

export async function createPost({ content, visibility = "ALL", imageFileIds = [], imageUrls = [] }) {
    const body = {
        content: content ?? "",
        visibility,
        imageFileIds,
        imageUrls,
    };

    const res = await api.post("/api/posts", body);
    return res.data;
}

export async function fetchPostDetail(postId) {
    const res = await api.get(`/api/posts/${postId}`);
    return res.data;
}

export async function deletePost(postId) {
    await api.delete(`/api/posts/${postId}`);
}