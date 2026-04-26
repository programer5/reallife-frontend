<!-- src/views/ConversationsView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import GroupCreateModal from "@/components/chat/GroupCreateModal.vue";
import { useConversationsStore } from "@/stores/conversations";

const router = useRouter();
const conv = useConversationsStore();

const tab = ref("recent");
const pendingAction = ref(null);
const pendingTargetConversationId = ref("");
const showGroupCreate = ref(false);
const nowTick = ref(Date.now());
let timeTimer = null;
let minuteTimer = null;

const items = computed(() => conv.items || []);
const loading = computed(() => conv.loading);
const error = computed(() => conv.error);
const pendingActionExists = computed(() => !!pendingAction.value);

const unreadTotal = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
);

const recentActiveCount = computed(() =>
  items.value.filter((c) => isRecentConversation(c)).length
);

const actionableCount = computed(() => {
  if (pendingActionExists.value) return 1;
  return Math.max(unreadTotal.value, recentActiveCount.value);
});

const filteredConversations = computed(() => {
  const source = items.value.slice();
  if (tab.value === "unread") {
    return source.filter((c) => Number(c?.unreadCount || 0) > 0);
  }
  return source.sort((a, b) => {
    const at = Date.parse(a?.lastMessageAt || a?.updatedAt || "") || 0;
    const bt = Date.parse(b?.lastMessageAt || b?.updatedAt || "") || 0;
    return bt - at;
  });
});

function loadPendingAction() {
  try {
    pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
  } catch {
    pendingAction.value = null;
  }
}

function loadPendingTarget() {
  try {
    pendingTargetConversationId.value = String(
      sessionStorage.getItem("reallife:pendingActionTargetConversationId") || ""
    );
  } catch {
    pendingTargetConversationId.value = "";
  }
}

function markPendingTarget(conversationId) {
  const value = String(conversationId || "");
  try {
    sessionStorage.setItem("reallife:pendingActionTargetConversationId", value);
  } catch {}
  pendingTargetConversationId.value = value;
}

function isPendingTarget(conversationId) {
  return pendingActionExists.value && String(conversationId) === String(pendingTargetConversationId.value || "");
}

function pendingKindLabel(kind) {
  if (kind === "PROMISE") return "📅";
  if (kind === "TODO") return "✅";
  return "📍";
}

function pendingSourceRoute() {
  const p = pendingAction.value;
  if (!p) return "";
  if (p.sourceRoute) return String(p.sourceRoute);
  if (p.postId) return `/posts/${encodeURIComponent(String(p.postId))}`;
  return "";
}

function pendingSourcePreview() {
  const p = pendingAction.value;
  if (!p) return "";
  return String(p.sourcePostPreview || p.text || "").trim().slice(0, 76);
}

function goPendingSource() {
  const to = pendingSourceRoute();
  if (to) router.push(to);
}

function openConversation(id) {
  if (pendingActionExists.value) markPendingTarget(id);
  router.push(`/inbox/conversations/${id}`);
}

function goNewDm() {
  router.push("/inbox/new");
}

function goGroupCreate() {
  showGroupCreate.value = true;
}

function closeGroupCreate() {
  showGroupCreate.value = false;
}

function handleGroupCreated(conversationId) {
  showGroupCreate.value = false;
  conv.refresh?.();
  if (conversationId) router.push(`/inbox/conversations/${conversationId}`);
}

function isGroupConversation(c) {
  return String(c?.conversationType || "DIRECT") === "GROUP";
}

function peerName(c) {
  if (isGroupConversation(c)) return c?.conversationTitle || "그룹 대화";
  return c.peerUser?.nickname || c.peerUser?.name || "상대";
}

function conversationPreview(c) {
  return c.lastMessagePreview || "아직 메시지가 없어요.";
}

function isRecentConversation(c) {
  const raw = c?.lastMessageAt || c?.updatedAt;
  const t = Date.parse(raw || "");
  if (!Number.isFinite(t)) return false;
  return nowTick.value - t <= 1000 * 60 * 60 * 24;
}

function activityLabel(c) {
  if (isPendingTarget(c.conversationId)) return "선택됨";
  const unread = Number(c?.unreadCount || 0);
  if (unread > 0) return unread > 99 ? "99+" : String(unread);
  if (isRecentConversation(c)) return "오늘";
  return "";
}

function fmtListTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const diffMin = Math.floor((nowTick.value - t) / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;

  const d = new Date(t);
  const nowD = new Date(nowTick.value);
  const sameDay =
    d.getFullYear() === nowD.getFullYear() &&
    d.getMonth() === nowD.getMonth() &&
    d.getDate() === nowD.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

onMounted(async () => {
  loadPendingAction();
  loadPendingTarget();
  await conv._refreshNow?.();
  if (!conv._refreshNow) await conv.refresh();

  const delay = 60000 - (Date.now() % 60000);
  timeTimer = setTimeout(() => {
    nowTick.value = Date.now();
    minuteTimer = setInterval(() => {
      nowTick.value = Date.now();
    }, 60000);
  }, delay);
});

onBeforeUnmount(() => {
  if (timeTimer) clearTimeout(timeTimer);
  if (minuteTimer) clearInterval(minuteTimer);
});
</script>

<template>
  <div class="page">
    <div v-if="pendingActionExists" class="pendingBanner rl-cardish" role="status">
      <div class="pendingIcon">{{ pendingKindLabel(pendingAction.kind) }}</div>
      <div class="pendingBody">
        <strong>가져올 액션이 있어요</strong>
        <span>{{ pendingAction.text }}</span>
        <small v-if="pendingSourcePreview()">{{ pendingSourcePreview() }}</small>
      </div>
      <div class="pendingActions">
        <RlButton v-if="pendingSourceRoute()" size="sm" variant="soft" @click="goPendingSource">원문</RlButton>
        <RlButton size="sm" variant="primary" @click="goNewDm">새 대화</RlButton>
      </div>
    </div>

    <header class="topBar rl-cardish">
      <div>
        <h1>대화</h1>
        <p>{{ unreadTotal > 0 ? `읽지 않은 대화 ${unreadTotal}개` : "바로 이어갈 대화를 골라보세요" }}</p>
      </div>
      <div class="topActions">
        <RlButton size="sm" variant="primary" @click="goNewDm">＋</RlButton>
        <RlButton size="sm" variant="soft" @click="goGroupCreate">그룹</RlButton>
        <RlButton size="sm" variant="soft" :disabled="loading" @click="conv.refresh()">↻</RlButton>
      </div>
    </header>

    <section class="conversationTabs" role="tablist" aria-label="대화 필터">
      <button type="button" :class="{ active: tab === 'recent' }" @click="tab = 'recent'">최근</button>
      <button type="button" :class="{ active: tab === 'unread' }" @click="tab = 'unread'">읽지 않음</button>
    </section>

    <AsyncStatePanel
      v-if="loading"
      icon="⏳"
      title="대화 목록을 불러오는 중이에요"
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="대화 목록을 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="새 DM"
      @primary="() => (conv._refreshNow?.() || conv.refresh?.())"
      @secondary="goNewDm"
    />
    <AsyncStatePanel
      v-else-if="items.length === 0"
      icon="💬"
      title="아직 대화가 없어요"
      primary-label="새 DM"
      secondary-label="인박스"
      @primary="goNewDm"
      @secondary="() => router.push('/inbox')"
    />

    <div v-else class="conversationList">
      <button
        v-for="c in filteredConversations"
        :key="c.conversationId"
        class="conversationItem rl-cardish"
        :class="{
          conversationItemUnread: Number(c?.unreadCount || 0) > 0,
          conversationItemTarget: isPendingTarget(c.conversationId)
        }"
        type="button"
        @click="openConversation(c.conversationId)"
      >
        <div class="avatar" aria-hidden="true"></div>
        <div class="itemBody">
          <div class="itemTop">
            <div class="nameWrap">
              <strong>{{ peerName(c) }}</strong>
              <span v-if="isGroupConversation(c)" class="groupBadge">GROUP</span>
            </div>
            <span class="time">{{ fmtListTime(c.lastMessageAt || c.updatedAt) }}</span>
          </div>
          <div class="preview">{{ conversationPreview(c) }}</div>
        </div>
        <span v-if="activityLabel(c)" class="activityBadge">{{ activityLabel(c) }}</span>
      </button>

      <div class="more">
        <button v-if="conv.hasNext" class="moreBtn" type="button" @click="conv.loadMore()">더 보기</button>
        <div v-else class="end">끝</div>
      </div>
    </div>

    <GroupCreateModal
      v-if="showGroupCreate"
      @close="closeGroupCreate"
      @created="handleGroupCreated"
    />
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:900px;margin:0 auto;display:grid;gap:12px}
.rl-cardish{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 86%,transparent);box-shadow:0 14px 48px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.05) inset;backdrop-filter:blur(14px)}
.pendingBanner{display:flex;align-items:center;gap:12px;padding:12px;border-radius:20px}
.pendingIcon{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.06);font-size:18px}
.pendingBody{min-width:0;display:grid;gap:3px;flex:1}.pendingBody strong{font-size:14px}.pendingBody span,.pendingBody small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px}.pendingActions{display:flex;gap:8px}
.topBar{border-radius:24px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px}.topBar h1{margin:0;font-size:26px;font-weight:950}.topBar p{margin:5px 0 0;color:var(--muted);font-size:13px}.topActions{display:flex;gap:8px;align-items:center}
.conversationTabs{display:flex;gap:6px;padding:4px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}.conversationTabs button{flex:1;height:36px;border:0;border-radius:999px;padding:0 12px;background:transparent;color:var(--muted);font-weight:950;cursor:pointer}.conversationTabs button.active{background:color-mix(in oklab,var(--accent) 20%,rgba(255,255,255,.04));color:var(--text);box-shadow:0 0 0 1px color-mix(in oklab,var(--accent) 20%,transparent) inset}
.conversationList{display:grid;gap:10px}.conversationItem{width:100%;border-radius:20px;padding:12px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;text-align:left;cursor:pointer;transition:transform .14s ease,border-color .18s ease,background .18s ease}.conversationItem:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 28%,var(--border));background:color-mix(in oklab,var(--surface) 82%,transparent)}.conversationItemUnread{border-color:color-mix(in oklab,var(--accent) 32%,var(--border))}.conversationItemTarget{border-color:color-mix(in oklab,var(--success) 34%,var(--border));box-shadow:0 0 0 1px color-mix(in oklab,var(--success) 16%,transparent) inset}.avatar{width:42px;height:42px;border-radius:50%;background:radial-gradient(15px 15px at 30% 30%,rgba(255,255,255,.22),transparent 60%),linear-gradient(135deg,color-mix(in oklab,var(--accent) 76%,white),color-mix(in oklab,var(--success) 68%,white))}.itemBody{min-width:0;display:grid;gap:5px}.itemTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.nameWrap{display:flex;align-items:center;gap:7px;min-width:0}.nameWrap strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.groupBadge{font-size:10px;font-weight:950;color:color-mix(in oklab,var(--accent) 78%,white);border:1px solid color-mix(in oklab,var(--accent) 35%,transparent);padding:2px 6px;border-radius:999px}.time{font-size:12px;color:var(--muted);white-space:nowrap}.preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:13px}.activityBadge{min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in oklab,var(--accent) 72%,white);color:#0b1020;font-size:12px;font-weight:950}.more{display:grid;place-items:center;padding:8px 0 4px}.moreBtn{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:var(--text);font-weight:900}.end{font-size:12px;opacity:.65}
@media (max-width:640px){.page{padding:14px 12px 90px}.topBar{padding:14px}.topBar h1{font-size:24px}.topActions :deep(button){min-width:38px;padding-inline:10px}.conversationTabs{width:100%}.conversationItem{grid-template-columns:40px 1fr auto;padding:11px}.avatar{width:40px;height:40px}}
</style>
