<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  top: { type: Number, default: 0 },
  left: { type: Number, default: 0 },
  message: { type: Object, default: null },
  canEdit: { type: Boolean, default: false },
  hasCandidates: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'copy', 'edit', 'toggle-candidates']);
</script>

<template>
  <div v-if="open" class="msgMenuOverlay" @mousedown="emit('close')">
    <div
      class="msgMenuPopover"
      :style="{ top: `${top}px`, left: `${left}px` }"
      @mousedown.stop
    >
      <button class="msgMenuItem" type="button" title="복사" aria-label="복사" @click="emit('copy')">⧉</button>
      <button
        v-if="canEdit"
        class="msgMenuItem"
        type="button"
        title="수정"
        aria-label="수정"
        @click="emit('edit')"
      >✎</button>
      <button
        v-if="hasCandidates"
        class="msgMenuItem"
        type="button"
        title="후보 보기/닫기"
        aria-label="후보 보기/닫기"
        @click="emit('toggle-candidates')"
      >📌</button>
    </div>
  </div>
</template>

<style scoped>
.msgMenuOverlay{
  position: fixed;
  inset: 0;
  z-index: var(--z-lightbox, 1200);
}
.msgMenuPopover{
  position: fixed;
  min-width: 96px;
  display: flex;
  gap: 4px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(20,25,35,.95);
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  overflow: hidden;
}
.msgMenuItem{
  min-width: 40px;
  height: 40px;
  display:grid;
  place-items:center;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor: pointer;
  font-size: 16px;
}
.msgMenuItem:hover{
  background: rgba(255,255,255,.08);
}
</style>
