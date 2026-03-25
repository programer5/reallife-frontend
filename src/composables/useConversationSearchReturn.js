import { ref } from "vue";

export function useConversationSearchReturn(route, router) {
  const isFromSearch = ref(false);
  const searchQuery = ref("");

  function init() {
    const q = route.query || {};
    if (q.fromSearch === "1") {
      isFromSearch.value = true;
      searchQuery.value = q.searchQ || "";
    }
  }

  function clear() {
    isFromSearch.value = false;
    searchQuery.value = "";
  }

  function goBackToSearch() {
    if (!searchQuery.value) return;
    router.push({ path: "/search", query: { q: searchQuery.value } });
  }

  return {
    isFromSearch,
    searchQuery,
    init,
    clear,
    goBackToSearch,
  };
}
