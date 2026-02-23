// src/api/files.js
import api from "../lib/api";

/**
 * Backend spec (confirmed):
 * - POST /api/files (multipart/form-data)
 * - field name: "file" (single)
 * - response: { fileId, url, thumbnailUrl, ... }
 */
const UPLOAD_ENDPOINT = "/api/files";
const FORM_FIELD_NAME = "file";

function normalizeOne(data) {
    // response: { fileId: "uuid", url, thumbnailUrl, ... }
    if (!data) return null;
    if (typeof data.fileId === "string") return data.fileId;
    if (typeof data.id === "string") return data.id;
    if (typeof data === "string") return data;
    return null;
}

/**
 * 여러 장 업로드 지원:
 * - 백엔드는 단일 file만 받으므로
 * - 파일을 1개씩 업로드해서 fileId 배열로 반환
 */
export async function uploadImages(files, { onProgress } = {}) {
    const arr = Array.from(files || []);
    const ids = [];

    for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        const form = new FormData();
        form.append(FORM_FIELD_NAME, f);

        const res = await api.post(UPLOAD_ENDPOINT, form, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (evt) => {
                if (!onProgress) return;

                // 전체 진행률(대략): (현재 파일 진행 + 이전 파일들 완료) / 전체 파일 수
                const total = evt.total || 0;
                const loaded = evt.loaded || 0;
                const onePct = total > 0 ? loaded / total : 0;
                const overall = Math.round(((i + onePct) / arr.length) * 100);
                onProgress(overall);
            },
        });

        const id = normalizeOne(res.data);
        if (id) ids.push(id);
    }

    return ids;
}