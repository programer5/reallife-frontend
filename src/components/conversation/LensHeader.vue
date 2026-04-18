<script setup>
const props = defineProps({
  eyebrow: { type: String, default: 'Lens' },
  title: { type: String, default: '검색' },
  closeLabel: { type: String, default: '렌즈 닫기' },
})
const emit = defineEmits(['close'])
</script>

<template>
  <div class="commandDeck__head">
    <div>
      <div class="commandDeck__eyebrow">{{ props.eyebrow }}</div>
      <strong>{{ props.title }}</strong>
    </div>
    <button type="button" class="commandDeck__close" :aria-label="props.closeLabel" @click="emit('close')">✕</button>
  </div>
</template>
