// src/stores/notifications.js
import { defineStore } from "pinia";
import { fetchNotifications } from "../api/notifications";
import { normalizeNotificationCategory, resolvePriorityScore, shouldUseBrowserNotification } from "@/lib/notificationPriority";

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
    postId: payload.postId || (["POST_COMMENT", "POST_LIKE"].includes(payload.type) ? ref2Id : null),
    body: payload.body || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    read: typeof payload.read === "boolean" ? payload.read : false,
    category: normalizeNotificationCategory(payload),
    priorityScore: resolvePriorityScore(payload),
    targetPath: payload.targetPath || null,
    targetLabel: payload.targetLabel || null,
    actionHint: payload.actionHint || "",
  };
}

function uniqAppend(existing, incoming) {
  const map = new Map();
  for (const raw of existing || []) {
    const n = normalizeNoti(raw) || raw;
    if (!n?.id) continue;
    map.set(String(n.id), n);
  }
  for (const raw of incoming || []) {
    const n = normalizeNoti(raw);
    if (!n?.id) continue;
    const key = String(n.id);
    map.set(key, { ...(map.get(key) || {}), ...n });
  }
  return [...map.values()].sort((a, b) => {
    const pb = Number(b?.priorityScore || 0);
    const pa = Number(a?.priorityScore || 0);
    if (pb !== pa) return pb - pa;
    return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''));
  });
}

function countUnread(items) {
  return (items || []).reduce((sum, item) => sum + (item?.read ? 0 : 1), 0);
}

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({ items: [], nextCursor: null, hasNext: false, hasUnread: false, unreadCount: 0, loading: false, loadingMore: false, error: "", _refreshTimer: null, _seenIds: new Set(), _browserShownIds: new Set(), }),
  actions: {
    _syncUnreadMeta() { const unread = countUnread(this.items); this.unreadCount = unread; this.hasUnread = unread > 0; },
    ingestFromSse(raw) {
      const n = normalizeNoti(raw); if (!n) return;
      if (this._seenIds.has(n.id) || (this.items || []).some((x) => x.id === n.id)) return;
      this._seenIds.add(n.id); if (this._seenIds.size > 300) { this._seenIds = new Set((this.items || []).slice(0, 100).map((x) => x.id)); this._seenIds.add(n.id); }
      this.items = [n, ...(this.items || [])].slice(0, 200); this._syncUnreadMeta();
    },
    async refresh() { if (this._refreshTimer) clearTimeout(this._refreshTimer); this._refreshTimer = setTimeout(() => this._refreshNow(), 400); },
    async softSync() {
      try {
        const res = await fetchNotifications({ size: 12 });
        const incoming = (res.items || []).map(normalizeNoti).filter(Boolean); if (!incoming.length) return;
        const locallyRead = new Set((this.items || []).filter((x) => x?.read).map((x) => String(x.id)));
        const merged = uniqAppend(this.items, incoming).map((item) => locallyRead.has(String(item.id)) ? { ...item, read: true } : item);
        this.items = merged.slice(0, 200); this.nextCursor = res.nextCursor; this.hasNext = res.hasNext; this._syncUnreadMeta(); this._seenIds = new Set((this.items || []).slice(0, 150).map((x) => x.id));
      } catch {}
    },
    async _refreshNow() {
      if (this.loading) return; this.loading = true; this.error = "";
      try {
        const res = await fetchNotifications({ size: 20 });
        const incoming = (res.items || []).map(normalizeNoti).filter(Boolean);
        const locallyRead = new Set((this.items || []).filter((x) => x?.read).map((x) => String(x.id)));
        this.items = incoming.map((item) => locallyRead.has(String(item.id)) ? { ...item, read: true } : item);
        this.nextCursor = res.nextCursor; this.hasNext = res.hasNext; this._syncUnreadMeta(); if (res.hasUnread && this.unreadCount === 0) this.hasUnread = true;
        this._seenIds = new Set((this.items || []).slice(0, 150).map((x) => x.id));
      } catch (e) { this.error = e?.response?.data?.message || "알림을 불러오지 못했습니다."; }
      finally { this.loading = false; }
    },
    async loadMore({ size = 20 } = {}) {
      if (this.loadingMore || this.loading || !this.hasNext) return; this.loadingMore = true; this.error = "";
      try {
        const res = await fetchNotifications({ size, cursor: this.nextCursor });
        this.items = uniqAppend(this.items, res.items).slice(0, 400); this.nextCursor = res.nextCursor; this.hasNext = res.hasNext; this._syncUnreadMeta(); if (res.hasUnread && this.unreadCount === 0) this.hasUnread = true; this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id));
      } catch (e) { this.error = e?.response?.data?.message || "알림을 더 불러오지 못했습니다."; }
      finally { this.loadingMore = false; }
    },

    pickBrowserCandidate(settings = {}) {
      const items = (this.items || [])
        .filter((item) => shouldUseBrowserNotification(item, settings))
        .filter((item) => !this._browserShownIds.has(String(item.id)))
        .sort((a, b) => {
          const pb = resolvePriorityScore(b);
          const pa = resolvePriorityScore(a);
          if (pb !== pa) return pb - pa;
          return String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""));
        });
      return items[0] || null;
    },
    markBrowserShown(id) {
      if (!id) return;
      this._browserShownIds.add(String(id));
      if (this._browserShownIds.size > 300) {
        this._browserShownIds = new Set([...this._browserShownIds].slice(-150));
      }
    },
    markLocalRead(id) {
      const idx = (this.items || []).findIndex((n) => String(n.id) === String(id)); if (idx < 0 || this.items[idx]?.read) return false;
      const copy = this.items.slice(); copy[idx] = { ...copy[idx], read: true }; this.items = copy; this._syncUnreadMeta(); return true;
    },
    markAllLocalRead() { this.items = (this.items || []).map((n) => ({ ...n, read: true })); this._syncUnreadMeta(); },
    purgeReadLocal() { const before = (this.items || []).length; this.items = (this.items || []).filter((n) => !n.read); this._syncUnreadMeta(); this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id)); return before - this.items.length; },
  },
});
