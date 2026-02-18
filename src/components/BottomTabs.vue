<script setup>
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const tabs = [
  { to: '/search', label: 'Explore', icon: 'compass' },
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/inbox', label: 'Connect', icon: 'message' },
  { to: '/me', label: 'Me', icon: 'user' },
]

const isActive = (to) => route.path.startsWith(to)
const go = (to) => router.push(to)

const Icon = {
  compass: `<path d="M12 4l6 6-4 8-8-4 6-10Z" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
  home: `<path d="M4 10.5 12 4l8 6.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-9.5Z" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
  message: `<path d="M4 4h16v12H7l-3 3V4Z" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
  user: `<path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="1.7" fill="none"/><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/>`,
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
  height:72px;
  position: sticky;
  bottom: 0;
  z-index: 50;
  display:flex;
  justify-content:space-around;
  align-items:center;
  padding:10px 10px 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(20px);
}

.tab{
  width:25%;
  border:0;
  background:transparent;
  color: rgba(232,232,234,0.45);
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:6px;
  cursor:pointer;
  transition: all .18s ease;
}

.ico{
  width:28px;
  height:28px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition: all .18s ease;
}

.ico svg{
  width:24px;
  height:24px;
}

.lbl{
  font-size:10px;
  letter-spacing:.4px;
  opacity:.7;
}

.active{
  color: rgba(232,232,234,0.98);
}

.active .ico{
  transform: translateY(-2px) scale(1.12);
  filter: drop-shadow(0 8px 18px rgba(110,120,255,0.35));
}

.active .lbl{
  opacity:1;
}
</style>