<!-- src/components/AppHeader.vue -->
<template>
  <header class="header">
    <div class="left" @click="goHome" role="button" tabindex="0" @keydown.enter="goHome">
      <div class="brandMark" aria-hidden="true">
        <img :src="logo" alt="RealLife" class="brandImg" />
      </div>

      <div class="brandText">
        <div class="brandName">RealLife</div>
        <div class="brandSub">{{ subtitle }}</div>
      </div>
    </div>

    <div class="right">
      <span class="live" :data-on="live">
        <span class="dot" aria-hidden="true"></span>
        {{ live ? "LIVE" : "OFFLINE" }}
      </span>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from "vue-router";
import logo from "@/assets/brand/logo.png";

const router = useRouter();

defineProps({
  subtitle: { type: String, default: "" },
  live: { type: Boolean, default: false },
});

function goHome() {
  router.push("/home");
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  backdrop-filter: blur(16px);
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brandMark {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface-2) 86%, transparent);
  display: grid;
  place-items: center;
}

.brandImg {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.brandText {
  display: grid;
  gap: 2px;
}

.brandName {
  font-weight: 950;
  letter-spacing: 0.2px;
}

.brandSub {
  font-size: 12px;
  color: var(--muted);
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 900;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 6px rgba(255, 107, 125, 0.12);
}

.live[data-on="true"] {
  border-color: color-mix(in oklab, var(--success) 55%, var(--border));
}
.live[data-on="true"] .dot {
  background: var(--success);
  box-shadow: 0 0 0 6px rgba(85, 227, 160, 0.14);
}
</style>