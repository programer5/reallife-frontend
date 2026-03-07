<!-- src/components/AppHeader.vue -->
<template>
  <header class="header">
    <div class="headerInner">
      <div class="left" @click="goHome" role="button" tabindex="0" @keydown.enter="goHome">
        <div class="brandMark" aria-hidden="true">
          <img :src="logo" alt="RealLife" class="brandImg" />
        </div>

        <div class="brandText">
          <div class="brandName">RealLife</div>
          <div class="brandSub">{{ subtitle }}</div>
        </div>
      </div>

      <nav class="desktopNav" aria-label="Primary">
        <button class="navPill" :class="{ on: route.path.startsWith('/home') }" type="button" @click="router.push('/home')">Home</button>
        <button class="navPill" :class="{ on: route.path.startsWith('/inbox') || route.path.startsWith('/conversations') }" type="button" @click="router.push('/inbox')">Connect</button>
        <button class="navPill" :class="{ on: route.path.startsWith('/me') || route.path.startsWith('/u/') }" type="button" @click="router.push('/me')">Me</button>
      </nav>

      <div class="right">
        <button
          class="inboxEntry"
          :class="{ inboxEntryActive: route.path.startsWith('/inbox'), inboxEntryUnread: totalUnread > 0 }"
          type="button"
          @click="goInbox"
          aria-label="Inbox 열기"
        >
          <span class="inboxIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 5h16v10H7l-3 3V5Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="inboxText">Inbox</span>
          <span v-if="totalUnread > 0" class="inboxBadge">{{ unreadBadge }}</span>
        </button>

        <span class="live" :data-on="live">
          <span class="dot" aria-hidden="true"></span>
          {{ live ? "LIVE" : "OFFLINE" }}
        </span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";
import logo from "@/assets/brand/logo.png";

const router = useRouter();
const route = useRoute();
const noti = useNotificationsStore();
const conv = useConversationsStore();

const props = defineProps({
  subtitle: { type: String, default: "" },
  live: { type: Boolean, default: false },
});

const conversationsUnread = computed(() =>
  (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
);
const totalUnread = computed(() => Number(noti.unreadCount || 0) + conversationsUnread.value);
const unreadBadge = computed(() => {
  const n = totalUnread.value;
  if (n > 99) return "99+";
  return String(n);
});

function goHome() {
  router.push("/home");
}
function goInbox() {
  router.push("/inbox");
}

onMounted(() => {
  if (!noti.loading && !(noti.items || []).length) noti.refresh?.();
  if (!conv.loading && !(conv.items || []).length) conv.refresh?.();
});
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 60;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  backdrop-filter: blur(16px);
}
.headerInner{
  max-width: 1520px;
  margin: 0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 18px;
  padding: 12px 16px 10px;
}
.left {
  min-width: 0;
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
.brandImg { width: 26px; height: 26px; object-fit: contain; }
.brandText { min-width: 0; display: grid; gap: 2px; }
.brandName { font-weight: 950; letter-spacing: 0.2px; }
.brandSub { font-size: 12px; color: var(--muted); }
.desktopNav{display:flex;align-items:center;gap:8px;flex:1;justify-content:center}
.navPill{
  height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.03);color:rgba(255,255,255,.82);font-size:12px;font-weight:900;cursor:pointer;
}
.navPill.on{background:color-mix(in oklab,var(--accent) 16%, rgba(255,255,255,.06));border-color:color-mix(in oklab,var(--accent) 32%, rgba(255,255,255,.14));color:rgba(255,255,255,.96)}
.right { display: flex; align-items: center; gap: 10px; }
.inboxEntry {
  position: relative; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px;
  border-radius: 999px; border: 1px solid var(--border); background: color-mix(in oklab, var(--surface) 82%, transparent);
  color: var(--text); font-size: 12px; font-weight: 900; transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.inboxEntry:hover { transform: translateY(-1px); border-color: color-mix(in oklab, var(--accent) 26%, var(--border)); background: color-mix(in oklab, var(--surface) 76%, transparent); }
.inboxEntryActive { border-color: color-mix(in oklab, var(--accent) 34%, var(--border)); box-shadow: 0 10px 22px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.05); }
.inboxEntryUnread { border-color: color-mix(in oklab, var(--accent) 38%, var(--border)); box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 16%, transparent) inset; }
.inboxIcon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; }
.inboxIcon svg { width: 16px; height: 16px; }
.inboxText { white-space: nowrap; }
.inboxBadge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in oklab, var(--accent) 72%, white); color: #0b1020; font-size: 11px; font-weight: 950; box-shadow: 0 6px 14px rgba(0,0,0,.22); }
.live { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; padding: 8px 10px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in oklab, var(--surface) 80%, transparent); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 6px rgba(255, 107, 125, 0.12); }
.live[data-on="true"] { border-color: color-mix(in oklab, var(--success) 55%, var(--border)); }
.live[data-on="true"] .dot { background: var(--success); box-shadow: 0 0 0 6px rgba(85, 227, 160, 0.14); }

@media (max-width: 880px) {
  .desktopNav{display:none}
  .headerInner{padding:12px 12px 9px}
}
@media (max-width: 640px) {
  .brandSub { font-size: 11px; }
  .inboxText { display: none; }
  .inboxEntry { width: 38px; padding: 0; justify-content: center; }
  .inboxBadge { position: absolute; right: -2px; top: -3px; min-width: 17px; height: 17px; font-size: 10px; padding: 0 4px; }
}
</style>
