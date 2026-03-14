
<template>
  <div class="chips">
    <button v-for="item in items" :key="item.value" class="chip" :class="{ on: modelValue === item.value }" @click="$emit('update:modelValue', item.value)">
      {{ item.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({ modelValue: { type: String, default: "all" }, items: { type: Array, default: () => [] } });
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900}.chip.on{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.16)}
</style>
