<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import api from "@/lib/api.js";
import sse from "@/lib/sse";
import { useNotificationStore } from "@/stores/notifications";

import RlRow from "@/components/ui/RlRow.vue";
import RlBadge from "@/components/ui/RlBadge.vue";
import RlButton from "@/components/ui/RlButton.vue";

const router = useRouter();
const notiStore = useNotificationStore();

// SSE status/events (from global manager)
const sseConnected = ref(false);
const events = ref([]);
let offStatus = null;
let offEvent = null;

function pushEvent({ event, data }) {
  events.value.unshift({ event, data, at: Date.now() });
  if (events.value.length > 20) events.value.length = 20;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// notifications
const notiLoading = ref(false);
const notifications = ref([]);

// conversations
const convLoading = ref(false);
const conversations = ref([]);

async function loadNotifications() {
  notiLoading.value = true;
  try {
    const res = await api.get("/api/notifications");
    notifications.value = res?.data?.items || [];
    // 서버가 hasUnread 내려주면 store 갱신
    if (typeof res?.data?.hasUnread === "boolean") {
      notiStore.setHasUnread(res.data.hasUnread);
    }
  } finally {
    notiLoading.value = false;
  }
}

async function loadConversations() {
  convLoading.value = true;
  try {
    const res = await api.get("/api/conversations");
    conversations.value = res?.data?.items || res?.data || [];
  } finally {
    convLoading.value = false;
  }
}

async function readAll() {
  await api.post("/api/notifications/read-all");
  await loadNotifications();
  notiStore.setHasUnread(false);
}

async function readOne(id) {
  await api.delete("/api/notifications/read", { data: { id } });
  await loadNotifications();
}

function openConversation(c) {
  const id = c?.id || c?.conversationId;
  if (!id) return;
  router.push(`/chat/${id}`);
}

onMounted(async () => {
  // attach SSE listeners (global)
  offStatus = sse.onStatus((st) => {
    sseConnected.value = !!st.connected;
  });

  offEvent = sse.onEvent((evt) => {
    // evt: {type, data, id}
    pushEvent({ event: evt.type, data: evt.data });

    // 알림/대화 관련 이벤트가 오면 리스트 갱신 (너무 자주 호출 방지: 최소한의 debounce)
    if (evt.type && String(evt.type).toLowerCase().includes("notification")) {
      notiStore.setHasUnread(true);
    }
  });

  await Promise.all([loadNotifications(), loadConversations()]);
  await notiStore.refreshHasUnread();
});

onUnmounted(() => {
  if (offStatus) offStatus();
  if (offEvent) offEvent();
});

const hasNoti = computed(() => notifications.value.length > 0);
const hasConv = computed(() => conversations.value.length > 0);
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">
      <div class="rl-row rl-row--between">
        <div>
          <div class="rl-title">Connect</div>
          <div class="rl-sub">알림과 메시지</div>
        </div>

        <RlBadge :tone="sseConnected ? 'success' : 'neutral'">
          {{ sseConnected ? "LIVE" : "OFFLINE" }}
        </RlBadge>
      </div>
    </div>

    <div class="rl-section">
      <div class="rl-row rl-row--between">
        <div class="rl-sectionTitle">Notifications</div>
        <div class="rl-row" style="gap: 8px">
          <RlButton size="sm" variant="soft" @click="loadNotifications" :loading="notiLoading">새로고침</RlButton>
          <RlButton size="sm" variant="soft" @click="readAll">전체읽음</RlButton>
        </div>
      </div>

      <div v-if="notiLoading" class="rl-faint">불러오는 중...</div>
      <div v-else-if="!hasNoti" class="rl-faint">알림이 없어요.</div>
      <div v-else class="rl-list">
        <RlRow
            v-for="n in notifications"
            :key="n.id"
            :title="n.title || n.type || 'Notification'"
            :subtitle="n.message || n.content || ''"
            @click="readOne(n.id)"
        />
      </div>
    </div>

    <div class="rl-section">
      <div class="rl-row rl-row--between">
        <div class="rl-sectionTitle">Conversations</div>
        <RlButton size="sm" variant="soft" @click="loadConversations" :loading="convLoading">새로고침</RlButton>
      </div>

      <div v-if="convLoading" class="rl-faint">불러오는 중...</div>
      <div v-else-if="!hasConv" class="rl-faint">대화가 없어요.</div>
      <div v-else class="rl-list">
        <RlRow
            v-for="c in conversations"
            :key="c.id || c.conversationId"
            :title="c.title || c.name || ('Conversation #' + (c.id || c.conversationId))"
            :subtitle="c.lastMessage?.content || c.lastMessage || ''"
            @click="openConversation(c)"
        />
      </div>
    </div>

    <div class="rl-section">
      <div class="rl-row rl-row--between">
        <div class="rl-sectionTitle">SSE Events</div>
        <RlBadge tone="neutral">{{ events.length }}</RlBadge>
      </div>

      <div class="rl-events">
        <div v-for="e in events" :key="e.at" class="rl-event">
          <div class="rl-event__meta">
            <span class="rl-event__type">{{ e.event }}</span>
            <span class="rl-event__time">{{ fmtTime(e.at) }}</span>
          </div>
          <div class="rl-event__data">{{ e.data }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rl-events {
  display: grid;
  gap: 10px;
}

.rl-event {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 10px 12px;
  background: color-mix(in oklab, var(--surface) 90%, transparent);
}

.rl-event__meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}

.rl-event__type {
  font-weight: 900;
  color: var(--text);
}

.rl-event__data {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.35;
  word-break: break-word;
}
</style>