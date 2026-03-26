export function useConversationDetailSearchReturnSectionBinding(args = {}) {
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

  return {
    props: {
      visible: Boolean(canViewConversation) && Boolean(hasSearchFocus),
      searchFocusTerm,
      searchFocusMid,
      searchFocusPinId,
      searchFocusCapsuleId,
      searchFocusSummary,
    },
    emits: {
      onRefocus() {
        if (typeof refocusSearchTarget === "function") refocusSearchTarget();
      },
      onOpenSearch() {
        if (typeof openConversationSearch === "function") openConversationSearch(searchFocusTerm);
      },
      onClose() {
        if (typeof clearSearchFocus === "function") clearSearchFocus();
      },
    },
  };
}
