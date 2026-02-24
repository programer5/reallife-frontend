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

    // src/stores/auth.js (ensureSession만 교체)
    async ensureSession() {
      try {
        // ✅ 백엔드 기준: /api/me
        const res = await api.get("/api/me");
        this.me = res.data;

        // ✅ 안전장치: userId가 없으면 null로 처리
        if (!this.me?.userId) {
          console.warn("ensureSession: userId is missing in /api/me response", this.me);
        }

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