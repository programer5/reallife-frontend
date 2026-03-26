export function useConversationDetailSearchRailSectionProps(args = {}) {
  const {
    canViewConversation,
    isMobileViewport,
    searchRailExpanded,
    conversationSearchSummary,
    hasSearchFocus,
    conversationSearchQ,
  } = args;

  return {
    visible: canViewConversation,
    compact: Boolean(isMobileViewport) && !Boolean(searchRailExpanded),
    expanded: !Boolean(isMobileViewport) || Boolean(searchRailExpanded),
    summary: conversationSearchSummary,
    hasSearchFocus,
    searchQuery: conversationSearchQ,
  };
}
