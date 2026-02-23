// src/api/comments.js
import api from "../lib/api";

/**
 * Backend spec:
 * - POST /api/posts/{postId}/comments { content } -> 201 + comment
 * - GET  /api/posts/{postId}/comments?size=&cursor= -> { items, nextCursor, hasNext }
 * - DELETE /api/comments/{commentId} -> 204
 */

export async function fetchComments({ postId, size = 10, cursor = null }) {
    const params = { size };
    if (cursor) params.cursor = cursor;

    const res = await api.get(`/api/posts/${postId}/comments`, { params });
    const data = res.data || {};
    return {
        items: data.items || [],
        nextCursor: data.nextCursor ?? null,
        hasNext: !!data.hasNext,
    };
}

export async function createComment({ postId, content }) {
    const res = await api.post(`/api/posts/${postId}/comments`, { content });
    return res.data;
}

export async function deleteComment(commentId) {
    await api.delete(`/api/comments/${commentId}`);
}