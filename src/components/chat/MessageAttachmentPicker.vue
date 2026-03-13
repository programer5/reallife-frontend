
<!-- src/components/chat/MessageAttachmentPicker.vue -->
<script setup>
defineProps({ disabled: { type: Boolean, default: false }, hasItems: { type: Boolean, default: false } });
defineEmits(["pick","clear"]);
</script>
<template>
  <div class="picker">
    <button class="pickerBtn" type="button" :disabled="disabled" @click="$emit('pick')">📎</button>
    <button v-if="hasItems" class="pickerBtn ghost" type="button" :disabled="disabled" @click="$emit('clear')">✕</button>
  </div>
</template>
<style scoped>
.picker{display:flex;align-items:center;gap:6px}.pickerBtn{width:38px;height:38px;border-radius:12px;border:1px solid color-mix(in oklab,var(--border) 86%, transparent);background:color-mix(in oklab,var(--surface) 84%, transparent);color:var(--text);font-size:16px;font-weight:900;cursor:pointer}.pickerBtn.ghost{background:rgba(255,255,255,.04)}.pickerBtn:disabled{opacity:.45;cursor:not-allowed}
</style>
