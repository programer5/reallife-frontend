<!-- src/components/ToastHost.vue -->
<template>
  <div class="toast-host" aria-live="polite" aria-relevant="additions">
    <div
        v-for="t in toast.items"
        :key="t.id"
        class="toast"
        :data-type="t.type"
        role="status"
    >
      <div class="toast__text">
        <div class="toast__title">{{ t.title }}</div>
        <div v-if="t.message" class="toast__msg">{{ t.message }}</div>
      </div>
      <button class="toast__x" @click="toast.dismiss(t.id)" aria-label="Close toast">
        ✕
      </button>
    </div>
  </div>
</template>

<script setup>
import { useToastStore } from "../stores/toast";
const toast = useToastStore();
</script>

<style scoped>
.toast-host {
  position: fixed;
  right: 14px;
  bottom: 70px;
  display: grid;
  gap: 10px;
  z-index: 1000;
  width: min(360px, calc(100vw - 28px));
}

.toast {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  padding: 12px 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
}

.toast__title {
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.2px;
}

.toast__msg {
  margin-top: 4px;
  font-size: 12.5px;
  opacity: 0.88;
  line-height: 1.35;
}

.toast__x {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  background: transparent;
  color: var(--text);
  opacity: 0.9;
}

.toast[data-type="success"] {
  border-color: color-mix(in oklab, var(--success) 50%, var(--border));
}
.toast[data-type="error"] {
  border-color: color-mix(in oklab, var(--danger) 55%, var(--border));
}
.toast[data-type="info"] {
  border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
}
</style>