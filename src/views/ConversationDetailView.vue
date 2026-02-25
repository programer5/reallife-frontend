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

/** ✅ 스크롤 컨테이너는 scroller */
const scrollerRef = ref(null);

function scrollToBottom() {
  nextTick(() => {
    const el = scrollerRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
}

function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}

function isNearBottom() {
  const el = scrollerRef.value;
  if (!el) return true;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < 140;
}

function onScroll() {
  const el = scrollerRef.value;
  if (!el) return;

  // 맨 위 근처면 이전 메시지 로드
  if (el.scrollTop < 12) {
    if (hasNext.value && !loading.value) loadMore();
  }
}

async function ensureSessionOrRedirect() {
  if (auth.me?.id) return true;
  try {
    await auth.ensureSession();
    return !!auth.me?.id;
  } catch {
    router.replace("/login");
    return false;
  }
}

async function loadFirst({ keepScroll = false } = {}) {
  if (!conversationId.value || conversationId.value === "undefined" || conversationId.value === "null") {
    error.value = "대화방 ID가 없습니다. 대화 목록에서 다시 들어와 주세요.";
    return;
  }

  loading.value = true;
  error.value = "";

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

  try {
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
    });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    await markConversationRead(conversationId.value);
    convStore.refresh();

    if (keepScroll) {
      nextTick(() => {
        const el = scrollerRef.value;
        if (!el) return;
        const newHeight = el.scrollHeight;
        el.scrollTop += newHeight - prevScrollHeight;
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

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

  const res = await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
    cursor: nextCursor.value,
  });

  items.value = [...normalizeMessages(res.items), ...items.value];
  nextCursor.value = res.nextCursor ?? null;
  hasNext.value = !!res.hasNext;

  nextTick(() => {
    const el = scrollerRef.value;
    if (!el) return;
    const newHeight = el.scrollHeight;
    el.scrollTop += newHeight - prevScrollHeight;
  });
}

async function onSend() {
  const text = content.value.trim();
  if (!text || sending.value) return;

  if (!conversationId.value) {
    toast.error("전송 실패", "대화방 ID가 없습니다.");
    return;
  }

  sending.value = true;
  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: text,
      attachmentIds: [],
    });

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

let offEvent = null;

onMounted(async () => {
  const ok = await ensureSessionOrRedirect();
  if (!ok) return;

  await loadFirst();

  nextTick(() => {
    if (scrollerRef.value) scrollerRef.value.addEventListener("scroll", onScroll);
  });

  offEvent = sse.onEvent?.(async (ev) => {
    if (!ev) return;
    if (ev.type !== "message-created") return;

    let data = ev.data;
    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch {}

    if (data?.conversationId === conversationId.value) {
      const stick = isNearBottom();
      await loadFirst({ keepScroll: !stick });
      if (stick) scrollToBottom();
      return;
    }

    convStore.refresh();
  }) ?? null;
});

onBeforeUnmount(() => {
  if (scrollerRef.value) scrollerRef.value.removeEventListener("scroll", onScroll);
  if (offEvent) offEvent();
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="title">대화</div>
      <div></div>
    </div>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <!-- ✅ 스크롤은 전체 폭 컨테이너에서 발생 => 스크롤바가 화면 오른쪽 끝 -->
    <div v-else ref="scrollerRef" class="scroller rl-scroll rl-scroll--premium">
      <div class="inner">
        <div class="more">
          <button v-if="hasNext" class="moreBtn" type="button" @click="loadMore">
            이전 메시지 더 보기
          </button>
        </div>

        <div
            v-for="m in items"
            :key="m.messageId"
            class="msg"
            :class="{ mine: myId && m.senderId === myId }"
        >
          <div class="bubble">{{ m.content }}</div>
          <div class="time">{{ (m.createdAt || '').replace('T', ' ').slice(11, 16) }}</div>
        </div>

        <!-- 아래 여백(입력창 가리지 않게) -->
        <div class="bottomSpacer"></div>
      </div>
    </div>

    <div class="composerWrap">
      <div class="composerInner">
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
  </div>
</template>

<style scoped>
.page{
  height: calc(100dvh - 72px);
  display:flex;
  flex-direction:column;
  min-height:0;
  overflow:hidden;
}

/* 상단바 */
.topbar{
  padding: 14px 12px 10px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
}
.title{font-weight:950;text-align:center}
.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

/* ✅ 스크롤바는 여기(전체 폭) */
.scroller{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;

  /* ✅ 중앙 내용은 inner가 담당 */
  padding: 0 12px;
}

/* ✅ 실제 메시지 컬럼(중앙 정렬) */
.inner{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  display:flex;
  flex-direction:column;
  gap:10px;
  padding-bottom: 12px;
}

.more{display:grid;place-items:center}
.moreBtn{
  height:40px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text);
  font-weight:900;
}

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

.bottomSpacer{
  height: 10px;
}

/* ✅ 입력창은 하단 고정 느낌 + 중앙 정렬 */
.composerWrap{
  padding: 10px 12px 14px;
  border-top: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--bg) 70%, transparent);
  backdrop-filter: blur(10px);
}

.composerInner{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
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