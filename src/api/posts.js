import api from "../lib/api";

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

export async function fetchNearbyFeed({ lat, lng, size = 20 } = {}) {
  const res = await api.get("/api/feed/nearby", {
    params: { lat, lng, size },
  });
  const data = res.data || {};

  return {
    items: data.items || [],
    nextCursor: data.nextCursor ?? null,
    hasNext: !!data.hasNext,
  };
}

export async function createPost({ content, visibility = "ALL", imageFileIds = [], mediaFileIds = [], imageUrls = [], latitude = null, longitude = null, placeName = null }) {
  const body = { content: content ?? "", visibility, imageFileIds, mediaFileIds, imageUrls };
  if (latitude !== null && longitude !== null) {
    body.latitude = latitude;
    body.longitude = longitude;
  }
  if (placeName) body.placeName = placeName;
  const res = await api.post("/api/posts", body);
  return res.data;
}

export async function updatePost(postId, { content, visibility } = {}) {
  const body = {};
  if (content !== undefined) body.content = content;
  if (visibility !== undefined) body.visibility = visibility;
  const res = await api.patch(`/api/posts/${postId}`, body);
  return res.data;
}

export async function fetchPostDetail(postId) {
  const res = await api.get(`/api/posts/${postId}`);
  return res.data;
}

export async function deletePost(postId) {
  await api.delete(`/api/posts/${postId}`);
}
