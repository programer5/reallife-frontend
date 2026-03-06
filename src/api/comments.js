// src/api/comments.js
import api from "../lib/api";

export async function fetchComments({ postId, size = 10, cursor = null, sort = "LATEST" }) {
  const params = { size, sort };
  if (cursor) params.cursor = cursor;
  const res = await api.get(`/api/posts/${postId}/comments`, { params });
  const data = res.data || {};
  return {
    items: data.items || [],
    nextCursor: data.nextCursor ?? null,
    hasNext: !!data.hasNext,
  };
}

export async function createComment({ postId, content, parentCommentId = null }) {
  const body = { content };
  if (parentCommentId) body.parentCommentId = parentCommentId;
  const res = await api.post(`/api/posts/${postId}/comments`, body);
  return res.data;
}

export async function deleteComment(commentId) {
  await api.delete(`/api/comments/${commentId}`);
}

export async function likeComment(commentId) {
  await api.post(`/api/comments/${commentId}/likes`);
}

export async function unlikeComment(commentId) {
  await api.delete(`/api/comments/${commentId}/likes`);
}
