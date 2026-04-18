<script setup>
const props = defineProps({
  tabs: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: String,
    default: 'search',
  },
})

const emit = defineEmits(['update:modelValue'])

function iconForTab(key) {
  if (key === 'search') return '🔎'
  if (key === 'actions') return '📌'
  if (key === 'capsules') return '⏳'
  return '▶'
}

function selectTab(key) {
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="commandDeck__tabs">
    <button
      v-for="tab in props.tabs"
      :key="tab.key"
      type="button"
      class="commandDeck__tab"
      :class="{ on: props.modelValue === tab.key }"
      :title="tab.label"
      :aria-label="tab.label"
      @click="selectTab(tab.key)"
    >
      <span>{{ iconForTab(tab.key) }}</span>
      <small>{{ tab.badge }}</small>
    </button>
  </div>
</template>
