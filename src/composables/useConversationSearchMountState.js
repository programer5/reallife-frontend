import { useConversationSearchMountPreview } from "@/composables/useConversationSearchMountPreview";

export function useConversationSearchMountState(args) {
  const preview = useConversationSearchMountPreview(args);

  return {
    shellProps: preview.shellProps,
    shellBindings: preview.shellBindings,
  };
}
