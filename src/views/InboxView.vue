<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import api from "@/lib/api.js";

import RlRow from "@/components/ui/RlRow.vue";
import RlBadge from "@/components/ui/RlBadge.vue";
import RlButton from "@/components/ui/RlButton.vue";

const router = useRouter();

// SSE events
const sseConnected = ref(false);
const events = ref([]);

// notifications
const notiLoading = ref(false);
const notifications = ref([]);

// conversations
const convLoading = ref(false);
const conversations = ref([]);

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

async function fetchNotifications() {
  notiLoading.value = true;
  try {
    const res = await api.get("/api/notifications");
    notifications.value = res.data?.items ?? res.data ?? [];
  } finally {
    notiLoading.value = false;
  }
}

async function fetchConversations() {
  convLoading.value = true;
  try {
    const res = await api.get("/api/conversations");
    conversations.value = res.data?.items ?? res.data ?? [];
  } finally {
    convLoading.value = false;
  }
}

async function markAllRead() {
  await api.post("/api/notifications/read-all");
  await fetchNotifications();
}
async function deleteRead() {
  await api.delete("/api/notifications/read");
  await fetchNotifications();
}
async function markNotiRead(id) {
  await api.post(`/api/notifications/${id}/read`);
  await fetchNotifications();
}

async function openConversation(conv) {
  const id = conv?.conversationId || conv?.id;
  if (!id) return;
  try { await api.post(`/api/conversations/${id}/read`); } catch {}
  router.push(`/chat/${id}`);
}

let es = null;
function connectSse() {
  sseConnected.value = false;
  try { es?.close?.(); } catch {}
  events.value = [];

  es = new EventSource("/api/sse/subscribe", { withCredentials: true });

  const onMsg = async (ev) => {
    const type = (ev?.type || ev?.event || "").toLowerCase();
    if (type === "ping") return;

    let data = ev?.data;
    try { data = JSON.parse(ev?.data); } catch {}

    if (type === "connected") sseConnected.value = true;

    pushEvent({ event: type || "message", data });
    await Promise.allSettled([fetchNotifications(), fetchConversations()]);
  };

  es.addEventListener("connected", onMsg);
  es.addEventListener("ping", () => {});
  es.onmessage = onMsg;
  es.onerror = () => { sseConnected.value = false; };
}

function clearEvents() { events.value = []; }

onMounted(async () => {
  await Promise.allSettled([fetchNotifications(), fetchConversations()]);
  connectSse();
});

onUnmounted(() => { try { es?.close?.(); } catch {} });

const notiEmpty = computed(() => !notifications.value?.length && !notiLoading.value);
const convEmpty = computed(() => !conversations.value?.length && !convLoading.value);

function pickInitial(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const ch = raw[0];
  if (ch === "." || ch === "-" || ch === "_") return "";
  return ch.toUpperCase();
}
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">실시간 이벤트</div>
            <div class="rl-card__sub">서버에서 들어오는 이벤트 스트림</div>
          </div>

          <div class="headerRight">
            <RlBadge :tone="sseConnected ? 'success' : 'neutral'">
              {{ sseConnected ? "connected" : "disconnected" }}
            </RlBadge>
          </div>
        </div>

        <div class="pad">
          <div class="btnRow">
            <RlButton size="sm" variant="soft" @click="connectSse">다시 연결</RlButton>
            <RlButton size="sm" variant="ghost" @click="clearEvents">비우기</RlButton>
          </div>

          <div v-if="events.length" class="eventList">
            <div v-for="(e, i) in events" :key="i" class="eventItem">
              <div class="eventHead">
                <div class="eventName">{{ e.event }}</div>
                <div class="eventTime">{{ fmtTime(e.at) }}</div>
              </div>
              <pre class="eventBody">{{ e.data }}</pre>
            </div>
          </div>

          <div v-else class="empty">아직 이벤트가 없어요.</div>
        </div>
      </section>

      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">알림</div>
            <div class="rl-card__sub">새 소식과 상호작용</div>
          </div>

          <div class="headerRight">
            <RlButton size="sm" variant="soft" @click="fetchNotifications">새로고침</RlButton>
            <RlButton size="sm" variant="ghost" @click="markAllRead">모두 읽음</RlButton>
            <RlButton size="sm" variant="ghost" @click="deleteRead">읽은 것 삭제</RlButton>
          </div>
        </div>

        <div class="pad">
          <div v-if="notiLoading" class="empty">불러오는 중…</div>
          <div v-else-if="notiEmpty" class="empty">알림이 없어요.</div>

          <div v-else class="list">
            <RlRow
              v-for="n in notifications"
              :key="n.id || n.notificationId"
              class="item"
              clickable
              @click="markNotiRead(n.id || n.notificationId)"
            >
              <template #left>
                <div class="iconPill" :class="{ on: !(n.read || n.isRead) }" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2Z"
                    />
                  </svg>
                </div>
              </template>

              <template #default>
                <div class="main">
                  <div class="title">{{ n.title || n.type || "Notification" }}</div>
                  <div class="sub">{{ n.body || n.message || n.content || "" }}</div>
                </div>
              </template>

              <template #right>
                <RlBadge tone="neutral">{{ (n.read || n.isRead) ? "read" : "new" }}</RlBadge>
              </template>
            </RlRow>
          </div>
        </div>
      </section>

      <section class="rl-card">
        <div class="rl-card__header">
          <div>
            <div class="rl-card__title">메시지</div>
            <div class="rl-card__sub">대화방 업데이트</div>
          </div>

          <div class="headerRight">
            <RlButton size="sm" variant="soft" @click="fetchConversations">새로고침</RlButton>
          </div>
        </div>

        <div class="pad">
          <div v-if="convLoading" class="empty">불러오는 중…</div>
          <div v-else-if="convEmpty" class="empty">대화가 없어요.</div>

          <div v-else class="list">
            <RlRow
              v-for="c in conversations"
              :key="c.conversationId"
              class="item"
              clickable
              @click="openConversation(c)"
            >
              <template #left>
                <div class="avatar" aria-hidden="true">
                  <span v-if="pickInitial(c.peerUser?.nickname)">{{ pickInitial(c.peerUser?.nickname) }}</span>
                  <svg v-else viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
                    />
                  </svg>
                </div>
              </template>

              <template #default>
                <div class="main">
                  <div class="title">
                    {{ c.peerUser?.nickname || "User" }}
                    <span v-if="Number(c.unreadCount) > 0" class="unread">{{ c.unreadCount }}</span>
                  </div>
                  <div class="sub">{{ c.lastMessagePreview || " " }}</div>
                </div>
              </template>

              <template #right>
                <RlBadge tone="neutral">열기</RlBadge>
              </template>
            </RlRow>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad{ padding: 14px 16px 16px; }
.headerRight{ display:flex; align-items:center; gap: 10px; }
.btnRow{ display:flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.empty{ opacity: .7; font-size: 13px; padding: 6px 2px; }

.eventList{ display:flex; flex-direction:column; gap: 10px; }
.eventItem{
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.14);
  border-radius: 16px;
  padding: 10px 12px;
}
.eventHead{ display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; }
.eventName{ font-weight: 900; font-size: 13px; }
.eventTime{ opacity: .65; font-size: 12px; }
.eventBody{
  margin:0;
  font-size: 12px;
  opacity: .8;
  white-space: pre-wrap;
  word-break: break-word;
}

.list{ display:flex; flex-direction:column; gap: 10px; }
.item{ padding: 10px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.10); }

.main{ display:flex; flex-direction:column; gap: 2px; min-width: 0; }
.title{
  display:flex; align-items:center; gap: 8px;
  font-weight: 900; font-size: 13.5px;
}
.sub{
  opacity: .7; font-size: 12.5px;
  overflow:hidden; text-overflow: ellipsis; white-space: nowrap;
}

.iconPill{
  width: 34px; height: 34px; border-radius: 14px;
  display:grid; place-items:center;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.75);
}
.iconPill.on{
  border-color: rgba(124,156,255,.22);
  background: rgba(124,156,255,.12);
  color: rgba(255,255,255,.85);
}

.avatar{
  width: 34px; height: 34px; border-radius: 14px;
  display:grid; place-items:center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  font-weight: 900;
  color: rgba(255,255,255,.82);
}

.unread{
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(124,156,255,.20);
  border: 1px solid rgba(124,156,255,.25);
  font-size: 12px;
}
</style>
