import { defineStore } from "pinia";
import api from "@/lib/api.js";

/**
 * ✅ 쿠키 기반 인증 Store
 * - ensureSession(): /api/me로 로그인 확인
 * - login(): /api/auth/login-cookie
 * - logout(): /api/auth/logout-cookie
 * - logoutAll(): 호환용 별칭
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
        return this.isAuthed;
      } catch {
        this.user = null;
        this.isAuthed = false;
        return false;
      } finally {
        this.loading = false;
      }
    },

    async login(email, password) {
      this.loading = true;
      try {
        await api.post("/api/auth/login-cookie", { email, password });
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