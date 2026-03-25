import { computed, ref } from "vue";

export function useConversationSearchFocus(route, router, nextTick) {
  const searchFocusTerm = ref("");
  const searchFocusMid = ref("");
  const searchFocusPinId = ref("");
  const searchFocusCapsuleId = ref("");

  const hasSearchFocus = computed(() => Boolean(
    searchFocusTerm.value ||
      searchFocusMid.value ||
      searchFocusPinId.value ||
      searchFocusCapsuleId.value
  ));

  const searchFocusSummary = computed(() => {
    const parts = [];
    if (searchFocusMid.value) parts.push("메시지");
    if (searchFocusPinId.value) parts.push("액션");
    if (searchFocusCapsuleId.value) parts.push("캡슐");
    return parts.join(" · ");
  });

  function syncFromRoute() {
    const query = route.query || {};
    searchFocusTerm.value = query.searchQ ? String(query.searchQ) : "";
    searchFocusMid.value = query.mid ? String(query.mid) : "";
    searchFocusPinId.value = query.pinId ? String(query.pinId) : "";
    searchFocusCapsuleId.value = query.capsuleId ? String(query.capsuleId) : "";
    return {
      fromSearch: query.fromSearch ? String(query.fromSearch) === "1" : false,
      focusTerm: searchFocusTerm.value,
      focusMid: searchFocusMid.value,
      focusPinId: searchFocusPinId.value,
      focusCapsuleId: searchFocusCapsuleId.value,
    };
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

  async function refocusSearchTarget({
    ensureMessageVisible,
    focusPinFromSearch,
    focusCapsuleFromSearch,
  }) {
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

  return {
    searchFocusTerm,
    searchFocusMid,
    searchFocusPinId,
    searchFocusCapsuleId,
    hasSearchFocus,
    searchFocusSummary,
    syncFromRoute,
    clearSearchFocus,
    refocusSearchTarget,
  };
}
