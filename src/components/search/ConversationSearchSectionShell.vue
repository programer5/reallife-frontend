<script setup>
import ConversationSearchRail from "@/components/search/ConversationSearchRail.vue";
import ConversationSearchReturnBar from "@/components/search/ConversationSearchReturnBar.vue";

const props = defineProps({
  canViewConversation: { type: Boolean, default: false },
  isMobileViewport: { type: Boolean, default: false },
  searchRailExpanded: { type: Boolean, default: false },
  conversationSearchQ: { type: String, default: "" },
  conversationSearchSummary: { type: String, default: "" },
  hasSearchFocus: { type: Boolean, default: false },
  searchFocusTerm: { type: String, default: "" },
  searchFocusMid: { type: String, default: "" },
  searchFocusPinId: { type: String, default: "" },
  searchFocusCapsuleId: { type: String, default: "" },
  searchFocusSummary: { type: String, default: "" },
});

const emit = defineEmits([
  "update:conversationSearchQ",
  "toggle-rail",
  "search",
  "quick-search",
  "global-search",
  "refocus",
  "search-again",
  "back-to-search",
  "close-focus",
]);
</script>

<template>
  <template v-if="canViewConversation">
    <ConversationSearchRail
      :visible="true"
      :compact="isMobileViewport && !searchRailExpanded"
      :mobile-viewport="isMobileViewport"
      :expanded="searchRailExpanded"
      :conversation-search-q="conversationSearchQ"
      :summary="conversationSearchSummary"
      :has-search-focus="hasSearchFocus"
      @update:conversationSearchQ="$emit('update:conversationSearchQ', $event)"
      @toggle="$emit('toggle-rail')"
      @search="$emit('search')"
      @quick-search="$emit('quick-search', $event)"
      @global-search="$emit('global-search')"
    />

    <ConversationSearchReturnBar
      v-if="hasSearchFocus"
      :visible="true"
      :focus-term="searchFocusTerm"
      :has-message-focus="!!searchFocusMid"
      :has-pin-focus="!!searchFocusPinId"
      :has-capsule-focus="!!searchFocusCapsuleId"
      :focus-summary="searchFocusSummary"
      @refocus="$emit('refocus')"
      @search-again="$emit('search-again')"
      @back-to-search="$emit('back-to-search')"
      @close="$emit('close-focus')"
    />
  </template>
</template>
