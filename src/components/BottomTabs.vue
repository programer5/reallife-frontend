<script setup>
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const tabs = [
  { to: '/inbox', label: '인박스', icon: 'inbox' },
  { to: '/home', label: '홈', icon: 'home' },
  { to: '/search', label: '탐색', icon: 'search' },
  { to: '/me', label: '내페이지', icon: 'user' },
]

const isActive = (to) => route.path.startsWith(to)
const go = (to) => router.push(to)

const Icon = {
  home: `<path d="M4 10.5 12 4l8 6.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-9.5Z" stroke="currentColor" stroke-width="1.7" fill="none" />`,
  inbox: `<path d="M4 4h16v12h-5l-2 3h-2l-2-3H4V4Z" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M7 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  search: `<path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
  user: `<path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
}
</script>

<template>
  <nav class="tabs">
    <button
        v-for="t in tabs"
        :key="t.to"
        class="tab"
        :class="{ active: isActive(t.to) }"
        @click="go(t.to)"
        type="button"
    >
      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" v-html="Icon[t.icon]" />
      </span>
      <span class="lbl">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabs{
  height: 64px;
  position: sticky;
  bottom: 0;
  z-index: 50;
  display:flex;
  justify-content:space-around;
  align-items:center;
  padding: 8px 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.60);
  backdrop-filter: blur(14px);
}

.tab{
  width: 25%;
  border: 0;
  background: transparent;
  color: rgba(232,232,234,0.65);
  display:flex;
  flex-direction:column;
  align-items:center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 0;
}

.ico{ width: 24px; height: 24px; display:flex; align-items:center; justify-content:center; }
.ico svg{ width: 22px; height: 22px; }

.lbl{
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .2px;
}

.active{ color: rgba(232,232,234,0.95); }
.active .ico{ filter: drop-shadow(0 10px 24px rgba(75,92,255,0.25)); }
</style>