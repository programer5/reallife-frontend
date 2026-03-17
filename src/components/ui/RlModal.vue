<!-- src/components/ui/RlModal.vue -->
<template>
  <teleport to="body">
    <div
        v-if="open"
        class="modalBackdrop"
        @click.self="handleBackdrop"
    >
      <div class="modal rl-cardish" :class="{ 'modal--sheet': isMobileSheet }" role="dialog" aria-modal="true">
        <div v-if="isMobileSheet" class="mGrab" aria-hidden="true"></div>
        <div class="mTitle" v-if="title">{{ title }}</div>
        <div class="mSub" v-if="subtitle">{{ subtitle }}</div>

        <div class="mBody">
          <slot />
        </div>

        <div class="mActions" v-if="$slots.actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },

  // ✅ NEW: 로딩 중 닫기 방지
  blockClose: { type: Boolean, default: false },

  // ✅ NEW: 배경 클릭 닫기 on/off
  closeOnBackdrop: { type: Boolean, default: true },
});

const emit = defineEmits(["close"]);
const viewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1024);
const isMobileSheet = computed(() => viewportWidth.value <= 720);

function tryClose() {
  if (props.blockClose) return;
  emit("close");
}

function handleBackdrop() {
  if (!props.closeOnBackdrop) return;
  tryClose();
}

function onKeydown(e) {
  if (!props.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    tryClose();
  }
}

function onResize() {
  viewportWidth.value = typeof window !== "undefined" ? window.innerWidth : 1024;
}
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  onResize();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
});
</script>

<style scoped>
.modalBackdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 1000;
  display:grid;
  place-items:center;
  padding: 14px;
}
.rl-cardish{
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(14px);
}
.modal{
  width: 100%;
  max-width: 420px;
  border-radius: var(--r-lg);
  padding: 16px;
  max-height: min(86dvh, 720px);
  overflow: auto;
}
.mGrab{
  width: 54px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255,255,255,.18);
  margin: 0 auto 10px;
}
.mTitle{font-weight:950;font-size:16px}
.mSub{margin-top:6px;color:var(--muted);font-size:12px;line-height:1.45}
.mBody{margin-top:12px}
.mActions{display:flex;gap:8px;margin-top:12px}
@media (max-width: 720px){
  .modalBackdrop{
    place-items:end center;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
    background: rgba(0,0,0,.62);
    backdrop-filter: blur(8px);
  }
  .modal{
    max-width: 100%;
    border-radius: 24px 24px 18px 18px;
    padding: 14px;
    max-height: min(82dvh, 780px);
    overflow: auto;
    box-shadow: 0 24px 80px rgba(0,0,0,.38);
  }
  .modal--sheet{
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
  .mActions{
    position: sticky;
    bottom: calc(-14px - env(safe-area-inset-bottom));
    margin: 14px -14px calc(-14px - env(safe-area-inset-bottom));
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(11,16,30,0), rgba(11,16,30,.88) 28%, rgba(11,16,30,.98));
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
