<!-- src/layouts/AppShell.vue -->
<template>
  <div class="shell">
    <div class="bgLayer" aria-hidden="true"></div>
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
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  isolation: isolate;
}

.bgLayer{
  position: fixed;
  inset: 0;
  z-index: 0;
  /* global background flattening */
  background:
    radial-gradient(1200px 600px at 50% -20%, rgba(89, 181, 255, 0.14), transparent 60%),
    radial-gradient(900px 500px at 20% 80%, rgba(30, 255, 191, 0.10), transparent 60%),
    radial-gradient(900px 500px at 80% 70%, rgba(178, 90, 255, 0.10), transparent 60%),
    linear-gradient(180deg, rgba(8,12,18,1), rgba(6,10,14,1));
}

.bgLayer::after{
  content:"";
  position: absolute;
  left:0; right:0; bottom:0;
  height: 220px;
  background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.55));
  pointer-events:none;
}

.content {
  position: relative;
  z-index: 1;
  overflow: auto;
  padding-bottom: 6px;
}

@media (min-width: 1024px){
  .shell{grid-template-rows:auto 1fr;}
  .content{padding-bottom:0;}
  .bgLayer::after{display:none;}
}

</style>
