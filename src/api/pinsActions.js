// src/api/pinsActions.js
import api from "../lib/api";

export async function pinDone(pinId) {
    await api.post(`/api/pins/${pinId}/done`);
}

export async function pinCancel(pinId) {
    await api.post(`/api/pins/${pinId}/cancel`);
}

export async function pinDismiss(pinId) {
    await api.post(`/api/pins/${pinId}/dismiss`);
}

/**
 * PATCH /api/pins/{pinId}
 * backend: { title?, placeText?, startAt? }
 * - 보내지 않은 필드는 서버가 기존값 유지(부분 업데이트)
 */
export async function pinUpdate(pinId, { title, placeText, startAt } = {}) {
    const body = {};

    // undefined만 빼고 전송 (null은 의도적으로 비우는 값으로 전송 가능)
    if (title !== undefined) body.title = title;
    if (placeText !== undefined) body.placeText = placeText;
    if (startAt !== undefined) body.startAt = startAt;

    await api.patch(`/api/pins/${pinId}`, body);
}

export async function getPin(pinId) {
    const res = await api.get(`/api/pins/${pinId}`);
    return res.data;
}