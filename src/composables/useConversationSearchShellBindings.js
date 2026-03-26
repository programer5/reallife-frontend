export function createConversationSearchShellBindings({
  viewModel,
  searchFocus,
  searchBridge,
}) {
  return {
    onConversationSearchQUpdate(value) {
      viewModel.conversationSearchQ.value = value;
    },
    onToggleRail() {
      viewModel.toggleSearchRail();
    },
    onSearch() {
      viewModel.openConversationSearch();
    },
    onQuickSearch(value) {
      viewModel.openConversationSearch(value);
    },
    onGlobalSearch() {
      viewModel.openGlobalSearch();
    },
    onRefocus() {
      return searchBridge.refocus();
    },
    onSearchAgain() {
      return viewModel.openConversationSearch(searchFocus.searchFocusTerm.value);
    },
    onBackToSearch() {
      return searchFocus.goBackToSearch?.();
    },
    onCloseFocus() {
      return searchFocus.clearSearchFocus();
    },
  };
}
