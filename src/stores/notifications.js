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

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    nextCursor: null,
    hasNext: false,
    hasUnread: false,

    loading: false,       // 최초/새로고침 로딩
    loadingMore: false,   // 추가 로딩
    error: "",

    _refreshTimer: null,

    // ✅ SSE 중복 방지(가끔 같은 noti가 여러 번 올 수 있음)
    _seenIds: new Set(),
  }),

  actions: {
    /**
     * ✅ SSE 알림 즉시 prepend + 이후 refresh()로 보정
     */
    ingestFromSse(raw) {
      const n = normalizeNoti(raw);
      if (!n) return;

      if (this._seenIds.has(n.id) || (this.items || []).some((x) => x.id === n.id)) return;

      this._seenIds.add(n.id);
      if (this._seenIds.size > 300) {
        this._seenIds = new Set((this.items || []).slice(0, 100).map((x) => x.id));
        this._seenIds.add(n.id);
      }

      this.hasUnread = true;
      this.items = [n, ...(this.items || [])].slice(0, 200); // ✅ 리스트는 너무 커지지 않게
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
        this.hasUnread = !!res.hasUnread;

        this._seenIds = new Set((this.items || []).slice(0, 150).map((x) => x.id));
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 불러오지 못했습니다.";
      } finally {
        this.loading = false;
      }
    },

    /**
     * ✅ 커서 기반 추가 로드 (무한 스크롤 / 더보기 버튼용)
     */
    async loadMore({ size = 20 } = {}) {
      if (this.loadingMore || this.loading) return;
      if (!this.hasNext) return;

      this.loadingMore = true;
      this.error = "";

      try {
        const res = await fetchNotifications({ size, cursor: this.nextCursor });

        // ✅ append + dedupe
        this.items = uniqAppend(this.items, res.items).slice(0, 400);

        this.nextCursor = res.nextCursor;
        this.hasNext = res.hasNext;
        this.hasUnread = !!res.hasUnread;

        // seen 동기화
        this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id));
      } catch (e) {
        this.error = e?.response?.data?.message || "알림을 더 불러오지 못했습니다.";
      } finally {
        this.loadingMore = false;
      }
    },
    // ✅ 읽은 알림을 로컬 리스트에서 즉시 제거 (Optimistic UI)
    purgeReadLocal() {
      const before = (this.items || []).length;
      const next = (this.items || []).filter((n) => !n.read);

      this.items = next;
      this.hasUnread = next.some((n) => !n.read);

      // seen 동기화 (삭제된 id는 seen에서 없어도 됨. refresh가 다시 맞춰줌)
      this._seenIds = new Set((this.items || []).slice(0, 200).map((x) => x.id));

      return before - next.length; // 제거된 개수
    },
  },
});