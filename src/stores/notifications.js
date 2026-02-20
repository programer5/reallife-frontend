import { defineStore } from "pinia";
import api from "@/lib/api.js";

export const useNotificationStore = defineStore("notifications", {
  state: () => ({
    hasUnread: false,
    lastCheckedAt: null,
  }),

  actions: {
    setHasUnread(v) {
      this.hasUnread = !!v;
    },

    async refreshHasUnread() {
      try {
        // API 응답: { items, nextCursor, hasNext, hasUnread }
        const res = await api.get("/api/notifications");
        const hasUnread = !!(res?.data?.hasUnread);
        this.hasUnread = hasUnread;
        this.lastCheckedAt = Date.now();
        return hasUnread;
      } catch (e) {
        // 네트워크/세션 문제일 수 있으니 조용히 실패 처리
        return this.hasUnread;
      }
    },

    reset() {
      this.hasUnread = false;
      this.lastCheckedAt = null;
    },
  },
});
