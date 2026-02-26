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