import { defineStore } from "pinia";
import api from "@/lib/api.js";
import { startSse, stopSse } from "@/lib/sse";

/**
 * ✅ 쿠키 기반 인증 Store
 * - ensureSession(): /api/me로 로그인 확인
 * - login(): /api/auth/login-cookie
 * - logout(): /api/auth/logout-cookie
 * - logoutAll(): 호환용 별칭
 *
 * ✅ SSE 연동(추천 방식)
 * - 로그인 세션 확인 성공 시: SSE 연결 시작(startSse)
 * - 세션 없음/만료 시: SSE 연결 종료(stopSse)
 * - 로그아웃 시: SSE 종료 + Last-Event-ID 제거(clearLastEvent: true)
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    isAuthed: false,
    loading: false,
  }),

  actions: {
    async ensureSession() {
      this.loading = true;
      try {
        const res = await api.get("/api/me");
        this.user = res?.data ?? null;
        this.isAuthed = !!this.user;

        // ✅ 세션이 유효하면 SSE 시작 (중복 연결은 sse manager가 방지)
        if (this.isAuthed) {
          startSse();
        } else {
          // 세션이 없다면 SSE 중단(Last-Event-ID는 지우지 않음)
          stopSse({ clearLastEvent: false });
        }

        return this.isAuthed;
      } catch {
        this.user = null;
        this.isAuthed = false;

        // ✅ 세션 확인 실패 시 SSE 중단(로그아웃은 아니므로 Last-Event-ID 유지)
        stopSse({ clearLastEvent: false });

        return false;
      } finally {
        this.loading = false;
      }
    },

    async login(email, password) {
      this.loading = true;
      try {
        await api.post("/api/auth/login-cookie", { email, password });

        // ensureSession 내부에서 startSse 처리됨
        await this.ensureSession();
        return true;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      this.loading = true;
      try {
        await api.post("/api/auth/logout-cookie");
      } catch (e) {
        console.warn("logout failed:", e);
      } finally {
        // ✅ 로그아웃은 명확히 세션 종료이므로 Last-Event-ID도 제거
        stopSse({ clearLastEvent: true });

        this.user = null;
        this.isAuthed = false;
        this.loading = false;
      }
    },

    // ✅ 호환용 (MeView가 logoutAll을 부르는 경우)
    async logoutAll() {
      return this.logout();
    },
  },
});