<!-- src/components/BottomTabs.vue -->
<script setup>
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";

const route = useRoute();
const router = useRouter();
const noti = useNotificationsStore();
const conv = useConversationsStore();

const tabs = [
  { to: "/home", label: "Home", icon: "home" },
  { to: "/search", label: "Search", icon: "search" },
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
      :aria-label="t.label"
      :title="t.label"
    >
      <span class="activeRail" aria-hidden="true"></span>

      <span class="ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <template v-if="t.icon === 'home'">
            <path d="M3.8 10.7 12 4l8.2 6.7" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.2 10.2V20h4.9v-5.4h3.8V20h4.9v-9.8" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
            <path v-if="isActive(t.to)" d="M9.9 20v-5.4h4.2V20" fill="currentColor" opacity="0.22"/>
          </template>
          <template v-else-if="t.icon === 'search'">
            <circle cx="10.8" cy="10.8" r="6.15" stroke="currentColor" stroke-width="1.9"/>
            <path d="M15.45 15.45 20 20" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
            <path v-if="isActive(t.to)" d="M10.8 7.25a3.55 3.55 0 1 0 0 7.1 3.55 3.55 0 0 0 0-7.1Z" fill="currentColor" opacity="0.16"/>
          </template>
          <template v-else-if="t.icon === 'message'">
            <path d="M4.5 5.2h15v11.05H8.45L4.5 19.7V5.2Z" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8.2 9.25h7.6M8.2 12.45h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path v-if="isActive(t.to)" d="M6.2 7.15h11.6v7.15H7.72L6.2 15.6V7.15Z" fill="currentColor" opacity="0.14"/>
          </template>
          <template v-else>
            <path d="M5.1 20.15c.7-3.55 3.35-5.65 6.9-5.65s6.2 2.1 6.9 5.65" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>
            <circle cx="12" cy="8.25" r="4.05" stroke="currentColor" stroke-width="1.85"/>
            <path v-if="isActive(t.to)" d="M12 11.05a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" fill="currentColor" opacity="0.16"/>
          </template>
        </svg>

        <span v-if="t.to === '/inbox' && showInboxDot" class="dot" aria-hidden="true"></span>
        <span v-if="t.to === '/inbox' && showInboxDot" class="badge">{{ inboxBadge }}</span>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.tabs {
  height: var(--app-bottombar-h);
  padding-bottom: calc(10px + var(--app-safe-bottom));
  position: sticky;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255,255,255,.08);
  background:
    radial-gradient(circle at 50% 0%, rgba(110, 145, 255, .16), transparent 44%),
    color-mix(in oklab, var(--surface) 90%, transparent);
  backdrop-filter: blur(22px);
}

.tab {
  position: relative;
  min-width: 0;
  height: 54px;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: rgba(232, 232, 234, 0.52);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s ease, color 0.18s ease;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.activeRail {
  position: absolute;
  inset: 5px 3px;
  border-radius: 20px;
  border: 1px solid transparent;
  background: transparent;
  opacity: 0;
  transition: all 0.2s ease;
}

.ico {
  width: 48px;
  height: 48px;
  border-radius: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
}

.ico svg {
  width: 25px;
  height: 25px;
  filter: drop-shadow(0 8px 18px rgba(0,0,0,.18));
}

.dot {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 5px rgba(255, 209, 102, 0.14);
}

.badge {
  position: absolute;
  right: -4px;
  top: -3px;
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
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.24);
}

.tab:hover,
.tab.active {
  color: var(--text);
}

.tab:active {
  transform: scale(.94);
}

.tab.active .activeRail {
  opacity: 1;
  border-color: color-mix(in oklab, var(--accent) 28%, transparent);
  background:
    linear-gradient(135deg, color-mix(in oklab, var(--accent) 24%, transparent), rgba(255,255,255,.035));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    0 12px 30px color-mix(in oklab, var(--accent) 18%, transparent);
}

.tab.active .ico {
  color: var(--text);
  transform: translateY(-2px) scale(1.05);
}

.tabUnread:not(.active) .ico {
  color: color-mix(in oklab, var(--accent) 58%, var(--text));
}

@media (min-width: 760px) {
  .tabs {
    max-width: 520px;
    margin: 0 auto;
    border-radius: 24px 24px 0 0;
    border-left: 1px solid rgba(255,255,255,.06);
    border-right: 1px solid rgba(255,255,255,.06);
  }
}

@media (max-width: 380px) {
  .tabs {
    gap: 4px;
    padding-left: 8px;
    padding-right: 8px;
  }

  .ico {
    width: 44px;
    height: 44px;
  }

  .ico svg {
    width: 23px;
    height: 23px;
  }
}
</style>
