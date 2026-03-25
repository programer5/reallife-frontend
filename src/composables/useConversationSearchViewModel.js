import { createSearchBridge } from "@/composables/useConversationSearchBridge";
import { useConversationSearchIntegrationFlag } from "@/composables/useConversationSearchIntegrationFlag";
import { useConversationSearchRailState } from "@/composables/useConversationSearchRailState";

export function useConversationSearchViewModel({
  isMobileViewport,
  activeCount,
  capsuleItems,
  items,
  conversationId,
  router,
  searchFocus,
  highlight,
  legacyHandlers,
}) {
  const flags = useConversationSearchIntegrationFlag();
  const rail = useConversationSearchRailState({
    isMobileViewport,
    activeCount,
    capsuleItems,
    items,
    conversationId,
    router,
  });

  const bridge = createSearchBridge({
    searchFocus,
    highlight,
    legacyHandlers,
  });

  return {
    ...flags,
    ...rail,
    searchBridge: bridge,
  };
}
