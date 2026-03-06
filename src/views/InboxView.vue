<!-- src/views/InboxView.vue (v3.6 bridge helper: pending action banner) -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readAllNotifications, readNotification, clearReadNotifications } from "@/api/notifications";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToastStore();
const noti = useNotificationsStore();
const busy = ref(false);
const cleaning = ref(false);
const autoReadDone = ref(false);

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const loading = computed(() => noti.loading);
const loadingMore = computed(() => noti.loadingMore);
const hasNext = computed(() => noti.hasNext);
const error = computed(() => noti.error);

const pendingAction = ref(null);
function loadPendingAction() {
  try { pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null"); }
  catch { pendingAction.value = null; }
}
function clearPendingAction() {
  try { sessionStorage.removeItem("reallife:pendingAction"); } catch {}
  pendingAction.value = null;
}
function goConversations() { router.push("/inbox/conversations"); }

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED" || t === "POST_COMMENT") return "댓글";
  if (t === "POST_LIKED") return "좋아요";
  if (t === "PIN_CREATED") return "핀";
  if (t === "PIN_REMIND") return "리마인드";
  return t || "알림";
}
function formatTime(iso) { return iso ? iso.replace("T", " ").slice(0, 19) : ""; }

async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}
async function markAllRead({ silent = false } = {}) {
  if (busy.value) return;
  busy.value = true;
  try {
    await readAllNotifications();
    await refreshNow();
    if (!silent) toast.success("완료", "알림을 모두 읽음 처리했어요.");
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally { busy.value = false; }
}
async function clearRead() {
  if (cleaning.value) return;
  cleaning.value = true;
  try {
    const res = await clearReadNotifications();
    const removedLocal = noti.purgeReadLocal?.() ?? 0;
    toast.success("정리 완료", `읽은 알림 ${res?.deletedCount ?? removedLocal ?? 0}개를 정리했어요.`);
    noti.refresh?.();
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    await refreshNow();
  } finally { cleaning.value = false; }
}
function enc(v) { return encodeURIComponent(String(v ?? "")); }
async function routeForNotification(n) {
  if (n.type === "PIN_CREATED" || n.type === "PIN_REMIND") {
    const cid = n.conversationId;
    if (!cid) return "/inbox/conversations";
    return `/inbox/conversations/${cid}/pins?pinId=${enc(n.refId)}&notiId=${enc(n.id)}`;
  }
  if (n.type === "MESSAGE_RECEIVED") {
    if (!n.refId) return "/inbox/conversations";
    if (n.messageId) return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1&mid=${enc(n.messageId)}`;
    return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
  }
  return "/inbox/conversations";
}
async function openItem(n) {
  try { if (!n.read) await readNotification(n.id); } catch {}
  const to = await routeForNotification(n);
  if (router.currentRoute.value.fullPath !== to) router.push(to);
  noti.refresh?.();
}

const sentinelEl = ref(null);
let io = null;
async function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return;
  await noti.loadMore({ size: 20 });
}
function attachObserver() {
  if (io) io.disconnect();
  io = new IntersectionObserver(async (entries) => {
    const e = entries?.[0];
    if (!e?.isIntersecting) return;
    await loadMore();
  }, { root: null, rootMargin: "200px", threshold: 0.01 });
  if (sentinelEl.value) io.observe(sentinelEl.value);
}

onMounted(async () => {
  loadPendingAction();
  await refreshNow();
  if (!autoReadDone.value && hasUnread.value) {
    autoReadDone.value = true;
    await markAllRead({ silent: true });
  }
  await nextTick();
  attachObserver();
});
onBeforeUnmount(() => { if (io) io.disconnect(); io = null; });
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1 class="title">Inbox</h1>
        <p class="sub">알림 & 메시지</p>
      </div>
      <div class="actions">
        <RlButton size="sm" variant="primary" @click="router.push('/inbox/new')">새 DM</RlButton>
        <RlButton size="sm" variant="soft" @click="router.push('/inbox/conversations')">대화</RlButton>
        <RlButton size="sm" variant="soft" @click="refreshNow" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <div v-if="pendingAction" class="bridge">
      <div class="bTitle">댓글에서 가져온 액션이 준비되어 있어요</div>
      <div class="bSub">
        <span v-if="pendingAction.kind==='PROMISE'">📅 약속</span>
        <span v-else-if="pendingAction.kind==='TODO'">✅ 할일</span>
        <span v-else>📍 장소</span>
        · "{{ pendingAction.text }}"
      </div>
      <div class="bActions">
        <RlButton size="sm" variant="primary" @click="goConversations">대화방 선택</RlButton>
        <RlButton size="sm" variant="soft" @click="clearPendingAction">닫기</RlButton>
      </div>
    </div>

    <div class="row2">
      <RlButton size="sm" variant="soft" @click="markAllRead()" :disabled="busy || loading || !items.length">전체 읽음</RlButton>
      <RlButton size="sm" variant="soft" @click="clearRead" :disabled="cleaning || loading || !items.length">읽은 알림 정리</RlButton>
    </div>

    <div v-if="loading && !items.length" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>
    <div v-else-if="items.length === 0" class="state">아직 알림이 없어요 ✨</div>

    <div v-else class="list">
      <button v-for="n in items" :key="n.id" class="item" :class="{ unread: !n.read }" type="button" @click="openItem(n)">
        <div class="line1">
          <span class="type">{{ formatType(n.type) }}</span>
          <span class="time">{{ formatTime(n.createdAt) }}</span>
        </div>
        <div class="body">{{ n.body }}</div>
      </button>

      <div ref="sentinelEl" class="sentinel">
        <div v-if="loadingMore" class="hint">불러오는 중…</div>
        <div v-else-if="!hasNext" class="hint">끝까지 다 봤어요 👀</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:16px 16px calc(90px + env(safe-area-inset-bottom));max-width:860px;margin:0 auto}.head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}.title{font-size:22px;font-weight:950;letter-spacing:-.02em}.sub{margin-top:2px;font-size:12px;opacity:.7}.actions,.row2{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.bridge{margin-top:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);border-radius:18px;padding:14px}.bTitle{font-weight:950}.bSub{margin-top:6px;font-size:13px;opacity:.82}.bActions{display:flex;gap:8px;margin-top:10px}.state{margin-top:20px;padding:24px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(255,255,255,.04);text-align:center}.err{color:#ffb4b4}.list{margin-top:14px;display:flex;flex-direction:column;gap:10px}.item{text-align:left;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;cursor:pointer;color:var(--text);box-shadow:0 10px 30px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .16s ease,background .16s ease,transform .16s ease}.item:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.07)}.item.unread{border-color:color-mix(in oklab,var(--accent) 30%, rgba(255,255,255,.16));background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.07));box-shadow:0 16px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.06)}.line1{display:flex;justify-content:space-between;gap:10px;align-items:center}.type{font-size:12px;font-weight:900;color:color-mix(in oklab,var(--text) 92%, white)}.time{font-size:12px;color:color-mix(in oklab,var(--muted) 82%, white)}.body{margin-top:6px;line-height:1.45;color:color-mix(in oklab,var(--text) 94%, white);font-weight:700}.item.unread .body{color:color-mix(in oklab,var(--text) 96%, white)}.sentinel{display:grid;place-items:center;padding:14px 0}.hint{font-size:12px;opacity:.65}
</style>
