<!-- src/components/BottomTabs.vue -->
<script setup>
import { useRoute, useRouter } from "vue-router";
import { computed, onMounted } from "vue";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";

const route = useRoute();
const router = useRouter();
const noti = useNotificationsStore();
const conv = useConversationsStore();

const tabs = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/inbox", label: "Connect", icon: "message" },
  { to: "/me", label: "Me", icon: "user" },
];

const isActive = (to) => route.path.startsWith(to);
const go = (to) => router.push(to);

const conversationsUnread = computed(() =>
  (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
);
const totalUnread = computed(() => Number(noti.unreadCount || 0) + conversationsUnread.value);
const inboxBadge = computed(() => {
  const n = totalUnread.value;
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
});
const showInboxDot = computed(() => totalUnread.value > 0);

onMounted(() => {
  if (!noti.loading && !(noti.items || []).length) noti.refresh?.();
  if (!conv.loading && !(conv.items || []).length) conv.refresh?.();
});
</script>

<template>
  <nav class="tabs" aria-label="Bottom navigation">
    <button
      v-for="t in tabs"
      :key="t.to"
      class="tab"
      :class="{ active: isActive(t.to), tabUnread: t.to === '/inbox' && showInboxDot }"
      @click="go(t.to)"
      type="button"
    >
      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <template v-if="t.icon === 'home'">
            <path d="M4 10.5 12 4l8 6.5V20a2 2 0 0 1-2 2h-4v-6H10v6H6a2 2 0 0 1-2-2v-9.5Z" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
          <template v-else-if="t.icon === 'message'">
            <path d="M4 4h16v12H7l-3 3V4Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
          </template>
          <template v-else>
            <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="1.7" fill="none"/>
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7" fill="none"/>
          </template>
        </svg>

        <span v-if="t.to === '/inbox' && showInboxDot" class="dot" aria-hidden="true"></span>
        <span v-if="t.to === '/inbox' && showInboxDot" class="badge">{{ inboxBadge }}</span>
      </span>

      <span class="lbl">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabs{
  height: var(--app-bottombar-h);
  padding-bottom: calc(12px + var(--app-safe-bottom));
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
.tabUnread .lbl{ opacity:.84; }

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
  right: -1px;
  top: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 6px rgba(255, 209, 102, 0.12);
}
.badge{
  position: absolute;
  right: -10px;
  top: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--accent) 72%, white);
  color: #0b1020;
  font-size: 10px;
  font-weight: 950;
  box-shadow: 0 8px 16px rgba(0,0,0,.18);
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
.active .lbl{ opacity: 1; }

@media (max-width: 640px) {
  .badge{
    min-width: 16px;
    height: 16px;
    right: -8px;
    top: -8px;
    font-size: 9px;
  }
}
</style>
