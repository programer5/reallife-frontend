// src/stores/notifications.js
import { defineStore } from "pinia";
import { fetchNotifications } from "../api/notifications";

function normalizeNoti(payload) {
  if (!payload) return null;
  const id = payload.id || payload.notificationId;
  if (!id) return null;

  const ref2Id = payload.ref2Id || payload.messageId || payload.postId || null;

  return {
    id,
    type: payload.type || "UNKNOWN",
    refId: payload.refId || null,
    ref2Id,
    conversationId: payload.conversationId || null,
    messageId: payload.messageId || (payload.type === "MESSAGE_RECEIVED" ? ref2Id : null),
    postId: payload.postId || (payload.type === "POST_COMMENT" ? ref2Id : null),
    body: payload.body || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    read: typeof payload.read === "boolean" ? payload.read : false,
  };
}

function uniqAppend(existing, incoming) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(out.map((x) => x?.id).filter(Boolean));

  for (const raw of incoming || []) {
    const n = normalizeNoti(raw);
    if (!n) continue;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

function countUnread(items) {
  return (items || []).reduce((sum, item) => sum + (item?.read ? 0 : 1), 0);
}

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    nextCursor: null,
    hasNext: false,
    hasUnread: false,
    unreadCount: 0,

    loading: false,
    loadingMore: false,
    error: "",

    _refreshTimer: null,
    _seenIds: new Set(),
  }),

  actions: {
    _syncUnreadMeta() {
      const unread = countUnread(this.items);
      this.unreadCount = unread;
      this.hasUnread = unread > 0;
    },

    ingestFromSse(raw) {
      const n = normalizeNoti(raw);
      if (!n) return;

      if (this._seenIds.has(n.id) || (this.items || []).some((x) => x.id === n.id)) return;

      this._seenIds.add(n.id);
      if (this._seenIds.size > 300) {
        this._seenIds = new Set((this.items || []).slice(0, 100).map((x) => x.id));
        this._seenIds.add(n.id);
      }

      this.items = [n, ...(this.items || [])].slice(0, 200);
      this._syncUnreadMeta();
    },

    async refresh() {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this._refreshNow(), 400);
    },

    async _refreshNow() {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        const res = await fetchNotifications({ size: 20 });

        this.items = (res.items || []).map(normalizeNoti).filter(Boolean);
        this.nextCursor = res.nextCursor;
        this.hasNext = res.hasNext;
        this._syncUnreadMeta();
        if (res.hasUnread && this.unreadCount === 0) {
          this.hasUnread = true;
        }

        this._seenIds = new Set((this.items || []).slice(0, 150).map((x) => x.id));
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 불러오지 못했습니다.";
      } finally {
        this.loading = false;
      }
    },

    async loadMore({ size = 20 } = {}) {
      if (this.loadingMore || this.loading) return;
      if (!this.hasNext) return;

      this.loadingMore = true;
      this.error = "";

      try {
        const res = await fetchNotifications({ size, cursor: this.nextCursor });
        this.items = uniqAppend(this.items, res.items).slice(0, 400);
        this.nextCursor = res.nextCursor;
        this.hasNext = res.hasNext;
        this._syncUnreadMeta();
        if (res.hasUnread && this.unreadCount === 0) {
          this.hasUnread = true;
        }
        this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id));
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 더 불러오지 못했습니다.";
      } finally {
        this.loadingMore = false;
      }
    },

    markLocalRead(id) {
      const idx = (this.items || []).findIndex((n) => String(n.id) === String(id));
      if (idx < 0) return false;
      if (this.items[idx]?.read) return false;

      const copy = this.items.slice();
      copy[idx] = { ...copy[idx], read: true };
      this.items = copy;
      this._syncUnreadMeta();
      return true;
    },

    markAllLocalRead() {
      this.items = (this.items || []).map((n) => ({ ...n, read: true }));
      this._syncUnreadMeta();
    },

    purgeReadLocal() {
      const before = (this.items || []).length;
      this.items = (this.items || []).filter((n) => !n.read);
      this._syncUnreadMeta();
      this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id));
      return before - this.items.length;
    },
  },
});
