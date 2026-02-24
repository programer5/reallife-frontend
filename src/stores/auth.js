// src/stores/auth.js
import { defineStore } from "pinia";
import api from "@/lib/api";
import sse, { clearLastEventId } from "@/lib/sse";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    me: null,
    loading: false,
    error: "",
  }),

  getters: {
    isAuthed: (s) => !!s.me,
  },

  actions: {
    async loginCookie({ usernameOrEmail, password }) {
      this.loading = true;
      this.error = "";

      try {
        await api.post("/api/auth/login-cookie", {
          email: usernameOrEmail,
          password: password,
        });

        await this.ensureSession();
      } catch (e) {
        this.error = e?.response?.data?.message || "로그인에 실패했습니다.";
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async ensureSession() {
      try {
        const res = await api.get("/api/me");
        this.me = res.data;

        // ✅ /api/me 응답은 id가 핵심
        if (!this.me?.id) {
          console.warn("ensureSession: id is missing in /api/me response", this.me);
        }

        // ✅ 로그인 세션 확보 후 SSE 시작
        sse.start();
      } catch (e) {
        this.me = null;
        sse.stop();
        throw e;
      }
    },

    async logoutCookie() {
      try {
        await api.post("/api/auth/logout-cookie");
      } catch {
        // ignore
      } finally {
        this.me = null;
        sse.stop({ clearLastEvent: true });
        clearLastEventId();
      }
    },
  },
});