<!-- src/components/AppHeader.vue -->
<template>
  <header class="header">
    <div class="left" @click="goHome" role="button" tabindex="0" @keydown.enter="goHome">
      <div class="brandMark" aria-hidden="true">
        <img :src="logo" alt="RealLife" class="brandImg" />
      </div>

      <div class="brandText">
        <div class="brandName">RealLife</div>
        <div class="brandSub">{{ subtitle }}</div>
      </div>
    </div>

    <nav class="desktopNav" aria-label="Desktop navigation">
      <button class="navBtn" :class="{ on: isSection('/home') }" type="button" @click="go('/home')">Home</button>
      <button class="navBtn" :class="{ on: isSection('/inbox') }" type="button" @click="go('/inbox')">Connect</button>
      <button class="navBtn" :class="{ on: isSection('/me') }" type="button" @click="go('/me')">Me</button>
    </nav>

    <div class="right">
      <button
        class="inboxEntry"
        :class="{ inboxEntryActive: isSection('/inbox'), inboxEntryUnread: totalUnread > 0 }"
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
  subtitle: { type: String, default: "Real-time social" },
  live: { type: Boolean, default: false },
});

const conversationsUnread = computed(() =>
  (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
);
const totalUnread = computed(() => Number(noti.unreadCount || 0) + conversationsUnread.value);
const unreadBadge = computed(() => {
  const n = totalUnread.value;
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
});

function go(path) {
  if (route.path === path) return;
  router.push(path);
}
function goHome() { go('/home'); }
function goInbox() { go('/inbox'); }
function isSection(path) { return route.path.startsWith(path); }

onMounted(() => {
  if (!noti.loading && !(noti.items || []).length) noti.refresh?.();
  if (!conv.loading && !(conv.items || []).length) conv.refresh?.();
});
</script>

<style scoped>
.header{
  position: sticky;
  top: 0;
  z-index: 80;
  display:grid;
  grid-template-columns: minmax(0, auto) 1fr minmax(0, auto);
  align-items:center;
  gap: 18px;
  padding: 12px 18px 10px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, rgba(6,10,24,.96), rgba(6,10,24,.84));
  backdrop-filter: blur(18px);
}
.left{
  display:flex;
  align-items:center;
  gap: 10px;
  min-width: 0;
  cursor:pointer;
}
.brandMark{
  width: 34px;
  height: 34px;
  border-radius: 12px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
  flex: 0 0 auto;
}
.brandImg{ width:100%; height:100%; display:block; object-fit:cover; }
.brandText{ min-width:0; }
.brandName{ font-size: 17px; font-weight: 950; letter-spacing: -.02em; }
.brandSub{ margin-top: 2px; font-size: 11.5px; color: rgba(255,255,255,.66); }

.desktopNav{
  justify-self: center;
  display:flex;
  align-items:center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
}
.navBtn{
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255,255,255,.78);
  font-size: 12px;
  font-weight: 850;
  cursor:pointer;
  transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
}
.navBtn:hover{ transform: translateY(-1px); color: rgba(255,255,255,.94); }
.navBtn.on{
  color: rgba(255,255,255,.98);
  background: color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.04));
  border-color: color-mix(in oklab, var(--accent) 38%, rgba(255,255,255,.12));
}

.right{ display:flex; align-items:center; justify-self:end; gap:10px; }
.inboxEntry{
  position:relative;
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: rgba(255,255,255,.94);
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-weight: 850;
  cursor:pointer;
}
.inboxEntryActive{ background: rgba(255,255,255,.06); }
.inboxIcon{ width: 16px; height: 16px; display:inline-flex; }
.inboxIcon svg{ width:100%; height:100%; }
.inboxText{ font-size: 12px; }
.inboxBadge{
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 72%, white);
  color: #0b1020;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size: 10px;
  font-weight: 950;
}
.live{
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(118, 221, 172, .28);
  background: rgba(6, 12, 20, .62);
  color: rgba(255,255,255,.94);
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-size: 12px;
  font-weight: 900;
}
.live .dot{
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ddc97;
  box-shadow: 0 0 0 6px rgba(61,220,151,.12);
}
.live[data-on="false"] .dot{
  background: rgba(255,255,255,.42);
  box-shadow: none;
}

@media (max-width: 980px){
  .header{
    gap: 12px;
    padding: 12px 12px 9px;
    grid-template-columns: minmax(0, auto) 1fr auto;
  }
  .desktopNav{ display:none; }
}

@media (max-width: 640px){
  .brandSub{ font-size: 11px; }
  .inboxText{ display:none; }
  .inboxEntry{ width: 38px; padding: 0; justify-content:center; }
  .inboxBadge{
    position: absolute;
    right: -2px;
    top: -3px;
  }
}
</style>
