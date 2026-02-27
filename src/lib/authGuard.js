// src/lib/authGuard.js
import { useAuthStore } from "@/stores/auth";

/**
 * 로그인 세션이 있는지 확인
 * 없으면 로그인 페이지로 이동
 */
export async function ensureSessionOrRedirect(router) {
    const auth = useAuthStore();

    try {
        if (!auth.me) {
            await auth.ensureSession?.();
        }

        if (!auth.me) {
            router.replace("/login");
            return false;
        }

        return true;
    } catch (e) {
        router.replace("/login");
        return false;
    }
}