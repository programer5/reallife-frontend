// Bridge layer: safely connect legacy ConversationDetail logic with new composables

export function createSearchBridge({
  searchFocus,
  highlight,
  legacyHandlers,
}) {
  function refocus() {
    if (!searchFocus?.refocusSearchTarget) return;

    return searchFocus.refocusSearchTarget({
      ensureMessageVisible: highlight.ensureMessageVisible,
      focusPinFromSearch: legacyHandlers.focusPinFromSearch,
      focusCapsuleFromSearch: legacyHandlers.focusCapsuleFromSearch,
    });
  }

  function clear() {
    searchFocus?.clearSearchFocus?.();
  }

  return {
    refocus,
    clear,
  };
}
