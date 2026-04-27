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


<style scoped>
.hiddenFileInput{display:none}
.composerInner{
  width:100%;
  display:grid;
  gap:8px;
}
.composerRow{
  width:100%;
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:nowrap;
  padding:8px;
  border-radius:22px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.035);
}
.input{
  min-width:0;
  flex:1 1 auto;
  height:42px;
  border:0;
  outline:0;
  border-radius:16px;
  padding:0 12px;
  color:var(--text);
  background:rgba(0,0,0,.18);
}
.btn,
.miniBtn{
  flex:0 0 auto;
  border:1px solid rgba(255,255,255,.10);
  color:var(--text);
  background:rgba(255,255,255,.05);
  cursor:pointer;
}
.miniBtn{
  width:40px;
  height:40px;
  border-radius:15px;
  display:grid;
  place-items:center;
  font-weight:950;
}
.btn{
  width:44px;
  height:44px;
  border-radius:16px;
  display:grid;
  place-items:center;
  font-size:17px;
  font-weight:950;
  background:color-mix(in oklab,var(--accent) 20%,rgba(255,255,255,.05));
  border-color:color-mix(in oklab,var(--accent) 34%,rgba(255,255,255,.10));
}
.btn:disabled,.miniBtn:disabled{opacity:.5;cursor:not-allowed}
.uploadState,.uploadError{font-size:12px;padding:0 4px;color:var(--muted)}
.uploadError{color:color-mix(in oklab,var(--danger) 82%,white)}
@media (max-width:640px){
  .composerRow{gap:6px;padding:7px;border-radius:20px}
  .miniBtn{width:38px;height:38px;border-radius:14px}
  .input{height:40px;border-radius:15px}
  .btn{width:42px;height:42px;border-radius:15px}
}
</style>
