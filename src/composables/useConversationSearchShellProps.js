export function createConversationSearchShellProps({
  canViewConversation,
  isMobileViewport,
  viewModel,
  searchFocus,
}) {
  return {
    canViewConversation: !!canViewConversation.value,
    isMobileViewport: !!isMobileViewport.value,
    searchRailExpanded: !!viewModel.searchRailExpanded.value,
    conversationSearchQ: viewModel.conversationSearchQ.value,
    conversationSearchSummary: viewModel.conversationSearchSummary.value,
    hasSearchFocus: !!searchFocus.hasSearchFocus.value,
    searchFocusTerm: searchFocus.searchFocusTerm.value,
    searchFocusMid: searchFocus.searchFocusMid.value,
    searchFocusPinId: searchFocus.searchFocusPinId.value,
    searchFocusCapsuleId: searchFocus.searchFocusCapsuleId.value,
    searchFocusSummary: searchFocus.searchFocusSummary.value,
  };
}
