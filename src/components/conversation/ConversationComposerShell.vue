<script setup>
import { computed, ref } from "vue";
import MessageAttachmentPicker from "@/components/chat/MessageAttachmentPicker.vue";
import MessageAttachmentPreview from "@/components/chat/MessageAttachmentPreview.vue";

const props = defineProps({
  content: { type: String, default: "" },
  sending: { type: Boolean, default: false },
  attachmentUploading: { type: Boolean, default: false },
  attachmentProgress: { type: Number, default: 0 },
  attachmentError: { type: String, default: "" },
  attachedFiles: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "update:content",
  "pick-files",
  "remove-attached-file",
  "clear-attachments",
  "open-capsule-modal",
  "open-session-modal",
  "send",
]);

const fileInputRef = ref(null);
const contentModel = computed({
  get: () => props.content,
  set: (value) => emit("update:content", value),
});

function openAttachmentPicker() {
  fileInputRef.value?.click?.();
}

function onPickFiles(event) {
  emit("pick-files", event);
  if (event?.target) event.target.value = "";
}
</script>

<template>
  <div class="composerInner composerInner--stack">
    <slot name="utility" />
    <input ref="fileInputRef" type="file" class="hiddenFileInput" multiple @change="onPickFiles" />
    <MessageAttachmentPreview
      v-if="attachedFiles.length"
      :items="attachedFiles"
      mode="composer"
      :uploading="attachmentUploading"
      :upload-progress="attachmentProgress"
      removable
      @remove="(item) => emit('remove-attached-file', item)"
    />
    <div v-if="attachmentUploading" class="uploadState">첨부 업로드 중… {{ attachmentProgress }}%</div>
    <div v-else-if="attachmentError" class="uploadError">{{ attachmentError }}</div>
    <div class="composerRow">
      <MessageAttachmentPicker
        :disabled="sending || attachmentUploading"
        :has-items="attachedFiles.length > 0"
        @pick="openAttachmentPicker"
        @clear="() => emit('clear-attachments')"
      />
      <button
        class="miniBtn"
        type="button"
        :disabled="sending || attachmentUploading"
        title="타임 캡슐 만들기"
        @click="emit('open-capsule-modal')"
      >⏳</button>
      <button
        class="miniBtn"
        type="button"
        :disabled="sending || attachmentUploading"
        title="공동 플레이 세션 만들기"
        aria-label="공동 플레이 세션 만들기"
        @click="emit('open-session-modal')"
      >＋</button>
      <input
        v-model="contentModel"
        class="input"
        placeholder="메시지 입력…"
        @keydown.enter.prevent="emit('send')"
      />
      <button class="btn" type="button" :disabled="sending || attachmentUploading" @click="emit('send')">
        {{ sending || attachmentUploading ? '...' : '➤' }}
      </button>
    </div>
  </div>
</template>
