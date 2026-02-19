<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/lib/api.js";
import { useAuthStore } from "@/stores/auth.js";

import RlButton from "@/components/ui/RlButton.vue";
import RlBadge from "@/components/ui/RlBadge.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const conversationId = computed(() => String(route.params.id || ""));

const me = ref(null);

const loading = ref(false);
const sending = ref(false);
const error = ref("");

const items = ref([]); // raw from API
const input = ref("");
const listRef = ref(null);

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * ✅ 서버가 최신순(DESC)으로 주는 경우가 많아서
 * 화면은 오래된 → 최신(ASC)으로 항상 정렬해서 “최신이 아래”로 보이게 함
 */
const sortedItems = computed(() => {
  const arr = Array.isArray(items.value) ? [...items.value] : [];
  arr.sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime();
    const tb = new Date(b?.createdAt || 0).getTime();
    return ta - tb;
  });
  return arr;
});

async function fetchMeAndProfile() {
  const meRes = await api.get("/api/me");
  me.value = meRes.data;

  // avatar/bio는 /api/users/{handle} 에 있음
  if (me.value?.handle) {
    try {
      const p = await api.get(`/api/users/${me.value.handle}`);
      // profileImageUrl 같은 부가정보는 me에 합쳐둠
      me.value = { ...me.value, ...p.data };
    } catch {
      // ignore
    }
  }
}

async function loadMessages() {
  if (!conversationId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get(`/api/conversations/${conversationId.value}/messages`);
    const data = res.data || {};
    items.value = Array.isArray(data.items) ? data.items : (Array.isArray(res.data) ? res.data : []);
    await nextTick();
    scrollToBottom();
  } catch (e) {
    error.value = e?.response?.data?.message || "메시지를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

function scrollToBottom() {
  const el = listRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

async function markRead() {
  if (!conversationId.value) return;
  try {
    await api.post(`/api/conversations/${conversationId.value}/read`);
  } catch {}
}

async function send() {
  const content = input.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  error.value = "";
  try {
    await api.post(`/api/conversations/${conversationId.value}/messages`, { content });
    input.value = "";
    await loadMessages();
    await markRead();
  } catch (e) {
    error.value = e?.response?.data?.message || "전송에 실패했어요.";
  } finally {
    sending.value = false;
  }
}

// SSE refresh
let es = null;
function connectSse() {
  try {
    es?.close?.();
    es = new EventSource("/api/sse/subscribe", { withCredentials: true });

    const onAny = async (ev) => {
      const t = (ev?.type || "").toLowerCase();
      if (t === "ping") return;
      await loadMessages();
      await markRead();
    };

    es.addEventListener("connected", onAny);
    es.addEventListener("message", onAny);
    es.addEventListener("conversation", onAny);
    es.onmessage = onAny;
  } catch {}
}

onMounted(async () => {
  await auth.ensureSession();
  await fetchMeAndProfile();
  await loadMessages();
  await markRead();
  connectSse();
});

onUnmounted(() => {
  try { es?.close?.(); } catch {}
});

watch(conversationId, async () => {
  await loadMessages();
  await markRead();
});
</script>

<template>
  <div class="rl-page">
    <div class="rl-section">
      <section class="rl-card">
        <div class="rl-card__header">
          <div class="headerLeft">
            <RlButton size="sm" variant="ghost" @click="router.back()">뒤로</RlButton>
            <div class="titleWrap">
              <div class="rl-card__title">채팅</div>
              <div class="rl-card__sub">대화방 {{ conversationId.slice(0, 8) }}</div>
            </div>
          </div>

          <div class="headerRight">
            <RlBadge tone="neutral" v-if="loading">loading</RlBadge>
            <RlButton size="sm" variant="soft" @click="loadMessages">새로고침</RlButton>
          </div>
        </div>

        <div class="pad">
          <div v-if="error" class="err">{{ error }}</div>

          <div ref="listRef" class="list">
            <div v-if="!sortedItems.length && !loading" class="empty">
              아직 메시지가 없어요. 첫 메시지를 보내보세요.
            </div>

            <div
              v-for="m in sortedItems"
              :key="m.messageId || m.id"
              class="msgRow"
              :class="{ me: String(m.senderId) === String(me?.id) }"
            >
              <div class="bubble">
                <div class="content">{{ m.content }}</div>
                <div class="meta">{{ fmtTime(m.createdAt) }}</div>
              </div>
            </div>
          </div>

          <div class="composer">
            <input
              v-model="input"
              class="composeInput"
              placeholder="메시지 입력…"
              @keydown.enter.prevent="send"
            />
            <RlButton variant="primary" size="md" :loading="sending" @click="send">전송</RlButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad { padding: 14px 16px 16px; }

.headerLeft{ display:flex; align-items:center; gap: 12px; }
.titleWrap{ display:flex; flex-direction:column; gap: 2px; }
.headerRight{ display:flex; align-items:center; gap: 10px; }

.err{ color: #ff6b6b; font-size: 12.5px; margin-bottom: 10px; }

.list{
  height: min(62vh, 560px);
  overflow: auto;
  padding: 10px 8px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.16);
}
.empty{ opacity: .7; font-size: 13px; padding: 14px 10px; }

.msgRow{ display:flex; margin: 8px 0; }
.msgRow.me{ justify-content: flex-end; }

.bubble{
  max-width: min(560px, 86%);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
}
.msgRow.me .bubble{
  background: rgba(124,156,255,.18);
  border-color: rgba(124,156,255,.22);
}

.content{ white-space: pre-wrap; word-break: break-word; font-size: 13.5px; line-height: 1.35; }
.meta{ margin-top: 6px; font-size: 11px; opacity: .7; text-align: right; }

.composer{ display:flex; gap: 10px; margin-top: 12px; align-items:center; }
.composeInput{
  flex: 1 1 auto;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  color: rgba(255,255,255,.92);
  padding: 0 12px;
  outline: none;
}
.composeInput:focus{
  border-color: rgba(124,156,255,.45);
  box-shadow: 0 0 0 4px rgba(124,156,255,.12);
}
</style>
