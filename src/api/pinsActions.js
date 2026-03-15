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

export async function pinUpdate(pinId, { title, placeText, startAt, remindMinutes } = {}) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (placeText !== undefined) body.placeText = placeText;
  if (startAt !== undefined) body.startAt = startAt;
  if (remindMinutes !== undefined) body.remindMinutes = remindMinutes;
  await api.patch(`/api/pins/${pinId}`, body);
}

export async function pinDelete(pinId) {
  await api.delete(`/api/pins/${pinId}`);
}

export async function getPin(pinId) {
  const res = await api.get(`/api/pins/${pinId}`);
  return res.data;
}
