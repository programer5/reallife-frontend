<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readNotification } from "@/api/notifications";
import { useRouter } from "vue-router";

const router = useRouter();
const noti = useNotificationsStore();
const inboxFilter = ref("ALL");
const sentinelEl = ref(null);
let io = null;

const items = computed(() => noti.items || []);
const unreadCount = computed(() => Number(noti.unreadCount || 0));
const loading = computed(() => noti.loading);
const loadingMore = computed(() => noti.loadingMore);
const hasNext = computed(() => noti.hasNext);
const error = computed(() => noti.error);

const reminderItems = computed(() => items.value.filter((n) => categoryOf(n) === "REMINDER"));
const messageItems = computed(() => items.value.filter((n) => categoryOf(n) === "MESSAGE"));
const commentItems = computed(() => items.value.filter((n) => categoryOf(n) === "COMMENT"));
const reactionItems = computed(() => items.value.filter((n) => categoryOf(n) === "REACTION"));
const actionItems = computed(() => items.value.filter((n) => categoryOf(n) === "ACTION"));

const filteredItems = computed(() => {
  switch (inboxFilter.value) {
    case "REMINDER": return reminderItems.value;
    case "MESSAGE": return messageItems.value;
    case "COMMENT": return commentItems.value;
    case "REACTION": return reactionItems.value;
    case "ACTION": return actionItems.value;
    default: return items.value;
  }
});

const filterChips = computed(() => ([
  { key: "ALL", label: `전체 ${items.value.length}`, count: items.value.length },
  { key: "REMINDER", label: `리마인더 ${reminderItems.value.length}`, count: reminderItems.value.length },
  { key: "MESSAGE", label: `메시지 ${messageItems.value.length}`, count: messageItems.value.length },
  { key: "COMMENT", label: `댓글 ${commentItems.value.length}`, count: commentItems.value.length },
  { key: "REACTION", label: `반응 ${reactionItems.value.length}`, count: reactionItems.value.length },
  { key: "ACTION", label: `액션 ${actionItems.value.length}`, count: actionItems.value.length },
]).filter((chip) => chip.key === "ALL" || chip.count > 0));

const topSummary = computed(() => {
  if (unreadCount.value > 0) return `새 알림 ${unreadCount.value}개`;
  if (items.value.length > 0) return `최근 알림 ${items.value.length}개`;
  return "새 알림 없음";
});

function categoryOf(n) {
  return String(n?.category || "").toUpperCase() || fallbackCategory(n?.type);
}

function fallbackCategory(type) {
  const t = String(type || "").toUpperCase();
  if (t === "PIN_REMIND") return "REMINDER";
  if (t === "MESSAGE_RECEIVED") return "MESSAGE";
  if (t === "POST_COMMENT") return "COMMENT";
  if (t === "POST_LIKE" || t === "FOLLOW") return "REACTION";
  if (t.startsWith("PIN_")) return "ACTION";
  return "OTHER";
}

function goConversations() { router.push("/inbox/conversations"); }
function goNewDm() { router.push("/inbox/new"); }
function switchInboxFilter(next) { inboxFilter.value = next; }

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "POST_COMMENT") return "댓글";
  if (t === "POST_LIKE") return "좋아요";
  if (t === "FOLLOW") return "팔로우";
  if (String(t || "").startsWith("PIN_")) return t === "PIN_REMIND" ? "리마인더" : "액션";
  return t || "알림";
}

function typeIcon(n) {
  const category = categoryOf(n);
  if (category === "REMINDER") return "⏰";
  if (category === "MESSAGE") return "💬";
  if (category === "COMMENT") return "💭";
  if (category === "REACTION") return "♡";
  if (category === "ACTION") return "📌";
  return "•";
}

function formatTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function itemBody(n) {
  return n?.body || n?.actionHint || n?.targetLabel || "새 알림이 도착했어요.";
}

function itemSub(n) {
  return n?.targetLabel || n?.actionHint || "탭해서 이어가기";
}

async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}

async function openItem(n) {
  const wasUnread = !n.read;
  if (wasUnread) noti.markLocalRead?.(n.id);
  try {
    if (wasUnread) await readNotification(n.id);
  } catch {}
  router.push(n?.targetPath || "/inbox");
}

function setupIo() {
  nextTick(() => {
    if (io) io.disconnect();
    if (!sentinelEl.value) return;
    io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) noti.loadMore?.();
    }, { rootMargin: "120px" });
    io.observe(sentinelEl.value);
  });
}

onMounted(async () => {
  await noti._refreshNow?.();
  setupIo();
});

onBeforeUnmount(() => {
  if (io) io.disconnect();
});
</script>

<template>
  <div class="page">
    <header class="inboxTop rl-cardish">
      <div class="topTitle">
        <span class="topIcon" aria-hidden="true">✦</span>
        <h1>{{ topSummary }}</h1>
      </div>
      <div class="topActions">
        <RlButton size="sm" variant="soft" title="새 DM" aria-label="새 DM" @click="goNewDm">＋</RlButton>
        <RlButton size="sm" variant="soft" title="대화" aria-label="대화" @click="goConversations">💬</RlButton>
        <RlButton size="sm" variant="soft" title="새로고침" aria-label="새로고침" @click="refreshNow" :disabled="loading">↻</RlButton>
      </div>
    </header>

    <AsyncStatePanel
      v-if="loading && !items.length"
      icon="⏳"
      title="불러오는 중"
      description=""
      tone="loading"
      :show-actions="false"
    />

    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="↻"
      secondary-label="대화"
      @primary="refreshNow"
      @secondary="goConversations"
    />

    <AsyncStatePanel
      v-else-if="items.length === 0"
      icon="✨"
      title="새 알림 없음"
      description=""
      primary-label="새 DM"
      secondary-label="↻"
      @primary="goNewDm"
      @secondary="refreshNow"
    />

    <main v-else class="inboxBody">
      <nav class="filterRail" aria-label="Inbox filters">
        <button
          v-for="chip in filterChips"
          :key="chip.key"
          class="filterChip"
          :class="{ on: inboxFilter === chip.key }"
          type="button"
          @click="switchInboxFilter(chip.key)"
        >
          {{ chip.label }}
        </button>
      </nav>

      <div v-if="filteredItems.length === 0" class="emptyCard rl-cardish">
        <strong>표시할 알림 없음</strong>
        <span>다른 필터를 선택해봐.</span>
      </div>

      <div v-else class="list">
        <button
          v-for="n in filteredItems"
          :key="n.id"
          class="inboxItem rl-cardish"
          :class="{ unread: !n.read }"
          type="button"
          @click="openItem(n)"
        >
          <span class="itemIcon">{{ typeIcon(n) }}</span>
          <span class="itemText">
            <span class="itemTop">
              <strong>{{ formatType(n.type) }}</strong>
              <em v-if="!n.read">NEW</em>
            </span>
            <span class="itemBody">{{ itemBody(n) }}</span>
            <span class="itemSub">{{ itemSub(n) }}</span>
          </span>
          <span class="itemTime">{{ formatTime(n.createdAt) }}</span>
        </button>
      </div>

      <div ref="sentinelEl" class="sentinel">
        <div v-if="loadingMore" class="loadingMore">불러오는 중…</div>
        <div v-else-if="!hasNext" class="end">끝</div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 18px 14px 96px;
  display: grid;
  gap: 12px;
}

.rl-cardish {
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow: 0 18px 60px rgba(0,0,0,.24), 0 1px 0 rgba(255,255,255,.05) inset;
  backdrop-filter: blur(14px);
}

.inboxTop {
  height: auto !important;
  min-height: 0 !important;
  border-radius: 20px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.topTitle {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.topIcon {
  width: 30px;
  height: 30px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in oklab, var(--accent) 72%, white);
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 24%, transparent);
  flex: 0 0 auto;
}

.inboxTop h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 950;
  letter-spacing: -.02em;
  white-space: nowrap;
}

.topActions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.inboxBody {
  display: grid;
  gap: 10px;
}

.filterRail {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 2px 4px;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
}

.filterRail::-webkit-scrollbar {
  display: none;
}

.filterChip {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 12px;
  scroll-snap-align: start;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.filterChip.on {
  background: color-mix(in oklab, var(--accent) 20%, transparent);
  border-color: color-mix(in oklab, var(--accent) 38%, var(--border));
}

.list {
  display: grid;
  gap: 10px;
}

.inboxItem {
  width: 100%;
  min-height: 76px;
  padding: 12px;
  border-radius: 18px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  text-align: left;
  color: var(--text);
  cursor: pointer;
  transition: transform .14s ease, border-color .18s ease, background .18s ease;
}

.inboxItem:hover {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--accent) 30%, var(--border));
}

.inboxItem.unread {
  border-color: color-mix(in oklab, var(--accent) 30%, var(--border));
  background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 8%, transparent), color-mix(in oklab, var(--surface) 86%, transparent));
}

.itemIcon {
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.055);
  font-size: 18px;
}

.itemText {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.itemTop {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.itemTop strong {
  font-size: 13px;
  font-weight: 950;
}

.itemTop em {
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: color-mix(in oklab, var(--accent) 70%, white);
  color: #0b1020;
  font-size: 10px;
  font-style: normal;
  font-weight: 950;
}

.itemBody {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.35;
}

.itemSub {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.itemTime {
  align-self: start;
  padding-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.emptyCard {
  padding: 18px;
  border-radius: 18px;
  display: grid;
  gap: 4px;
  color: var(--muted);
}

.emptyCard strong {
  color: var(--text);
}

.sentinel {
  padding: 8px 0 2px;
  text-align: center;
}

.loadingMore,
.end {
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 640px) {
  .page {
    padding: 14px 12px 96px;
  }

  .inboxTop {
    align-items: center;
    border-radius: 18px;
    padding: 10px 11px;
  }

  .topIcon {
    width: 28px;
    height: 28px;
    border-radius: 11px;
  }

  .inboxTop h1 {
    font-size: 18px;
  }

  .topActions {
    gap: 5px;
  }

  .inboxItem {
    min-height: 72px;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 9px;
    padding: 11px;
    border-radius: 17px;
  }

  .itemIcon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
  }

  .itemBody {
    font-size: 13px;
  }

  .itemSub {
    font-size: 11px;
  }
}
</style>
