
<!-- src/components/chat/MessageAttachmentPicker.vue -->
<script setup>
defineProps({
  disabled: { type: Boolean, default: false },
  hasItems: { type: Boolean, default: false },
});
defineEmits(["pick", "clear"]);
</script>

<template>
  <div class="picker">
    <button class="pickerBtn" type="button" :disabled="disabled" @click="$emit('pick')">📎</button>
    <button v-if="hasItems" class="pickerBtn ghost" type="button" :disabled="disabled" @click="$emit('clear')">✕</button>
  </div>
</template>

<style scoped>
.picker{display:flex;align-items:center;gap:6px}
.pickerBtn{width:40px;height:40px;border-radius:14px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 88%,transparent);color:var(--text);font-size:16px;font-weight:900}
.pickerBtn.ghost{background:rgba(255,255,255,.04)}
.pickerBtn:disabled{opacity:.45}
</style>
