<template>
  <span class="rl-badge" :class="`rl-badge--${tone}`">
    <slot />
  </span>
</template>

<script setup>
defineProps({
  tone: { type: String, default: "neutral" }, // neutral | brand | success | warn | danger
});
</script>

<style scoped>
.rl-badge{
  display:inline-flex;
  align-items:center;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: .2px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--muted);
}
.rl-badge--brand{
  border-color: rgba(122,92,255,.45);
  background: rgba(122,92,255,.14);
  color: rgba(232,229,255,.95);
}
.rl-badge--success{
  border-color: rgba(34,197,94,.45);
  background: rgba(34,197,94,.14);
  color: rgba(220,255,235,.95);
}
.rl-badge--warn{
  border-color: rgba(245,158,11,.45);
  background: rgba(245,158,11,.14);
  color: rgba(255,245,225,.95);
}
.rl-badge--danger{
  border-color: rgba(239,68,68,.45);
  background: rgba(239,68,68,.14);
  color: rgba(255,230,230,.95);
}
</style>