<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
import { useToastStore } from "@/stores/toast";
import { useConversationsStore } from "@/stores/conversations";
import { useAuthStore } from "@/stores/auth";
import { useSseStore } from "@/stores/sse";
import { onBeforeUnmount } from "vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const convStore = useConversationsStore();
const auth = useAuthStore();
const sse = useSseStore();

// ✅ 항상 문자열로 확보
const conversationId = computed(() => String(route.params.conversationId || ""));

// ✅ 중요: /api/me 응답에서 내 id는 userId가 아니라 id 임
const myId = computed(() => auth.me?.id || null);

const loading = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);

const listRef = ref(null);

function scrollToBottom() {
  nextTick(() => {
    if (!listRef.value) return;
    listRef.value.scrollTop = listRef.value.scrollHeight;
  });
}

function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  // 서버가 최신 먼저라고 가정 -> reverse 해서 아래로 쌓이게
  return [...arr].reverse();
}

function onScroll() {
  if (!listRef.value) return;

  // 스크롤이 맨 위 근처면
  if (listRef.value.scrollTop < 10) {
    if (hasNext.value && !loading.value) {
      loadMore();
    }
  }
}

function isNearBottom() {
  const el = listRef.value;
  if (!el) return true;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
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
  // ✅ conversationId 없으면 요청 자체를 막고 안내
  if (
      !conversationId.value ||
      conversationId.value === "undefined" ||
      conversationId.value === "null"
  ) {
    error.value = "대화방 ID가 없습니다. 대화 목록에서 다시 들어와 주세요.";
    return;
  }

  loading.value = true;
  error.value = "";
  const prevScrollHeight = listRef.value?.scrollHeight ?? 0;

  try {
    console.log("DEBUG conversationId:", conversationId.value);
    console.log("DEBUG myId:", myId.value);

    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
    });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    // ✅ 읽음 처리 + 목록 갱신
    await markConversationRead(conversationId.value);
    convStore.refresh();

    console.log("DEBUG first message:", items.value?.[0]);

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
    error.value =
        e?.response?.data?.message || "메시지를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;

  const prevScrollHeight = listRef.value?.scrollHeight ?? 0;

  const res = await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
    cursor: nextCursor.value,
  });

  // ✅ 위에 붙이기
  items.value = [...normalizeMessages(res.items), ...items.value];
  nextCursor.value = res.nextCursor ?? null;
  hasNext.value = !!res.hasNext;

  nextTick(() => {
    if (!listRef.value) return;
    const newHeight = listRef.value.scrollHeight;
    listRef.value.scrollTop += newHeight - prevScrollHeight;
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
    toast.error(
        "전송 실패",
        e?.response?.data?.message || "잠시 후 다시 시도해주세요."
    );
  } finally {
    sending.value = false;
  }
}

watch(
    () => sse.lastEvent,
    async (ev) => {
      if (!ev) return;

      // ✅ DM 관련 이벤트만
      if (ev.type !== "MESSAGE_RECEIVED") return;

      // ✅ 현재 보고 있는 대화방이면 메시지만 갱신
      if (ev.refId === conversationId.value) {
        const shouldStick = isNearBottom();

        // 전체 재조회 대신 "최신 페이지만" 다시 가져오기
        await loadFirst({ keepScroll: !shouldStick });

        if (shouldStick) scrollToBottom();
        return;
      }

      // ✅ 다른 대화방에서 온 메시지는 목록만 refresh (뱃지/미리보기 갱신)
      convStore.refresh();
    },
    { deep: true }
);

onMounted(async () => {
  const ok = await ensureSessionOrRedirect();
  if (!ok) return;

  await loadFirst();

  // 🔥 스크롤 이벤트 등록
  nextTick(() => {
    if (listRef.value) {
      listRef.value.addEventListener("scroll", onScroll);
    }
  });
});

onBeforeUnmount(() => {
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

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <div v-else ref="listRef" class="list">
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
  flex-direction:column
}
.topbar{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  margin-bottom:10px
}
.title{font-weight:950;text-align:center}
.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.list{
  flex:1;
  overflow-y:auto;
  display:flex;
  flex-direction:column;
  gap:10px;
  padding-bottom:12px
}
.more{display:grid;place-items:center}
.moreBtn{
  height:40px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text);
  font-weight:900
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
  white-space:pre-wrap
}
.msg.mine .bubble{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  border-color:color-mix(in oklab,var(--accent) 40%,var(--border))
}
.time{font-size:11px;color:var(--muted);margin-top:4px}
.composer{
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  padding-top:8px
}
.input{
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text)
}
.btn{
  height:44px;
  padding:0 14px;
  border-radius:16px;
  border:1px solid color-mix(in oklab,var(--accent) 55%,var(--border));
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  font-weight:950;
  color:var(--text)
}
.btn:disabled{opacity:.6}
</style>