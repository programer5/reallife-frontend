import { useConversationDetailSearchRailSectionProps } from "@/composables/useConversationDetailSearchRailSectionProps";
import { useConversationDetailSearchRailSectionEmits } from "@/composables/useConversationDetailSearchRailSectionEmits";

export function useConversationDetailSearchRailSectionBinding(args = {}) {
  const props = useConversationDetailSearchRailSectionProps(args);
  const emits = useConversationDetailSearchRailSectionEmits(args);

  return {
    props,
    emits,
  };
}
