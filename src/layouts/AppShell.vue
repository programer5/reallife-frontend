<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const title = computed(() => {
  const p = route.path
  if (p.startsWith('/inbox')) return 'Inbox'
  if (p.startsWith('/home')) return 'Home'
  if (p.startsWith('/search')) return 'Search'
  if (p.startsWith('/me')) return 'Me'
  return 'App'
})

const tabs = [
  { key: 'inbox', label: '인박스', path: '/inbox' },
  { key: 'home', label: '홈', path: '/home' },
  { key: 'search', label: '탐색', path: '/search' },
  { key: 'me', label: '내페이지', path: '/me' },
]

const isActive = (path) => route.path.startsWith(path)
const go = (path) => router.push(path)
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar__title">{{ title }}</div>
      <div class="topbar__actions">
        <!-- 다음 단계에서: SSE 연결상태/뱃지/빠른검색 등 붙일 자리 -->
        <button class="ghost" @click="go('/search')">검색</button>
      </div>
    </header>

    <main class="content">
      <router-view />
    </main>

    <nav class="tabbar">
      <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: isActive(t.path) }"
          @click="go(t.path)"
      >
        <div class="tab__label">{{ t.label }}</div>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 56px 1fr 64px;
  background: #0b0c10;
  color: #e8e8ea;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(11, 12, 16, 0.9);
  backdrop-filter: blur(10px);
}

.topbar__title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.topbar__actions {
  display: flex;
  gap: 8px;
}

.ghost {
  background: transparent;
  color: #e8e8ea;
  border: 1px solid rgba(255,255,255,0.14);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
}

.content {
  padding: 14px;
  overflow: auto;
}

.tabbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(11, 12, 16, 0.95);
}

.tab {
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(232,232,234,0.65);
  cursor: pointer;
  padding: 10px 8px;
}

.tab.active {
  color: #ffffff;
}

.tab__label {
  font-size: 13px;
  font-weight: 650;
}
</style>