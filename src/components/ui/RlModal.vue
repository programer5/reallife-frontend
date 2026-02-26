<!-- src/components/ui/RlModal.vue -->
<template>
  <teleport to="body">
    <div
        v-if="open"
        class="modalBackdrop"
        @click.self="handleBackdrop"
    >
      <div class="modal rl-cardish" role="dialog" aria-modal="true">
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
import { onBeforeUnmount, onMounted } from "vue";

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

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
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
}
.mTitle{font-weight:950;font-size:16px}
.mSub{margin-top:6px;color:var(--muted);font-size:12px}
.mBody{margin-top:12px}
.mActions{display:flex;gap:8px;margin-top:12px}
</style>