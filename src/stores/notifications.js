// src/stores/notifications.js
import { defineStore } from "pinia";
import { fetchNotifications } from "../api/notifications";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    nextCursor: null,
    hasNext: false,
    hasUnread: false,
    loading: false,
    error: "",
    _refreshTimer: null,
  }),

  actions: {
    async refresh() {
      // ✅ SSE가 연속으로 올 수 있으니 400ms 디바운스(트래픽/UX)
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this._refreshNow(), 400);
    },

    async _refreshNow() {
      this.loading = true;
      this.error = "";
      try {
        const res = await fetchNotifications({ size: 20 });
        this.items = res.items;
        this.nextCursor = res.nextCursor;
        this.hasNext = res.hasNext;
        this.hasUnread = res.hasUnread;
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 불러오지 못했습니다.";
      } finally {
        this.loading = false;
      }
    },
  },
});