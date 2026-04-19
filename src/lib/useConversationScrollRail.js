import { ref } from "vue";

function parseTime(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : null;
}

export function useConversationScrollRail({ nextTick }) {
  const scrollerRef = ref(null);
  const unreadDividerMid = ref(null);
  const newMsgCount = ref(0);

  function getScrollerEl() {
    return scrollerRef.value?.getElement?.() || scrollerRef.value?.$el || scrollerRef.value || null;
  }

  function getScrollAnchor(el) {
    const nodes = el?.querySelectorAll?.("[data-mid]") || [];
    if (!nodes.length) return null;

    const top = el.getBoundingClientRect().top;
    let best = null;
    let bestDist = Infinity;

    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const dist = Math.abs(r.top - top);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }

    if (!best) return null;
    return { mid: best.getAttribute("data-mid"), topOffset: best.getBoundingClientRect().top - top };
  }

  function restoreScrollAnchor(el, anchor) {
    if (!anchor?.mid) return;
    const node = el?.querySelector?.(`[data-mid="${CSS.escape(anchor.mid)}"]`);
    if (!node) return;

    const top = el.getBoundingClientRect().top;
    const nowOffset = node.getBoundingClientRect().top - top;
    el.scrollTop += nowOffset - anchor.topOffset;
  }

  function scrollToBottom({ smooth = false } = {}) {
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = getScrollerEl();
          if (!el) return;

          if (smooth) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          } else {
            el.scrollTop = el.scrollHeight;
          }
        });
      });
    });
  }

  function isNearBottom() {
    const el = getScrollerEl();
    if (!el) return true;
    return el.scrollHeight - (el.scrollTop + el.clientHeight) < 160;
  }

  function computeUnreadDividerMid(items, lastReadAt) {
    if (!lastReadAt) return null;
    const base = parseTime(lastReadAt);
    if (base == null) return null;

    for (const m of items || []) {
      const ct = parseTime(m?.createdAt);
      if (ct != null && ct > base) return String(m.messageId);
    }
    return null;
  }

  async function jumpToFirstUnread({ items, hasNext, loading, loadMore, lastReadAt }) {
    const base = parseTime(lastReadAt);
    if (!base) {
      unreadDividerMid.value = null;
      scrollToBottom({ smooth: false });
      return;
    }

    const hasAnyReadInLoaded = () =>
      (items?.value || []).some((m) => {
        const ct = parseTime(m?.createdAt);
        return ct != null && ct <= base;
      });

    let guard = 0;
    while (!hasAnyReadInLoaded() && hasNext?.value && !loading?.value && guard < 10) {
      guard += 1;
      await loadMore?.();
      await nextTick();
    }

    const mid = computeUnreadDividerMid(items?.value || [], lastReadAt);
    unreadDividerMid.value = mid;

    await nextTick();

    if (mid) {
      const el = getScrollerEl()?.querySelector?.(`[data-mid="${mid}"]`);
      el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    } else {
      scrollToBottom({ smooth: false });
    }
  }

  return {
    scrollerRef,
    unreadDividerMid,
    newMsgCount,
    getScrollerEl,
    getScrollAnchor,
    restoreScrollAnchor,
    scrollToBottom,
    isNearBottom,
    computeUnreadDividerMid,
    jumpToFirstUnread,
  };
}
