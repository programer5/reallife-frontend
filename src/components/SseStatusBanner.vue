<template>
  <div v-if="show" class="banner" :class="kind">
    <span v-if="kind === 'connecting'">🔄 실시간 연결 중…</span>
    <span v-else-if="kind === 'error'">⚠️ 실시간 연결이 불안정해요. 잠시 후 자동 복구됩니다.</span>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useSseStore } from "@/stores/sse";

const s = useSseStore();

const kind = computed(() => {
  if (s.status === "connecting") return "connecting";
  if (s.status === "error") return "error";
  return "";
});

const show = computed(() => kind.value === "connecting" || kind.value === "error");
</script>

<style scoped>
.banner {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
  border-bottom: 1px solid rgba(0,0,0,.06);
  backdrop-filter: blur(8px);
}
.connecting {
  opacity: .9;
}
.error {
  opacity: .95;
}
</style>