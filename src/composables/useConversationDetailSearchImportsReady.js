import { useConversationSearchShellReady } from "@/composables/useConversationSearchShellReady";

export function useConversationDetailSearchImportsReady(args) {
  const shell = useConversationSearchShellReady(args);

  return {
    shellProps: shell.shellProps,
    shellBindings: shell.shellBindings,
    isShellReady: shell.isShellReady,
  };
}
