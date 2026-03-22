import api from "../lib/api";
import { normalizeUploadedFileResponses } from "@/lib/mediaModel";

const UPLOAD_ENDPOINT = "/api/files";
const FORM_FIELD_NAME = "file";

function normalizeOne(data) {
  if (!data) return null;
  if (typeof data.fileId === "string") return data.fileId;
  if (typeof data.id === "string") return data.id;
  if (typeof data === "string") return data;
  return null;
}

export async function uploadFilesDetailed(files, { onProgress } = {}) {
  const arr = Array.from(files || []);
  const uploaded = [];

  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    const form = new FormData();
    form.append(FORM_FIELD_NAME, f);

    const res = await api.post(UPLOAD_ENDPOINT, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        const total = evt.total || 0;
        const loaded = evt.loaded || 0;
        const onePct = total > 0 ? loaded / total : 0;
        const overall = Math.round(((i + onePct) / Math.max(arr.length, 1)) * 100);
        onProgress(overall);
      },
    });

    uploaded.push(res.data || {});
  }

  return normalizeUploadedFileResponses(uploaded);
}

export async function uploadFiles(files, { onProgress } = {}) {
  const items = await uploadFilesDetailed(files, { onProgress });
  return items.map((item) => item.fileId || normalizeOne(item)).filter(Boolean);
}

export async function uploadImages(files, { onProgress } = {}) {
  return uploadFiles(files, { onProgress });
}
