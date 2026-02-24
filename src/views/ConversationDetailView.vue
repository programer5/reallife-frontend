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

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);
const listRef = ref(null);
const newMessageCount = ref(0);

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

async function loadFirst() {
  const res = await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
  });

  items.value = [...res.items].reverse();
  nextCursor.value = res.nextCursor;
  hasNext.value = res.hasNext;

  await markConversationRead(conversationId.value);
  convStore.refresh();

  scrollToBottom();
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

    items.value.push(msg);
    content.value = "";
    scrollToBottom();
  } catch (e) {
    toast.error("전송 실패");
  } finally {
    sending.value = false;
  }
}

/* 🔥 실시간 append */
const off = sse.onEvent?.((evt) => {
  if (!conversationId.value) return;
  if (evt?.type !== "message-created") return;

  const data =
      typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;

  if (data.conversationId !== conversationId.value) return;

  // 🔥 중복 방지
  if (items.value.some((m) => m.messageId === data.messageId)) return;

  items.value.push(data);

  if (isNearBottom()) {
    scrollToBottom();
  } else {
    newMessageCount.value++;
  }
});

onMounted(loadFirst);

onBeforeUnmount(() => {
  off?.();
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="title">대화</div>
      <div></div>
    </div>

    <div
        v-if="newMessageCount > 0"
        class="newBanner"
        @click="scrollToBottom(); newMessageCount = 0"
    >
      새 메시지 {{ newMessageCount }}개 ↓
    </div>

    <div ref="listRef" class="list">
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
.list{
  flex:1;
  overflow-y:auto;
  display:flex;
  flex-direction:column;
  gap:10px;
}
.msg{display:flex;flex-direction:column;align-items:flex-start}
.msg.mine{align-items:flex-end}
.bubble{
  max-width:75%;
  padding:10px 14px;
  border-radius:18px;
  background:var(--surface);
  border:1px solid var(--border);
}
.msg.mine .bubble{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
}
.time{font-size:11px;color:var(--muted);margin-top:4px}
.newBanner{
  position:sticky;
  top:0;
  margin:6px auto;
  padding:6px 12px;
  border-radius:999px;
  background:var(--accent);
  color:white;
  font-size:12px;
  font-weight:700;
  cursor:pointer;
}
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
  padding:0 12px;
}
.btn{
  height:44px;
  padding:0 14px;
  border-radius:16px;
}
</style>