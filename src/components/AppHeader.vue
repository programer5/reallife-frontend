<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LogoMark from './LogoMark.vue'

const route = useRoute()

const title = computed(() => {
  const p = route.path
  if (p.startsWith('/inbox')) return 'Connect'
  if (p.startsWith('/home')) return 'Home'
  if (p.startsWith('/search')) return 'Explore'
  if (p.startsWith('/me')) return 'Me'
  return 'RealLife'
})
</script>

<template>
  <header class="header">
    <div class="brand">
      <LogoMark :size="34" :rounded="12" />
      <div class="brandText">
        <div class="brandName">RealLife</div>
        <div class="brandSub">{{ title }}</div>
      </div>
    </div>

    <button class="iconBtn" type="button" aria-label="search">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" stroke-width="1.7"/>
        <path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>
    </button>
  </header>
</template>

<style scoped>
.header{
  height: 56px;
  padding: 0 14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(14px);
}

.brand{ display:flex; align-items:center; gap:10px; }

.brandText{ display:flex; flex-direction:column; line-height:1.1; }
.brandName{ font-weight: 950; letter-spacing: .2px; }
.brandSub{ font-size: 12px; opacity: .65; margin-top: 2px; }

.iconBtn{
  width: 40px; height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  color: rgba(232,232,234,0.95);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer;
  transition: transform 120ms ease, opacity 120ms ease;
}
.iconBtn:hover{ transform: translateY(-1px); }
.iconBtn svg{ width: 20px; height: 20px; }
</style>