<!-- src/layouts/AppShell.vue -->
<template>
  <div class="shell">
    <div class="bgLayer" aria-hidden="true"></div>
    <AppHeader
        subtitle="Real-time social"
        :live="connected"
    />

    <main class="content" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <router-view />
    </main>

    <BottomTabs />

    <ToastHost />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import sse from "@/lib/sse";
import AppHeader from "@/components/AppHeader.vue";
import BottomTabs from "@/components/BottomTabs.vue";
import ToastHost from "@/components/ToastHost.vue";

const status = ref({ running: false, connected: false });
const router = useRouter();
const route = useRoute();
const touchStartX = ref(0);
const touchStartY = ref(0);
const swiping = ref(false);
const rootRoutes = ["/home", "/inbox", "/me"];
let off = null;

onMounted(() => {
  off = sse.onStatus((s) => (status.value = s));
});
onUnmounted(() => {
  if (off) off();
});

const connected = computed(() => status.value.connected);
const rootRouteIndex = computed(() => rootRoutes.findIndex((p) => route.path === p));

function shouldIgnoreSwipe(target) {
  if (!target || !(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-app-swipe], .lightbox, .dockRow, .dockPanel, .composer, .carousel, .noSwipe');
}

function onTouchStart(e) {
  if (rootRouteIndex.value < 0) return;
  const t = e.changedTouches?.[0];
  if (!t) return;
  if (shouldIgnoreSwipe(e.target)) return;
  touchStartX.value = t.clientX;
  touchStartY.value = t.clientY;
  swiping.value = true;
}

function onTouchEnd(e) {
  if (!swiping.value || rootRouteIndex.value < 0) return;
  swiping.value = false;
  const t = e.changedTouches?.[0];
  if (!t) return;
  const dx = t.clientX - touchStartX.value;
  const dy = t.clientY - touchStartY.value;
  if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  const dir = dx < 0 ? 1 : -1;
  const nextIndex = rootRouteIndex.value + dir;
  if (nextIndex < 0 || nextIndex >= rootRoutes.length) return;
  router.push(rootRoutes[nextIndex]);
}
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
