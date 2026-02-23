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
        // 🔥 백엔드 DTO에 맞춰 email 필드로 보낸다
        await api.post("/api/auth/login-cookie", {
          email: usernameOrEmail,
          password: password,
        });

        await this.ensureSession();
      } catch (e) {
        this.error =
            e?.response?.data?.message ||
            "로그인에 실패했습니다.";
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async ensureSession() {
      try {
        const res = await api.get("/api/me");
        this.me = res.data;
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