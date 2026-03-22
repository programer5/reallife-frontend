function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const next = String(value).trim();
    if (next) return next;
  }
  return "";
}

export function pickMediaUrl(raw) {
  if (!raw) return "";
  return firstNonEmpty(raw.previewUrl, raw.streamingUrl, raw.url, raw.downloadUrl, raw.src);
}

export function detectMediaKind(raw) {
  const explicit = String(raw?.kind || raw?.mediaType || raw?.type || "").toLowerCase();
  if (["image", "video", "file"].includes(explicit)) return explicit;

  const mediaType = String(raw?.mediaType || "").toUpperCase();
  if (mediaType === "IMAGE") return "image";
  if (mediaType === "VIDEO") return "video";
  if (mediaType === "FILE") return "file";

  const contentType = String(raw?.contentType || raw?.type || "").toLowerCase();
  const name = String(raw?.originalName || raw?.originalFilename || raw?.name || "").toLowerCase();
  const url = String(pickMediaUrl(raw)).toLowerCase();

  if (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(name) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(url)
  ) return "image";

  if (
    contentType.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v|avi|ogg)(\?|$)/.test(name) ||
    /\.(mp4|webm|mov|m4v|avi|ogg)(\?|$)/.test(url)
  ) return "video";

  return "file";
}

export function normalizeMediaItem(raw, idx = 0) {
  const kind = detectMediaKind(raw);
  const mediaType = String(raw?.mediaType || kind).toUpperCase();
  const downloadUrl = firstNonEmpty(raw?.downloadUrl, raw?.url, raw?.src, raw?.previewUrl, raw?.streamingUrl);
  const previewUrl = firstNonEmpty(raw?.previewUrl, kind === "video" ? raw?.streamingUrl : "", raw?.url, raw?.downloadUrl, raw?.src);
  const streamingUrl = firstNonEmpty(raw?.streamingUrl, kind === "video" ? previewUrl : "");
  const url = firstNonEmpty(kind === "video" ? streamingUrl : previewUrl, downloadUrl);
  const thumbnailUrl = firstNonEmpty(raw?.thumbnailUrl, raw?.thumb, kind === "image" ? url : "");
  const fallbackName = `미디어 ${idx + 1}`;

  return {
    idx,
    id: raw?.fileId || raw?.attachmentId || raw?.id || `${kind}-${idx}`,
    kind,
    mediaType,
    url,
    src: url,
    previewUrl: previewUrl || url,
    thumbnailUrl,
    streamingUrl,
    downloadUrl: downloadUrl || url,
    name: raw?.name || raw?.originalFilename || raw?.originalName || fallbackName,
    originalFilename: raw?.originalFilename || raw?.originalName || raw?.name || fallbackName,
    contentType: raw?.contentType || raw?.type || (kind === "video" ? "video/mp4" : kind === "image" ? "image/*" : "application/octet-stream"),
    size: Number(raw?.size || 0),
    original: raw || null,
  };
}

export function normalizeMediaItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, idx) => normalizeMediaItem(item, idx))
    .filter((item) => !!item.url || item.kind === "file");
}

export function normalizeUploadedFileResponse(raw, idx = 0) {
  const item = normalizeMediaItem({
    ...raw,
    id: raw?.fileId || raw?.id,
    fileId: raw?.fileId || raw?.id,
    downloadUrl: raw?.downloadUrl || raw?.url,
    previewUrl: raw?.previewUrl || raw?.url,
    streamingUrl: raw?.streamingUrl,
    mediaType: raw?.mediaType || raw?.fileType,
  }, idx);

  return {
    ...item,
    fileId: raw?.fileId || raw?.id || item.id,
    fileType: raw?.fileType || item.mediaType,
  };
}

export function normalizeUploadedFileResponses(items) {
  return (Array.isArray(items) ? items : []).map((item, idx) => normalizeUploadedFileResponse(item, idx));
}

export function normalizeMessageAttachments(items) {
  return normalizeMediaItems(items);
}

export function normalizePostMediaItems(items) {
  return normalizeMediaItems(items);
}
