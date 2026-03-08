import api from "../lib/api";

export async function fetchMe() {
  const res = await api.get("/api/me");
  return res.data;
}

export async function updateProfile(payload) {
  const res = await api.patch("/api/me/profile", payload);
  return res.data;
}

/**
 * 현재 프로젝트에서는 프로필 사진 업로드를
 * /api/files 쪽 uploadImages() 흐름으로 쓰고 있어서
 * 여기 직접 업로드 API는 사용하지 않음.
 * 남겨두되 실수 호출 방지를 위해 명시적으로 막아둠.
 */
export async function uploadAvatar() {
  throw new Error("uploadAvatar is not used. Use uploadImages() from '@/api/files' instead.");
}

/**
 * 레거시 호출 호환용 alias
 */
export { fetchMe as getMe };
export { updateProfile as updateMyProfile };