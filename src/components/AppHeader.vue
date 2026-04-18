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
        </div>
      </div>

      <nav class="desktopNav" aria-label="Primary">
        <button class="navPill" :class="{ on: route.path.startsWith('/home') }" type="button" @click="router.push('/home')">
          <span>Home</span>
        </button>
        <button class="navPill" :class="{ on: route.path.startsWith('/search') }" type="button" @click="router.push('/search')">
          <span>Search</span>
        </button>
        <button class="navPill" :class="{ on: route.path.startsWith('/inbox') || route.path.startsWith('/conversations') }" type="button" @click="router.push('/inbox')">
          <span>Connect</span>
          <small v-if="totalUnread > 0">{{ unreadBadge }}</small>
        </button>
        <button class="navPill" :class="{ on: route.path.startsWith('/me') || route.path.startsWith('/u/') }" type="button" @click="router.push('/me')">
          <span>Me</span>
        </button>
      </nav>

      <div class="right">
        <button class="helpEntry" :class="{ helpEntryActive: route.path.startsWith('/help') }" type="button" @click="goHelp" aria-label="이용 가이드 열기">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/>
            <path d="M9.9 9.2a2.5 2.5 0 1 1 4.2 1.9c-.9.7-1.6 1.2-1.6 2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="12" cy="17.2" r="1" fill="currentColor"/>
          </svg>
          <span>Help</span>
        </button>

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
          {{ live ? 'LIVE' : 'OFFLINE' }}
        </span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotificationsStore } from '@/stores/notifications';
import { useConversationsStore } from '@/stores/conversations';
import logo from '@/assets/brand/logo.png';

const router = useRouter();
const route = useRoute();
const noti = useNotificationsStore();
const conv = useConversationsStore();

const { live } = defineProps({
  live: { type: Boolean, default: false },
});

const totalUnread = computed(() => Number(noti.unreadCount || 0) + (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0));
const unreadBadge = computed(() => {
  const n = totalUnread.value;
  if (n > 99) return '99+';
  return String(n);
});

function goHome() {
  router.push('/home');
}

function goInbox() {
  router.push('/inbox');
}

function goHelp() {
  router.push('/help');
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
  background: color-mix(in oklab, var(--surface) 90%, transparent);
  backdrop-filter: blur(18px);
}

.headerInner {
  max-width: 1520px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 16px;
}

.left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.brandMark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
}

.brandImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brandText {
  min-width: 0;
}

.brandName {
  font-size: 18px;
  font-weight: 950;
  letter-spacing: .02em;
}

.desktopNav {
  display: none;
  align-items: center;
  gap: 10px;
}

.navPill,
.helpEntry,
.inboxEntry {
  min-height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.045);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  font-weight: 900;
  cursor: pointer;
}

.navPill small {
  font-size: 11px;
  opacity: .9;
}

.navPill.on,
.helpEntryActive,
.inboxEntryActive {
  background: color-mix(in oklab, var(--accent) 16%, rgba(255,255,255,.05));
  border-color: color-mix(in oklab, var(--accent) 32%, rgba(255,255,255,.12));
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.helpEntry svg,
.inboxIcon svg {
  width: 18px;
  height: 18px;
}

.helpEntry span,
.inboxText {
  font-size: 13px;
}

.inboxEntry {
  position: relative;
}

.inboxBadge {
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
}

.live {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
  color: rgba(255,255,255,.68);
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.035);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255,255,255,.24);
}

.live[data-on="true"] .dot {
  background: #2ce0a2;
  box-shadow: 0 0 0 6px rgba(44,224,162,.12);
}

@media (min-width: 1024px) {
  .desktopNav {
    display: flex;
  }
}

@media (max-width: 720px) {
  .headerInner {
    padding: 10px 12px;
    gap: 10px;
  }

  .brandMark {
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }

  .brandName {
    font-size: 16px;
  }

  .helpEntry span,
  .inboxText,
  .live {
    display: none;
  }

  .helpEntry,
  .inboxEntry,
  .live {
    min-width: 40px;
    padding: 0 10px;
  }
}
</style>
