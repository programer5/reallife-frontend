// src/stores/notifications.js
import { defineStore } from "pinia";
import { fetchNotifications } from "../api/notifications";

function normalizeNoti(payload) {
  if (!payload) return null;
  // SSE payload: { notificationId, body, createdAt, type, refId }
  // API payload: { id, body, createdAt, type, refId, read }
  const id = payload.id || payload.notificationId;
  if (!id) return null;

  return {
    id,
    type: payload.type || "UNKNOWN",
    refId: payload.refId || null,
    body: payload.body || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    read: typeof payload.read === "boolean" ? payload.read : false,
  };
}

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    nextCursor: null,
    hasNext: false,
    hasUnread: false,
    loading: false,
    error: "",
    _refreshTimer: null,

    // ✅ SSE 중복 방지(가끔 같은 noti가 여러 번 올 수 있음)
    _seenIds: new Set(),
  }),

  actions: {
    /**
     * ✅ 고급 실시간 UX:
     * SSE로 받은 알림을 API 재조회 없이 즉시 UI에 prepend
     * 그리고 refresh()로 400ms 뒤에 보정
     */
    ingestFromSse(raw) {
      const n = normalizeNoti(raw);
      if (!n) return;

      // 중복 방지 (이미 목록에 있거나 최근 seen이면 skip)
      if (this._seenIds.has(n.id) || this.items.some((x) => x.id === n.id)) return;

      this._seenIds.add(n.id);
      // seen set이 무한히 커지지 않게 정리
      if (this._seenIds.size > 300) {
        // 간단히: set을 초기화하고 현재 items로 다시 채움
        this._seenIds = new Set(this.items.slice(0, 100).map((x) => x.id));
        this._seenIds.add(n.id);
      }

      // ✅ unread 즉시 반영
      this.hasUnread = true;

      // ✅ 최상단 prepend
      this.items = [n, ...(this.items || [])].slice(0, 50);
    },

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
        this.items = res.items || [];
        this.nextCursor = res.nextCursor;
        this.hasNext = res.hasNext;
        this.hasUnread = !!res.hasUnread;

        // seen set도 동기화 (중복 방지 정확도 ↑)
        this._seenIds = new Set((this.items || []).slice(0, 100).map((x) => x.id));
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 불러오지 못했습니다.";
      } finally {
        this.loading = false;
      }
    },
  },
});