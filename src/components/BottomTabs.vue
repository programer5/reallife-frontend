<!-- src/components/BottomTabs.vue -->
<script setup>
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";
import { useNotificationsStore } from "@/stores/notifications";

const route = useRoute();
const router = useRouter();
const noti = useNotificationsStore();

const tabs = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/inbox", label: "Connect", icon: "message" },
  { to: "/me", label: "Me", icon: "user" },
];

const isActive = (to) => route.path.startsWith(to);
const go = (to) => router.push(to);

const showInboxDot = computed(() => noti.hasUnread);
</script>

<template>
  <nav class="tabs" aria-label="Bottom navigation">
    <button
        v-for="t in tabs"
        :key="t.to"
        class="tab"
        :class="{ active: isActive(t.to) }"
        @click="go(t.to)"
        type="button"
    >
      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <template v-if="t.icon === 'compass'">
            <path d="M12 4l6 6-4 8-8-4 6-10Z" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
          <template v-else-if="t.icon === 'home'">
            <path d="M4 10.5 12 4l8 6.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-9.5Z" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
          <template v-else-if="t.icon === 'message'">
            <path d="M4 4h16v12H7l-3 3V4Z" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
          <template v-else>
            <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="1.7" fill="none"/>
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
        </svg>

        <!-- inbox unread dot -->
        <span v-if="t.to === '/inbox' && showInboxDot" class="dot" aria-hidden="true"></span>
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
  border-top: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
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
  position: relative;
  transition: all .18s ease;
}

.ico svg{
  width:24px;
  height:24px;
}

.dot{
  position:absolute;
  right: 2px;
  top: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 6px rgba(255, 209, 102, 0.12);
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
  transform: translateY(-1px);
}
</style>