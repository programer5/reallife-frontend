import { computed, ref } from "vue";

export function useConversationSearchRailState({ isMobileViewport, activeCount, capsuleItems, items, conversationId, router }) {
  const conversationSearchQ = ref("");
  const searchRailExpanded = ref(false);

  const conversationSearchSummary = computed(() => {
    const parts = [];
    if (activeCount?.value) parts.push(`액션 ${activeCount.value}`);
    if (capsuleItems?.value?.length) parts.push(`캡슐 ${capsuleItems.value.length}`);
    if (items?.value?.length) parts.push(`메시지 ${items.value.length}`);
    return parts.length ? parts.join(" · ") : "이 대화의 흐름을 빠르게 다시 찾을 수 있어요";
  });

  function syncSearchRailMode(hasSearchFocus = false) {
    searchRailExpanded.value = !isMobileViewport.value || hasSearchFocus;
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

  return {
    conversationSearchQ,
    searchRailExpanded,
    conversationSearchSummary,
    syncSearchRailMode,
    toggleSearchRail,
    openConversationSearch,
    openGlobalSearch,
  };
}
