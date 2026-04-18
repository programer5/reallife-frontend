<script setup>
import MessageAttachmentPreview from "@/components/chat/MessageAttachmentPreview.vue";
import ConversationSessionMessageCard from "@/components/chat/ConversationSessionMessageCard.vue";

const props = defineProps({
  message: { type: Object, required: true },
  index: { type: Number, required: true },
  unreadDividerMid: { type: [String, Number, null], default: null },
  editingMid: { type: [String, Number, null], default: null },
  editingText: { type: String, default: "" },
  savingEdit: { type: Boolean, default: false },
  flashMid: { type: [String, Number, null], default: null },
  searchFocusMid: { type: [String, Number, null], default: null },
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
});

const emit = defineEmits([
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
]);

function updateEditingText(event) {
  emit("update:editing-text", event?.target?.value ?? "");
}
</script>

<template>
  <div
    class="msg"
    :class="messageShellClass(message, index)"
    :style="messageDepthStyle(index)"
    :data-mid="message.messageId"
  >
    <div
      v-if="unreadDividerMid && String(message.messageId) === String(unreadDividerMid)"
      class="unreadDivider"
    >
      <span>읽지 않은 메시지</span>
    </div>

    <div
      class="bubble"
      :class="messageBubbleClass(message, index)"
      @contextmenu.prevent.stop="emit('open-msg-menu', $event, message)"
      @touchstart.passive="emit('bubble-touch-start', $event, message)"
      @touchend="emit('bubble-touch-end')"
      @touchcancel="emit('bubble-touch-end')"
      @click="emit('bubble-click', $event, message)"
    >
      <button
        v-if="!editingMid || String(message.messageId) !== String(editingMid)"
        class="msgMenuTrigger"
        type="button"
        aria-label="메시지 메뉴 열기"
        @click.stop="emit('open-msg-menu', $event, message)"
      >⋯</button>

      <div
        v-if="(!editingMid || String(message.messageId) !== String(editingMid)) && hasMessageTools(message)"
        class="hoverActions"
      >
        <button class="haBtn" type="button" title="복사" @click.stop="emit('copy-message', message)">
          <span class="haBtn__icon">⧉</span>
          <span class="haBtn__label">복사</span>
        </button>

        <button
          v-if="isMineMessage(message)"
          class="haBtn"
          type="button"
          title="수정"
          @click.stop="emit('start-edit', message)"
        >
          <span class="haBtn__icon">✎</span>
          <span class="haBtn__label">수정</span>
        </button>

        <button
          v-if="message.pinCandidates && message.pinCandidates.length"
          class="haBtn haBtn--accent"
          type="button"
          :title="candidateToggleLabel(message)"
          @click.stop="emit('toggle-candidates', message.messageId)"
        >
          <span class="haBtn__icon">✨</span>
          <span class="haBtn__label">{{ candidateToggleLabel(message) }}</span>
        </button>
      </div>

      <span v-if="isSavedBadgeOn(message.messageId)" class="savedBadge" aria-live="polite">저장됨</span>
      <span v-if="searchFocusMid === String(message.messageId)" class="messageSearchHitBadge" aria-live="polite">검색 결과</span>

      <div class="text" :class="messageBodyClass(message, index)">
        <template v-if="editingMid && String(message.messageId) === String(editingMid)">
          <textarea
            class="editBox"
            rows="2"
            :disabled="savingEdit"
            :value="editingText"
            @input="updateEditingText"
          ></textarea>

          <div class="editActions">
            <button class="editBtn" :disabled="savingEdit" @click="emit('cancel-edit')">취소</button>
            <button class="editBtn editBtn--primary" :disabled="savingEdit" @click="emit('save-edit', message)">
              저장
            </button>
          </div>
        </template>

        <template v-else>
          <div v-if="shouldShowMessageEyebrow(message, index)" class="messageEyebrow">
            <span class="messageEyebrow__tag">{{ messageEyebrowLabel(message, index) }}</span>
            <small v-if="messageEyebrowHint(message, index)" class="messageEyebrow__hint">{{ messageEyebrowHint(message, index) }}</small>
          </div>

          <template v-if="isSessionMessage(message)">
            <div class="messageTextBlock messageTextBlock--session">
              <span v-html="renderMessageHtml(message)"></span>
              <span v-if="message.editedAt" class="editedMark">(수정됨)</span>
            </div>
            <div :class="messageSessionBlockClass(message, index)">
              <ConversationSessionMessageCard
                :message="message"
                :session="sessionForMessage(message)"
                :busy="isActionBusy(sessionForMessage(message)?.sessionId)"
                :current-user-id="meId"
                compact
                @activate-session="emit('activate-session', $event)"
                @play="emit('play', $event)"
                @pause="emit('pause', $event)"
                @seek="emit('seek', $event)"
                @end="emit('end', $event)"
                @playback-intent="emit('playback-intent', $event)"
                @position-sampled="emit('position-sampled', $event)"
                @touch-presence="emit('touch-presence', $event)"
              />
            </div>
          </template>
          <template v-else>
            <div class="messageTextBlock">
              <span v-html="renderMessageHtml(message)"></span>
              <span v-if="message.editedAt" class="editedMark">(수정됨)</span>
            </div>

            <div v-if="messageHasActionCandidate(message)" class="messageInlineMeta messageInlineMeta--action">
              <span class="messageInlineMeta__chip">후보 {{ Array.isArray(message.pinCandidates) ? message.pinCandidates.length : 0 }}개</span>
            </div>
          </template>
        </template>

        <div
          v-if="messageUtilitySummary(message) && (!editingMid || String(message.messageId) !== String(editingMid))"
          class="messageToolSummary"
        >
          <small>{{ messageUtilitySummary(message) }}</small>
        </div>
      </div>

      <div v-if="shouldRenderMessageFooter(message)" :class="messageFooterClass(message, index)">
        <MessageAttachmentPreview
          v-if="hasMessageAttachmentBlock(message)"
          :items="message.attachments"
          class="messageAttachmentBlock"
        />

        <div v-if="hasMessageSendState(message)" class="sendState" :data-status="message._status">
          <template v-if="message._status === 'sending'">전송 중…</template>

          <template v-else-if="message._status === 'failed'">
            전송 실패
            <button class="retryBtn" type="button" @click="emit('retry-send', message)">재시도</button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="shouldShowMessageMeta(message, index)" :class="messageMetaRowClass(message, index)">
      <span v-if="getReadLabel(message)" class="readReceipt">{{ getReadLabel(message) }}</span>
      <span v-if="!isGroupWithNext(index)" class="time">{{ messageTimeText(message) }}</span>
    </div>
  </div>
</template>
