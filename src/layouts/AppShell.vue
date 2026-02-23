<!-- src/layouts/AppShell.vue -->
<template>
  <div class="shell">
    <AppHeader
        subtitle="Real-time social"
        :live="connected"
    />

    <main class="content">
      <router-view />
    </main>

    <BottomTabs />

    <ToastHost />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import sse from "@/lib/sse";
import AppHeader from "@/components/AppHeader.vue";
import BottomTabs from "@/components/BottomTabs.vue";
import ToastHost from "@/components/ToastHost.vue";

const status = ref({ running: false, connected: false });
let off = null;

onMounted(() => {
  off = sse.onStatus((s) => (status.value = s));
});
onUnmounted(() => {
  if (off) off();
});

const connected = computed(() => status.value.connected);
</script>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.content {
  overflow: auto;
  padding-bottom: 6px; /* 탭바랑 겹침 방지 */
}
</style>