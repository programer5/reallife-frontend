export function useConversationDetailSearchRailSectionEmits(args = {}) {
  const {
    setSearchQuery,
    toggleSearchRail,
    openConversationSearch,
    openGlobalSearch,
  } = args;

  return {
    onUpdateSearchQuery(value) {
      if (typeof setSearchQuery === "function") setSearchQuery(value);
    },
    onToggle() {
      if (typeof toggleSearchRail === "function") toggleSearchRail();
    },
    onSearch() {
      if (typeof openConversationSearch === "function") openConversationSearch();
    },
    onSearchPromise() {
      if (typeof openConversationSearch === "function") openConversationSearch("약속");
    },
    onSearchCapsule() {
      if (typeof openConversationSearch === "function") openConversationSearch("캡슐");
    },
    onSearchGlobal() {
      if (typeof openGlobalSearch === "function") openGlobalSearch();
    },
  };
}
