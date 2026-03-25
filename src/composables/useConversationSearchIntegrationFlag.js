import { ref } from "vue";

// Temporary flag to safely enable new search integration step-by-step
export function useConversationSearchIntegrationFlag() {
  const enableNewSearchUI = ref(true);
  const enableHighlightComposable = ref(true);

  return {
    enableNewSearchUI,
    enableHighlightComposable,
  };
}
