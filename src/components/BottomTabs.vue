<!-- src/components/BottomTabs.vue -->
<script setup>
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const noti = useNotificationsStore();
const conv = useConversationsStore();
const auth = useAuthStore();

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

const profileReady = computed(() => {
  const me = auth.me || {};
  const name = String(me?.name || "").trim();
  const handle = String(me?.handle || "").trim();
  const bio = String(me?.bio || "").trim();
  return Boolean((name || handle) && bio);
});

function tabMeta(to) {
  if (to === "/home") {
    return isActive("/home") ? "오늘 흐름" : "새 글 보기";
  }
  if (to === "/inbox") {
    if (totalUnread.value > 0) return `답장·알림 ${inboxBadge.value}`;
    return isActive("/inbox") ? "대화·알림" : "연결 이어가기";
  }
  if (to === "/me") {
    if (!profileReady.value) return "프로필 보강";
    return isActive("/me") ? "내 흐름" : "내 정보";
  }
  return "";
}

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
      <span class="activeRail" aria-hidden="true"></span>

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

      <span class="labelGroup">
        <span class="lbl">{{ t.label }}</span>
        <span class="meta">{{ tabMeta(t.to) }}</span>
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
  display: flex;
  justify-content: space-around;
  align-items: stretch;
  gap: 8px;
  padding: 10px 10px 12px;
  border-top: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  backdrop-filter: blur(20px);
}

.tab {
  position: relative;
  flex: 1;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: rgba(232, 232, 234, 0.48);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  padding: 8px 4px;
}

.tabUnread .lbl {
  opacity: 0.9;
}

.activeRail {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.18s ease;
}

.ico {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.18s ease;
}

.ico svg {
  width: 24px;
  height: 24px;
}

.dot {
  position: absolute;
  right: -1px;
  top: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 0 6px rgba(255, 209, 102, 0.12);
}

.badge {
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
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.18);
}

.labelGroup {
  display: grid;
  gap: 2px;
  text-align: center;
}

.lbl {
  font-size: 10px;
  letter-spacing: 0.4px;
  opacity: 0.76;
  font-weight: 900;
}

.meta {
  font-size: 9px;
  line-height: 1.2;
  color: rgba(232, 232, 234, 0.5);
  white-space: normal;
  min-height: 18px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.active {
  color: rgba(232, 232, 234, 0.98);
}

.active .activeRail {
  border-color: color-mix(in oklab, var(--accent) 28%, rgba(255, 255, 255, 0.14));
  background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 12%, rgba(255,255,255,0.04)), rgba(255,255,255,0.02));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 10px 20px rgba(0,0,0,.16);
}

.active .ico {
  transform: translateY(-1px);
}

.active .lbl {
  opacity: 1;
}

.active .meta {
  color: rgba(232, 232, 234, 0.72);
}

@media (min-width: 1024px) {
  .tabs {
    display: none;
  }
}

@media (max-width: 640px) {
  .tabs {
    padding: 8px 8px 10px;
    gap: 6px;
  }

  .tab {
    gap: 5px;
    border-radius: 16px;
    padding: 7px 3px;
  }

  .activeRail {
    border-radius: 16px;
  }

  .ico {
    width: 26px;
    height: 26px;
  }

  .ico svg {
    width: 22px;
    height: 22px;
  }

  .badge {
    min-width: 16px;
    height: 16px;
    right: -7px;
    top: -7px;
    font-size: 9px;
  }

  .lbl {
    font-size: 9px;
  }

  .meta {
    font-size: 8px;
  }
}
</style>