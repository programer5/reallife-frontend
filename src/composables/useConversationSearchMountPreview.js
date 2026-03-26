import { computed } from "vue";
import { createConversationSearchShellProps } from "@/composables/useConversationSearchShellProps";
import { createConversationSearchShellBindings } from "@/composables/useConversationSearchShellBindings";

export function useConversationSearchMountPreview({
  canViewConversation,
  isMobileViewport,
  viewModel,
  searchFocus,
  searchBridge,
}) {
  const shellProps = computed(() =>
    createConversationSearchShellProps({
      canViewConversation,
      isMobileViewport,
      viewModel,
      searchFocus,
    })
  );

  const shellBindings = createConversationSearchShellBindings({
    viewModel,
    searchFocus,
    searchBridge,
  });

  return {
    shellProps,
    shellBindings,
  };
}
