<script setup>
import { ref } from "vue";
import SearchReturnBar from "@/components/conversation/SearchReturnBar.vue";
import ConversationMessageRow from "@/components/conversation/ConversationMessageRow.vue";

defineProps({
  canViewConversation: { type: Boolean, default: false },
  hasSearchFocus: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
  visibleMessages: { type: Array, default: () => [] },
  unreadDividerMid: { type: [String, Number, null], default: null },
  editingMid: { type: [String, Number, null], default: null },
  editingText: { type: String, default: "" },
  savingEdit: { type: Boolean, default: false },
  flashMid: { type: [String, Number, null], default: null },
  searchFocusMid: { type: [String, Number, null], default: null },
  searchFocusTerm: { type: String, default: "" },
  messageShellClass: { type: Function, required: true },
  messageDepthStyle: { type: Function, required: true },
  messageBubbleClass: { type: Function, required: true },
  messageBodyClass: { type: Function, required: true },
  messageSessionBlockClass: { type: Function, required: true },
  hasMessageTools: { type: Function, required: true },
  isMineMessage: { type: Function, required: true },
  candidateToggleLabel: { type: Function, required: true },
  isSavedBadgeOn: { type: Function, required: true },
  shouldShowMessageEyebrow: { type: Function, required: true },
  messageEyebrowLabel: { type: Function, required: true },
  messageEyebrowHint: { type: Function, required: true },
  isSessionMessage: { type: Function, required: true },
  renderMessageHtml: { type: Function, required: true },
  sessionForMessage: { type: Function, required: true },
  isActionBusy: { type: Function, required: true },
  meId: { type: [String, Number], default: "" },
  messageHasActionCandidate: { type: Function, required: true },
  messageUtilitySummary: { type: Function, required: true },
  shouldRenderMessageFooter: { type: Function, required: true },
  messageFooterClass: { type: Function, required: true },
  hasMessageAttachmentBlock: { type: Function, required: true },
  hasMessageSendState: { type: Function, required: true },
  shouldShowMessageMeta: { type: Function, required: true },
  messageMetaRowClass: { type: Function, required: true },
  getReadLabel: { type: Function, required: true },
  isGroupWithNext: { type: Function, required: true },
  messageTimeText: { type: Function, required: true },
  newMsgCount: { type: Number, default: 0 },
});

const emit = defineEmits([
  "refocus-search-target",
  "repeat-search",
  "clear-search-focus",
  "load-more",
  "update:editing-text",
  "open-msg-menu",
  "bubble-touch-start",
  "bubble-touch-end",
  "bubble-click",
  "copy-message",
  "start-edit",
  "toggle-candidates",
  "cancel-edit",
  "save-edit",
  "activate-session",
  "play",
  "pause",
  "seek",
  "end",
  "playback-intent",
  "position-sampled",
  "touch-presence",
  "retry-send",
  "jump-to-newest",
]);

const scrollerRef = ref(null);

defineExpose({
  scrollTo(options) {
    scrollerRef.value?.scrollTo?.(options);
  },
  getElement() {
    return scrollerRef.value;
  },
});

function onOpenMsgMenu(event, message) {
  emit("open-msg-menu", event, message);
}
function onBubbleTouchStart(event, message) {
  emit("bubble-touch-start", event, message);
}
function onBubbleClick(event, message) {
  emit("bubble-click", event, message);
}
</script>

<template>
  <div ref="scrollerRef" class="scroller rl-scroll rl-scroll--premium">
    <div class="inner">
      <SearchReturnBar
        v-if="canViewConversation && hasSearchFocus"
        @refocus="emit('refocus-search-target')"
        @repeat-search="emit('repeat-search')"
        @close="emit('clear-search-focus')"
      />

      <div class="more">
        <button v-if="hasNext" class="moreBtn" type="button" @click="emit('load-more')">
          ↑
        </button>
      </div>

      <ConversationMessageRow
        v-for="(m, i) in visibleMessages"
        :key="m.messageId"
        :message="m"
        :index="i"
        :unread-divider-mid="unreadDividerMid"
        :editing-mid="editingMid"
        :editing-text="editingText"
        :saving-edit="savingEdit"
        :flash-mid="flashMid"
        :search-focus-mid="searchFocusMid"
        :message-shell-class="messageShellClass"
        :message-depth-style="messageDepthStyle"
        :message-bubble-class="messageBubbleClass"
        :message-body-class="messageBodyClass"
        :message-session-block-class="messageSessionBlockClass"
        :has-message-tools="hasMessageTools"
        :is-mine-message="isMineMessage"
        :candidate-toggle-label="candidateToggleLabel"
        :is-saved-badge-on="isSavedBadgeOn"
        :should-show-message-eyebrow="shouldShowMessageEyebrow"
        :message-eyebrow-label="messageEyebrowLabel"
        :message-eyebrow-hint="messageEyebrowHint"
        :is-session-message="isSessionMessage"
        :render-message-html="renderMessageHtml"
        :session-for-message="sessionForMessage"
        :is-action-busy="isActionBusy"
        :me-id="meId"
        :message-has-action-candidate="messageHasActionCandidate"
        :message-utility-summary="messageUtilitySummary"
        :should-render-message-footer="shouldRenderMessageFooter"
        :message-footer-class="messageFooterClass"
        :has-message-attachment-block="hasMessageAttachmentBlock"
        :has-message-send-state="hasMessageSendState"
        :should-show-message-meta="shouldShowMessageMeta"
        :message-meta-row-class="messageMetaRowClass"
        :get-read-label="getReadLabel"
        :is-group-with-next="isGroupWithNext"
        :message-time-text="messageTimeText"
        @update:editing-text="emit('update:editing-text', $event)"
        @open-msg-menu="onOpenMsgMenu"
        @bubble-touch-start="onBubbleTouchStart"
        @bubble-touch-end="emit('bubble-touch-end')"
        @bubble-click="onBubbleClick"
        @copy-message="emit('copy-message', $event)"
        @start-edit="emit('start-edit', $event)"
        @toggle-candidates="emit('toggle-candidates', $event)"
        @cancel-edit="emit('cancel-edit')"
        @save-edit="emit('save-edit', $event)"
        @activate-session="emit('activate-session', $event)"
        @play="emit('play', $event)"
        @pause="emit('pause', $event)"
        @seek="emit('seek', $event)"
        @end="emit('end', $event)"
        @playback-intent="emit('playback-intent', $event)"
        @position-sampled="emit('position-sampled', $event)"
        @touch-presence="emit('touch-presence', $event)"
        @retry-send="emit('retry-send', $event)"
      />

      <div class="bottomSpacer"></div>
    </div>
  </div>

  <button v-if="newMsgCount > 0" class="newBanner" type="button" @click="emit('jump-to-newest')">
    ↓ {{ newMsgCount }}
  </button>
</template>
