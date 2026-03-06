<!-- src/views/InboxView.vue -->
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

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const unreadCount = computed(() => Number(noti.unreadCount || 0));
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
function pendingKindLabel(kind) {
  if (kind === "PROMISE") return "📅 약속";
  if (kind === "TODO") return "✅ 할일";
  return "📍 장소";
}
function pendingSourceRoute() {
  const p = pendingAction.value;
  if (!p) return "";
  if (p.sourceRoute) return String(p.sourceRoute);
  if (p.postId) return `/posts/${enc(p.postId)}`;
  return "";
}
function pendingSourceMeta() {
  const p = pendingAction.value;
  if (!p) return "";
  const author = p.sourcePostAuthorHandle || p.sourcePostAuthorName || p.authorHandle || "";
  const label = p.sourceLabel || "게시글 댓글";
  return author ? `${label} · ${String(author).replace(/^@?/, "@")}` : label;
}
function pendingSourcePreview() {
  const p = pendingAction.value;
  if (!p) return "";
  return String(p.sourcePostPreview || p.text || "").trim().slice(0, 88);
}
function goPendingSource() {
  const to = pendingSourceRoute();
  if (to) router.push(to);
}

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED" || t === "POST_COMMENT") return "댓글";
  if (t === "POST_LIKED" || t === "POST_LIKE") return "좋아요";
  if (t === "PIN_CREATED") return "핀";
  if (t === "PIN_REMIND") return "리마인드";
  return t || "알림";
}
function formatTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}
async function markAllRead() {
  if (busy.value) return;
  busy.value = true;
  noti.markAllLocalRead?.();
  try {
    await readAllNotifications();
    toast.success("완료", "알림을 모두 읽음 처리했어요.");
    noti.refresh?.();
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    await refreshNow();
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
    if (n.messageId || n.ref2Id) return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1&mid=${enc(n.messageId || n.ref2Id)}`;
    return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
  }
  if (n.type === "POST_COMMENT") {
    const pid = n.ref2Id || n.postId || null;
    if (pid) return `/posts/${enc(pid)}?notiId=${enc(n.id)}&fromNoti=1`;
    return "/inbox";
  }
  if (n.type === "POST_LIKE" || n.type === "POST_LIKED") {
    if (n.refId) return `/posts/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
    return "/inbox";
  }
  return "/inbox/conversations";
}
async function openItem(n) {
  const wasUnread = !n.read;
  if (wasUnread) noti.markLocalRead?.(n.id);
  try { if (wasUnread) await readNotification(n.id); } catch {}
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
  await nextTick();
  attachObserver();
});
onBeforeUnmount(() => { if (io) io.disconnect(); io = null; });
</script>

<template>
  <div class="page">
    <header class="head rl-cardish">
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

    <div v-if="pendingAction" class="bridge rl-cardish">
      <div class="bTopline">{{ pendingSourceMeta() }}</div>
      <div class="bTitle">댓글에서 가져온 액션이 준비되어 있어요</div>
      <div class="bSub">
        <span class="bKind">{{ pendingKindLabel(pendingAction.kind) }}</span>
        <span class="bQuote">“{{ pendingAction.text }}”</span>
      </div>
      <div v-if="pendingSourcePreview()" class="bSourcePreview">원문: {{ pendingSourcePreview() }}</div>
      <div class="bActions">
        <RlButton size="sm" variant="primary" @click="goConversations">대화방 선택</RlButton>
        <RlButton v-if="pendingSourceRoute()" size="sm" variant="soft" @click="goPendingSource">원문 보기</RlButton>
        <RlButton size="sm" variant="ghost" @click="clearPendingAction">닫기</RlButton>
      </div>
    </div>

    <div class="summary rl-cardish">
      <div class="sumLeft">
        <div class="sumTitle">읽지 않은 알림</div>
        <div class="sumValue">{{ unreadCount }}개</div>
      </div>
      <div class="sumActions">
        <RlButton size="sm" variant="soft" @click="markAllRead" :disabled="busy || loading || !hasUnread">전체 읽음</RlButton>
        <RlButton size="sm" variant="soft" @click="clearRead" :disabled="cleaning || loading || !items.length">읽은 알림 정리</RlButton>
      </div>
    </div>

    <div v-if="loading && !items.length" class="state rl-cardish">불러오는 중…</div>
    <div v-else-if="error" class="state err rl-cardish">{{ error }}</div>
    <div v-else-if="items.length === 0" class="state rl-cardish">아직 알림이 없어요 ✨</div>

    <div v-else class="list">
      <button v-for="n in items" :key="n.id" class="item rl-cardish" :class="{ unread: !n.read }" type="button" @click="openItem(n)">
        <div class="line1">
          <span class="typeWrap">
            <span class="type">{{ formatType(n.type) }}</span>
            <span v-if="!n.read" class="newBadge">NEW</span>
          </span>
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
.page{padding:16px 16px calc(92px + env(safe-area-inset-bottom));max-width:980px;margin:0 auto}
.rl-cardish{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 88%,transparent);box-shadow:0 18px 46px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.04)}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:14px;border-radius:20px}
.title{font-size:22px;font-weight:950;letter-spacing:-.02em}.sub{margin-top:2px;font-size:12px;opacity:.7}
.actions,.sumActions,.bActions{display:flex;gap:8px;flex-wrap:wrap}
.bridge,.summary{margin-top:14px;border-radius:20px;padding:14px}
.bTopline{font-size:11px;font-weight:800;letter-spacing:.02em;color:color-mix(in oklab,var(--accent) 76%, white)}
.bTitle,.sumTitle{font-weight:950}.bSub{margin-top:6px;font-size:13px;opacity:.92;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.bKind{font-weight:900}
.bQuote{opacity:.92}
.bSourcePreview{margin-top:8px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.72)}
.summary{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sumValue{margin-top:4px;font-size:24px;font-weight:950;letter-spacing:-.03em}
.state{margin-top:20px;padding:24px;border-radius:18px;text-align:center}.err{color:#ffb4b4}
.list{margin-top:14px;display:flex;flex-direction:column;gap:10px}
.item{text-align:left;border-radius:18px;padding:13px;cursor:pointer;color:var(--text);transition:border-color .16s ease,background .16s ease,transform .16s ease}
.item:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.07)}
.item.unread{border-color:color-mix(in oklab,var(--accent) 34%, rgba(255,255,255,.16));background:linear-gradient(180deg, color-mix(in oklab,var(--accent) 10%, rgba(255,255,255,.06)), rgba(255,255,255,.06));box-shadow:0 16px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.06)}
.line1{display:flex;justify-content:space-between;gap:10px;align-items:center}
.typeWrap{display:flex;align-items:center;gap:8px}
.type{font-size:12px;font-weight:900;color:color-mix(in oklab,var(--text) 92%, white)}
.newBadge{display:inline-flex;align-items:center;justify-content:center;height:18px;padding:0 7px;border-radius:999px;background:color-mix(in oklab,var(--accent) 72%, white);color:#0b1020;font-size:10px;font-weight:950}
.time{font-size:12px;color:color-mix(in oklab,var(--muted) 82%, white)}
.body{margin-top:6px;line-height:1.45;color:color-mix(in oklab,var(--text) 94%, white);font-weight:700}
.item.unread .body{color:color-mix(in oklab,var(--text) 96%, white)}
.sentinel{display:grid;place-items:center;padding:14px 0}.hint{font-size:12px;opacity:.65}
@media (max-width: 720px){
  .summary{align-items:flex-start;flex-direction:column}
}
</style>
