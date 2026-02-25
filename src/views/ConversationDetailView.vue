<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
import { getConversationLock, setConversationLock, disableConversationLock, issueUnlockToken } from "@/api/conversationLock";
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

/** 상대(목록 데이터 기반) */
const peer = computed(() => {
  const cid = conversationId.value;
  const row = convStore.items?.find((c) => String(c.conversationId) === String(cid));
  return row?.peerUser || null;
});

function peerInitial() {
  const s = String(peer.value?.nickname || peer.value?.name || peer.value?.handle || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function openPeerProfile() {
  const h = peer.value?.handle;
  const id = peer.value?.userId || peer.value?.id;
  if (h) return router.push(`/u/${h}`);
  if (id) return router.push(`/u/id/${id}`);
}

/** ====== DM 잠금(대화방 잠금) ====== */
const lockEnabled = ref(false);
const unlocked = ref(false);

const lockGatePw = ref("");

const lockModalOpen = ref(false);
const lockModalMode = ref("set"); // "set" | "disable"
const lockPw1 = ref("");
const lockPw2 = ref("");

function tokenKey() {
  return `conv_unlock_${conversationId.value}`;
}

function getSavedToken() {
  try {
    return sessionStorage.getItem(tokenKey()) || "";
  } catch {
    return "";
  }
}

function saveToken(token) {
  try {
    sessionStorage.setItem(tokenKey(), token);
  } catch {}
}

function clearToken() {
  try {
    sessionStorage.removeItem(tokenKey());
  } catch {}
}

const unlockToken = computed(() => getSavedToken());

async function refreshLockState() {
  try {
    const res = await getConversationLock(conversationId.value);
    lockEnabled.value = !!res?.enabled;

    if (!lockEnabled.value) {
      unlocked.value = true;
      return;
    }

    // 잠금 ON이면 토큰 있는지 확인
    unlocked.value = !!getSavedToken();
  } catch (e) {
    // 잠금 상태 조회 실패 → 보수적으로 잠금 OFF처럼 처리하지 않고, 안내만
    lockEnabled.value = false;
    unlocked.value = true;
  }
}

async function handleUnlockGate() {
  const pw = lockGatePw.value.trim();
  if (!pw) return;

  try {
    const res = await issueUnlockToken(conversationId.value, pw);
    if (!res?.token) throw new Error("no token");
    saveToken(res.token);
    lockGatePw.value = "";
    unlocked.value = true;

    // 잠금 풀린 뒤 메시지 로딩
    await loadFirst();
  } catch (e) {
    toast.error("잠금 해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
  }
}

function openLockModal(mode) {
  lockModalMode.value = mode;
  lockPw1.value = "";
  lockPw2.value = "";
  lockModalOpen.value = true;
}

function closeLockModal() {
  lockModalOpen.value = false;
  lockPw1.value = "";
  lockPw2.value = "";
}

async function submitLockModal() {
  if (lockModalMode.value === "set") {
    const p1 = lockPw1.value.trim();
    const p2 = lockPw2.value.trim();

    if (p1.length < 4) {
      toast.error("설정 실패", "비밀번호는 최소 4자 이상으로 설정해 주세요.");
      return;
    }
    if (p1 !== p2) {
      toast.error("설정 실패", "비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await setConversationLock(conversationId.value, p1);
      clearToken();
      lockEnabled.value = true;
      unlocked.value = false; // 다시 잠금 게이트로
      toast.success("완료", "이 DM은 잠금 상태가 됐어요.");
      closeLockModal();
    } catch (e) {
      toast.error("설정 실패", e?.response?.data?.message || "잠금 설정에 실패했습니다.");
    }
    return;
  }

  // disable
  const pw = lockPw1.value.trim();
  if (!pw) {
    toast.error("해제 실패", "비밀번호를 입력해 주세요.");
    return;
  }

  try {
    await disableConversationLock(conversationId.value, pw);
    lockEnabled.value = false;
    unlocked.value = true;
    clearToken();
    toast.success("완료", "잠금을 해제했습니다.");
    closeLockModal();
  } catch (e) {
    toast.error("해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
  }
}

/** ====== 메시지 영역 ====== */
const loading = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);

const scrollerRef = ref(null);
const newMsgCount = ref(0);

function hasMessage(messageId) {
  if (!messageId) return false;
  return items.value.some((m) => String(m.messageId) === String(messageId));
}

function scrollToBottom({ smooth = false } = {}) {
  nextTick(() => {
    const el = scrollerRef.value;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  });
}

function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}

function isNearBottom() {
  const el = scrollerRef.value;
  if (!el) return true;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < 160;
}

function appendIncomingMessage(payload) {
  if (!payload?.messageId) return;
  if (hasMessage(payload.messageId)) return;

  items.value.push(payload);

  if (isNearBottom()) {
    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });
  } else {
    newMsgCount.value += 1;
  }
}

function onScroll() {
  const el = scrollerRef.value;
  if (!el) return;

  if (el.scrollTop < 12) {
    if (hasNext.value && !loading.value) loadMore();
  }

  if (isNearBottom() && newMsgCount.value > 0) {
    newMsgCount.value = 0;
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

  // ✅ 잠금 ON인데 해제 전이면 메시지 로딩 금지
  if (lockEnabled.value && !unlocked.value) return;

  loading.value = true;
  error.value = "";

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

  try {
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    await markConversationRead(conversationId.value);

    convStore.setActiveConversation?.(conversationId.value);
    convStore.softSyncSoon?.();

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
    // 423: 잠김
    const msg = e?.response?.data?.message || "메시지를 불러오지 못했습니다.";
    error.value = msg;

    // 서버가 잠금이라고 하면 다시 게이트로
    if (e?.response?.status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  if (lockEnabled.value && !unlocked.value) return;

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

  const res = await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
    cursor: nextCursor.value,
    unlockToken: lockEnabled.value ? unlockToken.value : null,
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

  if (lockEnabled.value && !unlocked.value) {
    toast.error("전송 실패", "잠금이 해제되어야 전송할 수 있어요.");
    return;
  }

  sending.value = true;
  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: text,
      attachmentIds: [],
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    if (msg?.messageId && !hasMessage(msg.messageId)) {
      items.value.push(msg);
    }

    content.value = "";

    convStore.ingestMessageCreated?.({
      conversationId: conversationId.value,
      content: msg?.content,
      createdAt: msg?.createdAt,
    });

    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });
  } catch (e) {
    if (e?.response?.status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
      toast.error("전송 실패", "이 대화는 잠금 상태입니다. 먼저 잠금을 해제하세요.");
      return;
    }
    toast.error("전송 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    sending.value = false;
  }
}

function jumpToNewest() {
  newMsgCount.value = 0;
  scrollToBottom({ smooth: true });
}

let offEvent = null;

onMounted(async () => {
  const ok = await ensureSessionOrRedirect();
  if (!ok) return;

  convStore.setActiveConversation?.(conversationId.value);

  await refreshLockState();
  if (!lockEnabled.value || unlocked.value) {
    await loadFirst();
  }

  nextTick(() => {
    if (scrollerRef.value) scrollerRef.value.addEventListener("scroll", onScroll);
  });

  offEvent =
      sse.onEvent?.((ev) => {
        if (!ev) return;
        if (ev.type !== "message-created") return;

        let data = ev.data;
        try {
          if (typeof data === "string") data = JSON.parse(data);
        } catch {}

        if (String(data?.conversationId) !== String(conversationId.value)) return;

        // 잠금 상태여도 “새 메시지 도착” 자체는 표시만 (내용은 서버가 어차피 막음)
        appendIncomingMessage(data);
        convStore.softSyncSoon?.();
      }) ?? null;
});

onBeforeUnmount(() => {
  if (scrollerRef.value) scrollerRef.value.removeEventListener("scroll", onScroll);
  if (offEvent) offEvent();
  convStore.setActiveConversation?.(null);
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>

      <button class="peer" type="button" @click="openPeerProfile" :disabled="!peer">
        <div class="peerAva" aria-hidden="true">{{ peerInitial() }}</div>
        <div class="peerMeta">
          <div class="peerName">{{ peer?.nickname || peer?.name || "대화" }}</div>
          <div class="peerHandle" v-if="peer?.handle">@{{ peer.handle }}</div>
          <div class="peerHandle" v-else>프로필</div>
        </div>
      </button>

      <div class="right">
        <RlButton
            size="sm"
            variant="soft"
            @click="lockEnabled ? openLockModal('disable') : openLockModal('set')"
        >
          {{ lockEnabled ? "🔒 잠금 해제" : "🔓 잠금 설정" }}
        </RlButton>
      </div>
    </div>

    <!-- ✅ 잠금 게이트 -->
    <div v-if="lockEnabled && !unlocked" class="lockGate">
      <div class="lockCard">
        <div class="lockTitle">🔒 잠금된 대화</div>
        <div class="lockSub">비밀번호를 입력해야 대화를 볼 수 있어요.</div>

        <input
            v-model="lockGatePw"
            class="lockInput"
            type="password"
            placeholder="비밀번호 입력"
            @keydown.enter.prevent="handleUnlockGate"
        />

        <div class="lockActions">
          <button class="lockBtn" type="button" @click="handleUnlockGate">열기</button>
          <button class="lockBtn soft" type="button" @click="router.back()">뒤로</button>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

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
            :class="{ mine: myId && String(m.senderId) === String(myId) }"
        >
          <div class="bubble">{{ m.content }}</div>
          <div class="time">{{ (m.createdAt || "").replace("T", " ").slice(11, 16) }}</div>
        </div>

        <div class="bottomSpacer"></div>
      </div>
    </div>

    <button v-if="newMsgCount > 0" class="newBanner" type="button" @click="jumpToNewest">
      새 메시지 {{ newMsgCount }}개 · 아래로
    </button>

    <div class="composerWrap" v-if="!lockEnabled || unlocked">
      <div class="composerInner">
        <input v-model="content" class="input" placeholder="메시지 입력…" @keydown.enter.prevent="onSend" />
        <button class="btn" type="button" @click="onSend" :disabled="sending">
          {{ sending ? "..." : "전송" }}
        </button>
      </div>
    </div>

    <!-- ✅ 잠금 설정/해제 모달 -->
    <div v-if="lockModalOpen" class="modalBackdrop" @click.self="closeLockModal">
      <div class="modal rl-cardish">
        <div class="mTitle">
          {{ lockModalMode === "set" ? "🔓 대화 잠금 설정" : "🔒 대화 잠금 해제" }}
        </div>
        <div class="mSub" v-if="lockModalMode === 'set'">
          이 DM에 들어갈 때마다 비밀번호를 입력해야 해요.
        </div>
        <div class="mSub" v-else>
          잠금을 해제하려면 비밀번호를 입력해 주세요.
        </div>

        <div class="mBody">
          <input
              v-model="lockPw1"
              class="mInput"
              type="password"
              :placeholder="lockModalMode === 'set' ? '비밀번호' : '비밀번호 입력'"
              @keydown.enter.prevent="submitLockModal"
          />
          <input
              v-if="lockModalMode === 'set'"
              v-model="lockPw2"
              class="mInput"
              type="password"
              placeholder="비밀번호 확인"
              @keydown.enter.prevent="submitLockModal"
          />
        </div>

        <div class="mActions">
          <button class="mBtn" type="button" @click="submitLockModal">
            {{ lockModalMode === "set" ? "잠금 설정" : "잠금 해제" }}
          </button>
          <button class="mBtn soft" type="button" @click="closeLockModal">취소</button>
        </div>
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
  position: relative;
}

/* 상단바 */
.topbar{
  padding: 12px 12px 10px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
}

.peer{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  border:1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 84%, transparent);
  padding:8px 10px;
  border-radius: 16px;
  cursor:pointer;
  text-align:left;
}
.peer:disabled{opacity:.7;cursor:default}
.peer:hover{border-color: color-mix(in oklab, var(--accent) 28%, var(--border));}
.peerAva{
  width:34px;height:34px;border-radius:50%;
  display:grid;place-items:center;
  background:
      radial-gradient(12px 12px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white));
  color:#0b0f14;
  font-weight:950;
  flex:0 0 auto;
}
.peerMeta{min-width:0;display:flex;flex-direction:column;gap:2px}
.peerName{font-weight:950;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.peerHandle{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.right{display:flex;justify-content:flex-end}

.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

/* 잠금 게이트 */
.lockGate{
  flex:1;
  display:grid;
  place-items:center;
  padding: 0 14px 18px;
}
.lockCard{
  max-width: 420px;
  width: 100%;
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: var(--r-lg);
  padding: 16px;
  backdrop-filter: blur(14px);
}
.lockTitle{font-weight:950;font-size:16px}
.lockSub{margin-top:6px;color:var(--muted);font-size:12px}
.lockInput{
  width:100%;
  margin-top:12px;
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text);
}
.lockActions{display:flex;gap:8px;margin-top:12px}
.lockBtn{
  flex:1;
  height:44px;
  border-radius:16px;
  border:1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background:color-mix(in oklab, var(--accent) 16%, transparent);
  font-weight:950;
  color:var(--text);
}
.lockBtn.soft{
  border:1px solid var(--border);
  background:transparent;
}

/* 스크롤 */
.scroller{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px;
}

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

.bottomSpacer{height:10px}

.newBanner{
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 86px;
  z-index: 50;

  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 14%, var(--bg));
  color: var(--text);
  font-weight: 950;

  box-shadow: 0 10px 26px color-mix(in oklab, var(--accent) 18%, transparent);
  backdrop-filter: blur(10px);
}

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

/* modal */
.modalBackdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 1000;
  display:grid;
  place-items:center;
  padding: 14px;
}
.rl-cardish{
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(14px);
}
.modal{
  width: 100%;
  max-width: 420px;
  border-radius: var(--r-lg);
  padding: 16px;
}
.mTitle{font-weight:950;font-size:16px}
.mSub{margin-top:6px;color:var(--muted);font-size:12px}
.mBody{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.mInput{
  width:100%;
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text);
}
.mActions{display:flex;gap:8px;margin-top:12px}
.mBtn{
  flex:1;
  height:44px;
  border-radius:16px;
  border:1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background:color-mix(in oklab, var(--accent) 16%, transparent);
  font-weight:950;
  color:var(--text);
}
.mBtn.soft{
  border:1px solid var(--border);
  background:transparent;
}
</style>