import { useConversationDetailSearchImportsReady } from "@/composables/useConversationDetailSearchImportsReady";

export function useConversationDetailShellMountBundle(args) {
  const ready = useConversationDetailSearchImportsReady(args);

  return {
    shellProps: ready.shellProps,
    shellBindings: ready.shellBindings,
    isShellReady: ready.isShellReady,
  };
}
