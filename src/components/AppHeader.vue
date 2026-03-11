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
          <div class="brandSub">{{ headerSubtitle }}</div>
        </div>
      </div>

      <nav class="desktopNav" aria-label="Primary">
        <button class="navPill" :class="{ on: route.path.startsWith('/home') }" type="button" @click="router.push('/home')">
          <span>Home</span>
          <small>오늘의 흐름</small>
        </button>
        <button class="navPill" :class="{ on: route.path.startsWith('/inbox') || route.path.startsWith('/conversations') }" type="button" @click="router.push('/inbox')">
          <span>Connect</span>
          <small>{{ totalUnread > 0 ? `답장·알림 ${unreadBadge}` : '대화와 알림' }}</small>
        </button>
        <button class="navPill" :class="{ on: route.path.startsWith('/me') || route.path.startsWith('/u/') }" type="button" @click="router.push('/me')">
          <span>Me</span>
          <small>{{ profileReady ? '내 흐름 점검' : '프로필 다듬기' }}</small>
        </button>
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
          <span class="inboxText">{{ totalUnread > 0 ? '지금 확인' : 'Inbox' }}</span>
          <span v-if="totalUnread > 0" class="inboxBadge">{{ unreadBadge }}</span>
        </button>

        <span class="live" :data-on="live">
          <span class="dot" aria-hidden="true"></span>
          {{ live ? 'LIVE' : 'OFFLINE' }}
        </span>
      </div>
    </div>

    <div v-if="showFocus" class="focusBar desktopFocusBar">
      <div class="focusCard">
        <span class="focusLabel">지금 먼저 볼 것</span>
        <strong>{{ sectionMeta.primary }}</strong>
      </div>
      <div class="focusCard">
        <span class="focusLabel">왜 지금 중요한가</span>
        <strong>{{ sectionMeta.reason }}</strong>
      </div>
      <div class="focusCard focusCard--accent">
        <span class="focusLabel">어디로 이어지나</span>
        <strong>{{ sectionMeta.next }}</strong>
      </div>
    </div>

    <div v-if="showFocus" class="mobileFocusWrap">
      <div class="mobileFocusCard">
        <div class="mobileFocusRow">
          <span class="focusLabel">지금 먼저 볼 것</span>
          <strong>{{ sectionMeta.primary }}</strong>
        </div>
        <div class="mobileFocusDivider"></div>
        <div class="mobileFocusRow">
          <span class="focusLabel">왜 지금 중요한가</span>
          <strong>{{ sectionMeta.reason }}</strong>
        </div>
        <div class="mobileFocusDivider"></div>
        <div class="mobileFocusRow mobileFocusRow--accent">
          <span class="focusLabel">어디로 이어지나</span>
          <strong>{{ sectionMeta.next }}</strong>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotificationsStore } from '@/stores/notifications';
import { useConversationsStore } from '@/stores/conversations';
import { useAuthStore } from '@/stores/auth';
import logo from '@/assets/brand/logo.png';

const router = useRouter();
const route = useRoute();
const noti = useNotificationsStore();
const conv = useConversationsStore();
const auth = useAuthStore();

const props = defineProps({
  subtitle: { type: String, default: '' },
  live: { type: Boolean, default: false },
});

const conversationsUnread = computed(() =>
  (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0),
);
const totalUnread = computed(() => Number(noti.unreadCount || 0) + conversationsUnread.value);
const unreadBadge = computed(() => {
  const n = totalUnread.value;
  if (n > 99) return '99+';
  return String(n);
});

const profileReady = computed(() => {
  const me = auth.me || {};
  const name = String(me?.name || '').trim();
  const handle = String(me?.handle || '').trim();
  const bio = String(me?.bio || '').trim();
  return Boolean((name || handle) && bio);
});

const headerSubtitle = computed(() => {
  if (route.path.startsWith('/home')) return '오늘의 흐름과 액션을 바로 잇는 홈';
  if (route.path.startsWith('/inbox')) {
    return totalUnread.value > 0
      ? '답장과 알림을 놓치지 않는 Connect'
      : '대화와 알림을 정리하는 Connect';
  }
  if (route.path.startsWith('/me')) {
    return profileReady.value
      ? '내 프로필과 다음 흐름을 다듬는 공간'
      : '내 프로필을 완성하고 다음 흐름을 준비하는 공간';
  }
  if (route.path.startsWith('/u/')) return '서로의 흐름을 보고 연결을 넓히는 프로필';
  return props.subtitle || 'Real-time social';
});

const showFocus = computed(() => {
  const name = String(route.name || '');
  return ['home', 'inbox', 'conversations', 'me', 'admin-dashboard'].includes(name);
});

const sectionMeta = computed(() => {
  if (route.path.startsWith('/inbox')) {
    if (totalUnread.value > 0) {
      return {
        primary: `답장·알림 ${unreadBadge.value}개`,
        reason: '놓치면 대화 흐름과 리마인더가 끊길 수 있어요',
        next: '인박스에서 바로 열고 대화나 액션으로 이어가기',
      };
    }
    return {
      primary: '대화와 알림 흐름 점검',
      reason: '새 메시지가 없어도 다음 약속과 할일을 정리할 수 있어요',
      next: '인박스에서 최근 흐름 다시 이어가기',
    };
  }

  if (route.path.startsWith('/me')) {
    return {
      primary: profileReady.value ? '내 프로필과 공개 흐름 정리' : '프로필 기본 정보 보강',
      reason: profileReady.value
        ? '연결될 때 나를 더 빠르게 이해할 수 있어요'
        : '프로필이 정리되면 대화와 연결 전환이 더 자연스러워져요',
      next: profileReady.value ? '프로필 수정 또는 공개 프로필 확인' : '프로필 편집으로 바로 이동',
    };
  }

  if (route.path.startsWith('/u/')) {
    return {
      primary: '상대 흐름 빠르게 읽기',
      reason: '피드와 프로필을 같이 보면 더 자연스럽게 말을 걸 수 있어요',
      next: '댓글, 팔로우, 대화 시작으로 이어가기',
    };
  }

  return {
    primary: '오늘의 순간과 액션 흐름',
    reason: '반응이 쌓이는 글을 먼저 보면 실제 행동으로 이어지기 쉬워요',
    next: '홈에서 댓글 → 액션 → 대화로 바로 연결하기',
  };
});

function goHome() {
  router.push('/home');
}

function goInbox() {
  router.push('/inbox');
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
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
}

.brandImg {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.brandText {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.brandName {
  font-weight: 950;
  letter-spacing: 0.2px;
}

.brandSub {
  font-size: 12px;
  color: var(--muted);
}

.desktopNav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.navPill {
  min-width: 112px;
  min-height: 40px;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.82);
  display: grid;
  gap: 2px;
  text-align: left;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.navPill small {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.56);
  font-weight: 700;
}

.navPill:hover {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--accent) 22%, rgba(255, 255, 255, 0.12));
}

.navPill.on {
  background: color-mix(in oklab, var(--accent) 16%, rgba(255, 255, 255, 0.06));
  border-color: color-mix(in oklab, var(--accent) 32%, rgba(255, 255, 255, 0.14));
  color: rgba(255, 255, 255, 0.98);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.navPill.on small {
  color: rgba(255, 255, 255, 0.72);
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.inboxEntry {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 82%, transparent);
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.inboxEntry:hover {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--accent) 26%, var(--border));
  background: color-mix(in oklab, var(--surface) 76%, transparent);
}

.inboxEntryActive {
  border-color: color-mix(in oklab, var(--accent) 34%, var(--border));
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.inboxEntryUnread {
  border-color: color-mix(in oklab, var(--accent) 38%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 16%, transparent) inset;
}

.inboxIcon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.inboxIcon svg {
  width: 16px;
  height: 16px;
}

.inboxText {
  white-space: nowrap;
}

.inboxBadge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--accent) 72%, white);
  color: #0b1020;
  font-size: 11px;
  font-weight: 950;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 900;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 6px rgba(255, 107, 125, 0.12);
}

.live[data-on='true'] {
  border-color: color-mix(in oklab, var(--success) 55%, var(--border));
}

.live[data-on='true'] .dot {
  background: var(--success);
  box-shadow: 0 0 0 6px rgba(85, 227, 160, 0.14);
}

.focusBar {
  max-width: 1520px;
  margin: 0 auto;
  padding: 0 16px 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.focusCard {
  min-width: 0;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
  padding: 11px 13px;
  display: grid;
  gap: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.focusCard--accent {
  border-color: color-mix(in oklab, var(--accent) 28%, rgba(255, 255, 255, 0.1));
  background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 10%, rgba(255,255,255,0.03)), rgba(255,255,255,0.02));
}

.focusLabel {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
}

.focusCard strong {
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.96);
}

.mobileFocusWrap {
  display: none;
}

@media (max-width: 980px) {
  .desktopNav {
    display: none;
  }
}

@media (max-width: 880px) {
  .headerInner {
    padding: 12px 12px 9px;
  }

  .focusBar {
    padding: 0 12px 10px;
  }
}

@media (max-width: 640px) {
  .desktopFocusBar {
    display: none;
  }

  .mobileFocusWrap {
    display: block;
    padding: 0 12px 10px;
  }

  .mobileFocusCard {
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .mobileFocusRow {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
  }

  .mobileFocusRow strong {
    font-size: 12px;
    line-height: 1.42;
    color: rgba(255, 255, 255, 0.96);
  }

  .mobileFocusRow--accent {
    background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 10%, rgba(255,255,255,0.03)), rgba(255,255,255,0.01));
  }

  .mobileFocusDivider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .brandSub {
    font-size: 11px;
  }

  .inboxText {
    display: none;
  }

  .inboxEntry {
    width: 38px;
    padding: 0;
    justify-content: center;
  }

  .inboxBadge {
    position: absolute;
    right: -2px;
    top: -3px;
    min-width: 17px;
    height: 17px;
    font-size: 10px;
    padding: 0 4px;
  }
}
</style>
