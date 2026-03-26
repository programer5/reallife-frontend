import { computed } from "vue";
import { useConversationSearchMountState } from "@/composables/useConversationSearchMountState";

export function useConversationSearchShellReady(args) {
  const mountState = useConversationSearchMountState(args);
  const isShellReady = computed(() => Boolean(mountState?.shellProps && mountState?.shellBindings));

  return {
    ...mountState,
    isShellReady,
  };
}
