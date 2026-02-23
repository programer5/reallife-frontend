// src/api/likes.js
import api from "../lib/api";

/**
 * Backend spec:
 * - POST   /api/posts/{postId}/likes  -> 204
 * - DELETE /api/posts/{postId}/likes  -> 204
 */
export async function likePost(postId) {
    await api.post(`/api/posts/${postId}/likes`);
}

export async function unlikePost(postId) {
    await api.delete(`/api/posts/${postId}/likes`);
}