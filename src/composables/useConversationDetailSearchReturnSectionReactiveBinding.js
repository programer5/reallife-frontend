import { computed } from "vue";

export function useConversationDetailSearchReturnSectionReactiveBinding(args = {}) {
  const {
    canViewConversation,
    hasSearchFocus,
    searchFocusTerm,
    searchFocusMid,
    searchFocusPinId,
    searchFocusCapsuleId,
    searchFocusSummary,
    refocusSearchTarget,
    openConversationSearch,
    clearSearchFocus,
  } = args;

  const props = computed(() => ({
    visible: Boolean(canViewConversation?.value) && Boolean(hasSearchFocus?.value),
    searchFocusTerm: searchFocusTerm?.value || "",
    searchFocusMid: searchFocusMid?.value || "",
    searchFocusPinId: searchFocusPinId?.value || "",
    searchFocusCapsuleId: searchFocusCapsuleId?.value || "",
    searchFocusSummary: searchFocusSummary?.value || "",
  }));

  const emits = {
    onRefocus() {
      if (typeof refocusSearchTarget === "function") refocusSearchTarget();
    },
    onOpenSearch() {
      if (typeof openConversationSearch === "function") openConversationSearch(searchFocusTerm?.value || "");
    },
    onClose() {
      if (typeof clearSearchFocus === "function") clearSearchFocus();
    },
  };

  return {
    props,
    emits,
  };
}
