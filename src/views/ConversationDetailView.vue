<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
import { useToastStore } from "@/stores/toast";
import { useConversationsStore } from "@/stores/conversations";
import { useAuthStore } from "@/stores/auth";
import sse from "@/lib/sse";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const convStore = useConversationsStore();
const auth = useAuthStore();

const conversationId = computed(() => String(route.params.conversationId || ""));
const myId = computed(() => auth.me?.id || null);

const loading = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);
const listRef = ref(null);
const newMessageCount = ref(0);

function safeParse(x) {
  if (!x) return null;
  if (typeof x === "object") return x;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (!listRef.value) return;
    listRef.value.scrollTop = listRef.value.scrollHeight;
  });
}

function isNearBottom() {
  const el = listRef.value;
  if (!el) return true;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
}

function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  // 서버가 최신 먼저 줄 가능성이 높아서 reverse 해서 아래로 쌓이게
  return [...arr].reverse();
}

async function loadFirst({ keepScroll = false } = {}) {
  if (!conversationId.value || conversationId.value === "undefined" || conversationId.value === "null") {
    error.value = "대화방 ID가 없습니다. 대화 목록에서 다시 들어와 주세요.";
    return;
  }

  loading.value = true;
  error.value = "";

  const prevScrollHeight = listRef.value?.scrollHeight ?? 0;

  try {
    const res = await fetchMessages({ conversationId: conversationId.value, size: 20 });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    await markConversationRead(conversationId.value);
    convStore.refresh();

    if (keepScroll) {
      nextTick(() => {
        if (!listRef.value) return;
        const newHeight = listRef.value.scrollHeight;
        listRef.value.scrollTop += newHeight - prevScrollHeight;
      });
    } else {
      scrollToBottom();
    }
  } catch (e) {
    error.value = e?.response?.data?.message || "메시지를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;

  const prevScrollHeight = listRef.value?.scrollHeight ?? 0;

  try {
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
      cursor: nextCursor.value,
    });

    items.value = [...normalizeMessages(res.items), ...items.value];
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    nextTick(() => {
      if (!listRef.value) return;
      const newHeight = listRef.value.scrollHeight;
      listRef.value.scrollTop += newHeight - prevScrollHeight;
    });
  } catch (e) {
    toast.error("불러오기 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}

function onScroll() {
  const el = listRef.value;
  if (!el) return;

  // 위쪽 거의 도달하면 자동 이전 메시지 로드
  if (el.scrollTop < 10) {
    if (hasNext.value && !loading.value) loadMore();
  }
}

async function onSend() {
  const text = content.value.trim();
  if (!text || sending.value) return;

  sending.value = true;
  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: text,
      attachmentIds: [],
    });

    // 내 메시지는 즉시 append
    items.value.push(msg);
    content.value = "";
    convStore.refresh();
    scrollToBottom();
  } catch (e) {
    toast.error("전송 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    sending.value = false;
  }
}

/**
 * ✅ 실시간 처리:
 * - SSE에서 event:message-created 가 오면
 * - 현재 대화방이면 append
 * - 화면이 아래에 붙어있으면 자동 스크롤, 아니면 배너 카운트
 */
const off = sse.onEvent?.((evt) => {
  if (!conversationId.value) return;
  if (evt?.type !== "message-created") return;

  const data = safeParse(evt?.data);
  if (!data?.messageId) return;

  if (data.conversationId !== conversationId.value) return;

  // 중복 방지
  if (items.value.some((m) => m.messageId === data.messageId)) return;

  items.value.push(data);

  if (isNearBottom()) {
    scrollToBottom();
  } else {
    newMessageCount.value++;
  }
});

onMounted(async () => {
  await loadFirst();

  nextTick(() => {
    if (listRef.value) listRef.value.addEventListener("scroll", onScroll);
  });
});

onBeforeUnmount(() => {
  off?.();
  if (listRef.value) listRef.value.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="title">대화</div>
      <div></div>
    </div>

    <div v-if="error" class="state err">{{ error }}</div>
    <div v-else-if="loading && items.length === 0" class="state">불러오는 중…</div>

    <div
        v-if="newMessageCount > 0"
        class="newBanner"
        @click="scrollToBottom(); newMessageCount = 0"
        role="button"
        tabindex="0"
    >
      새 메시지 {{ newMessageCount }}개 ↓
    </div>

    <div ref="listRef" class="list" v-if="!error">
      <div class="more">
        <button v-if="hasNext" class="moreBtn" type="button" @click="loadMore" :disabled="loading">
          {{ loading ? "불러오는 중…" : "이전 메시지 더 보기" }}
        </button>
        <div v-else class="end">처음까지 다 봤어요 ✨</div>
      </div>

      <div
          v-for="m in items"
          :key="m.messageId"
          class="msg"
          :class="{ mine: myId && m.senderId === myId }"
      >
        <div class="bubble">{{ m.content }}</div>
        <div class="time">
          {{ (m.createdAt || "").replace("T", " ").slice(11, 16) }}
        </div>
      </div>
    </div>

    <div class="composer">
      <input
          v-model="content"
          class="input"
          placeholder="메시지 입력…"
          @keydown.enter.prevent="onSend"
      />
      <button class="btn" type="button" @click="onSend" :disabled="sending">
        {{ sending ? "..." : "전송" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page{
  padding:14px 12px 90px;
  max-width:760px;
  margin:0 auto;
  height:calc(100vh - 72px);
  display:flex;
  flex-direction:column;
}
.topbar{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  margin-bottom:10px;
}
.title{font-weight:950;text-align:center}
.state{ text-align:center;color:var(--muted);padding:18px 0 }
.state.err{ color:color-mix(in oklab,var(--danger) 80%,white) }

.newBanner{
  position:sticky;
  top:0;
  z-index:3;
  margin:6px auto;
  padding:6px 12px;
  border-radius:999px;
  background:color-mix(in oklab,var(--accent) 70%, #000);
  border:1px solid color-mix(in oklab,var(--accent) 55%, var(--border));
  color:white;
  font-size:12px;
  font-weight:900;
  cursor:pointer;
  user-select:none;
}

.list{
  flex:1;
  overflow-y:auto;
  display:flex;
  flex-direction:column;
  gap:10px;
  padding:2px 2px 12px;
  border-radius:18px;

  /* ✅ 스크롤바 디자인 (webkit) */
  scrollbar-gutter: stable;
}
.list::-webkit-scrollbar{ width: 10px; }
.list::-webkit-scrollbar-track{
  background: color-mix(in oklab, var(--surface) 65%, transparent);
  border-radius: 999px;
}
.list::-webkit-scrollbar-thumb{
  background: color-mix(in oklab, var(--border) 70%, var(--accent));
  border-radius: 999px;
  border: 2px solid color-mix(in oklab, var(--surface) 80%, transparent);
}
.list::-webkit-scrollbar-thumb:hover{
  background: color-mix(in oklab, var(--border) 55%, var(--accent));
}

/* ✅ Firefox */
.list{
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklab, var(--border) 65%, var(--accent))
  color-mix(in oklab, var(--surface) 65%, transparent);
}

.more{display:grid;place-items:center;padding:6px 0}
.moreBtn{
  height:40px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text);
  font-weight:950;
}
.end{font-size:12px;color:var(--muted)}

.msg{display:flex;flex-direction:column;align-items:flex-start}
.msg.mine{align-items:flex-end}
.bubble{
  max-width:75%;
  padding:10px 14px;
  border-radius:18px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  border:1px solid var(--border);
  font-size:13.5px;
  line-height:1.45;
  white-space:pre-wrap;
}
.msg.mine .bubble{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  border-color:color-mix(in oklab,var(--accent) 40%,var(--border));
}
.time{font-size:11px;color:var(--muted);margin-top:4px}

.composer{
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  padding-top:8px;
}
.input{
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text);
}
.btn{
  height:44px;
  padding:0 14px;
  border-radius:16px;
  border:1px solid color-mix(in oklab,var(--accent) 55%,var(--border));
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  font-weight:950;
  color:var(--text);
}
.btn:disabled{opacity:.6}
</style>