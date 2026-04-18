import { computed, ref } from "vue";

export function useConversationSearchFocus({
  route,
  router,
  conversationId,
  items,
  activeCount,
  capsuleItems,
  isMobileViewport,
  ensureMessageVisible,
  nextTick,
  dockMode,
  dockOpen,
}) {
  const conversationSearchQ = ref("");
  const searchRailExpanded = ref(false);
  const searchFocusTerm = ref("");
  const searchFocusMid = ref("");
  const searchFocusPinId = ref("");
  const searchFocusCapsuleId = ref("");

  const conversationSearchSummary = computed(() => {
    const parts = [];
    if (activeCount.value) parts.push(`액션 ${activeCount.value}`);
    if (capsuleItems.value?.length) parts.push(`캡슐 ${capsuleItems.value.length}`);
    if (items.value?.length) parts.push(`메시지 ${items.value.length}`);
    return parts.length ? parts.join(" · ") : "이 대화의 흐름을 빠르게 다시 찾을 수 있어요";
  });

  const hasSearchFocus = computed(() => Boolean(
    searchFocusTerm.value
      || searchFocusMid.value
      || searchFocusPinId.value
      || searchFocusCapsuleId.value,
  ));

  const searchFocusSummary = computed(() => {
    const parts = [];
    if (searchFocusMid.value) parts.push("메시지");
    if (searchFocusPinId.value) parts.push("액션");
    if (searchFocusCapsuleId.value) parts.push("캡슐");
    return parts.join(" · ");
  });

  function syncSearchRailMode() {
    searchRailExpanded.value = !isMobileViewport.value || hasSearchFocus.value;
  }

  function toggleSearchRail() {
    searchRailExpanded.value = !searchRailExpanded.value;
  }

  function openConversationSearch(prefill = "") {
    const q = String(prefill || conversationSearchQ.value || "").trim();
    const query = { conversationId: conversationId.value || undefined };
    if (q) query.q = q;
    router.push({ path: "/search", query });
  }

  function openGlobalSearch() {
    const q = String(conversationSearchQ.value || "").trim();
    const query = {};
    if (q) query.q = q;
    router.push({ path: "/search", query });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function renderMessageHtml(message) {
    const raw = String(message?.content ?? "");
    let html = escapeHtml(raw).replace(/\n/g, "<br />");
    const keyword = String(searchFocusTerm.value || "").trim();
    const isSearchTarget = String(searchFocusMid.value || "") === String(message?.messageId || "");
    const shouldHighlight = keyword
      && (isSearchTarget || raw.toLowerCase().includes(keyword.toLowerCase()));

    if (shouldHighlight) {
      try {
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, "ig");
        html = html.replace(regex, '<mark class="msgSearchMark">$1</mark>');
      } catch {
        // noop
      }
    }

    return html || "&nbsp;";
  }

  function clearSearchFocus() {
    searchFocusTerm.value = "";
    searchFocusMid.value = "";
    searchFocusPinId.value = "";
    searchFocusCapsuleId.value = "";

    const query = { ...route.query };
    delete query.fromSearch;
    delete query.searchQ;
    delete query.mid;
    delete query.pinId;
    delete query.capsuleId;
    router.replace({ query }).catch(() => {});
  }

  async function focusPinFromSearch(pinId) {
    if (!pinId) return;
    dockMode.value = "active";
    dockOpen.value = true;
    await nextTick();
    const target = document.querySelector(`[data-pin-id="${pinId}"]`);
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      target.classList.add("searchAnchorPulse");
      setTimeout(() => target.classList.remove("searchAnchorPulse"), 2200);
    }
  }

  async function focusCapsuleFromSearch(capsuleId) {
    if (!capsuleId) return;
    await nextTick();
    let target = document.querySelector(`[data-capsule-id="${String(capsuleId)}"]`);
    if (!target) target = document.querySelector(".capsulePanel");
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("searchAnchorPulse");
      setTimeout(() => target.classList.remove("searchAnchorPulse"), 2200);
    }
  }

  async function refocusSearchTarget() {
    if (searchFocusMid.value) {
      await ensureMessageVisible(searchFocusMid.value, 8);
      await nextTick();
      const target = document.querySelector(`[data-mid="${searchFocusMid.value}"]`);
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("searchAnchorPulse");
        setTimeout(() => target.classList.remove("searchAnchorPulse"), 2200);
      }
      return;
    }
    if (searchFocusPinId.value) {
      await focusPinFromSearch(searchFocusPinId.value);
      return;
    }
    if (searchFocusCapsuleId.value) {
      await focusCapsuleFromSearch(searchFocusCapsuleId.value);
    }
  }

  async function syncSearchFocusFromRoute() {
    const targetMid = route.query?.mid ? String(route.query.mid) : "";
    const targetPinId = route.query?.pinId ? String(route.query.pinId) : "";
    const targetCapsuleId = route.query?.capsuleId ? String(route.query.capsuleId) : "";
    const fromSearch = route.query?.fromSearch ? String(route.query.fromSearch) === "1" : false;

    searchFocusTerm.value = route.query?.searchQ ? String(route.query.searchQ) : "";
    searchFocusMid.value = targetMid;
    searchFocusPinId.value = targetPinId;
    searchFocusCapsuleId.value = targetCapsuleId;
    syncSearchRailMode();

    return {
      fromSearch,
      targetMid,
      targetPinId,
      targetCapsuleId,
    };
  }

  return {
    conversationSearchQ,
    searchRailExpanded,
    searchFocusTerm,
    searchFocusMid,
    searchFocusPinId,
    searchFocusCapsuleId,
    conversationSearchSummary,
    hasSearchFocus,
    searchFocusSummary,
    syncSearchRailMode,
    toggleSearchRail,
    openConversationSearch,
    openGlobalSearch,
    renderMessageHtml,
    clearSearchFocus,
    refocusSearchTarget,
    focusPinFromSearch,
    focusCapsuleFromSearch,
    syncSearchFocusFromRoute,
  };
}
