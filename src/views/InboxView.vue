<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readAllNotifications, readNotification, clearReadNotifications } from "@/api/notifications";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "vue-router";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";

const router = useRouter();
const toast = useToastStore();
const noti = useNotificationsStore();

const busy = ref(false);
const cleaning = ref(false);
const inboxFilter = ref("PRIORITY");
const pendingAction = ref(null);
const sentinelEl = ref(null);
let io = null;

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const unreadCount = computed(() => Number(noti.unreadCount || 0));
const loading = computed(() => noti.loading);
const loadingMore = computed(() => noti.loadingMore);
const hasNext = computed(() => noti.hasNext);
const error = computed(() => noti.error);

const reminderItems = computed(() => (items.value || []).filter((n) => String(n?.type || "") === "PIN_REMIND"));
const messageItems = computed(() => (items.value || []).filter((n) => String(n?.type || "") === "MESSAGE_RECEIVED"));
const commentItems = computed(() => (items.value || []).filter((n) => ["COMMENT_CREATED", "POST_COMMENT"].includes(String(n?.type || ""))));
const reactionItems = computed(() => (items.value || []).filter((n) => ["POST_LIKE", "POST_LIKED", "FOLLOW"].includes(String(n?.type || ""))));
const unreadReminderCount = computed(() => reminderItems.value.filter((n) => !n.read).length);
const unreadMessageCount = computed(() => messageItems.value.filter((n) => !n.read).length);
const unreadCommentCount = computed(() => commentItems.value.filter((n) => !n.read).length);
const latestReminder = computed(() => sortedByRecency(reminderItems.value)[0] || null);
const latestMessage = computed(() => sortedByRecency(messageItems.value)[0] || null);
const latestComment = computed(() => sortedByRecency(commentItems.value)[0] || null);

const priorityItems = computed(() => sortForInbox(items.value || []).slice(0, 4));
const filteredItems = computed(() => {
  const list = items.value || [];
  switch (inboxFilter.value) {
    case 'PRIORITY': return sortForInbox(list);
    case 'REMINDER': return sortForInbox(list.filter((n) => String(n?.type || '') === 'PIN_REMIND'));
    case 'MESSAGE': return sortForInbox(list.filter((n) => String(n?.type || '') === 'MESSAGE_RECEIVED'));
    case 'COMMENT': return sortForInbox(list.filter((n) => ['COMMENT_CREATED', 'POST_COMMENT'].includes(String(n?.type || ''))));
    case 'REACTION': return sortForInbox(list.filter((n) => ['POST_LIKE','POST_LIKED','FOLLOW'].includes(String(n?.type || ''))));
    default: return sortForInbox(list);
  }
});
const filterChips = computed(() => ([
  { key: 'PRIORITY', label: `우선 확인 ${priorityItems.value.length}` },
  { key: 'REMINDER', label: `리마인더 ${reminderItems.value.length}` },
  { key: 'MESSAGE', label: `메시지 ${messageItems.value.length}` },
  { key: 'COMMENT', label: `댓글 ${commentItems.value.length}` },
  { key: 'REACTION', label: `반응 ${reactionItems.value.length}` },
]));
const prioritySummary = computed(() => {
  if (priorityItems.value[0]) return `${formatType(priorityItems.value[0].type)}부터 확인하면 가장 빨리 행동으로 이어질 수 있어요.`;
  return '새로 들어온 흐름이 생기면 여기에서 가장 먼저 보여줘요.';
});
const inboxSummaryPills = computed(() => {
  const list = [];
  if (unreadReminderCount.value) list.push(`리마인더 ${unreadReminderCount.value}`);
  if (unreadMessageCount.value) list.push(`답장 필요 ${unreadMessageCount.value}`);
  if (unreadCommentCount.value) list.push(`댓글 ${unreadCommentCount.value}`);
  if (reactionItems.value.length) list.push(`반응 ${reactionItems.value.length}`);
  if (!list.length) list.push('새 흐름 대기 중');
  return list;
});
const todayPriorityTitle = computed(() => {
  if (priorityItems.value[0]) return `${formatType(priorityItems.value[0].type)} 알림부터 보는 게 가장 좋아요`;
  return 'Inbox는 다음 행동으로 이어질 흐름을 가장 먼저 정리하는 공간이에요';
});
const todayPriorityBody = computed(() => {
  if (priorityItems.value[0]) return `${itemNextAction(priorityItems.value[0])} 먼저 확인하고 나머지 흐름을 정리하면 돼요.`;
  return '새 알림이 많지 않아도 Inbox는 댓글, 메시지, 리마인더를 실제 행동으로 묶어 주는 허브예요.';
});
const currentFilterLabel = computed(() => {
  return filterChips.value.find((c) => c.key === inboxFilter.value)?.label || '전체';
});

function sortedByRecency(list) {
  return [...(list || [])].sort((a, b) => ts(b?.createdAt) - ts(a?.createdAt));
}
function typePriority(n) {
  const type = String(n?.type || '');
  const unreadBoost = n?.read ? 0 : 1000;
  if (type === 'PIN_REMIND') return unreadBoost + 500;
  if (type === 'MESSAGE_RECEIVED') return unreadBoost + 400;
  if (type === 'POST_COMMENT' || type === 'COMMENT_CREATED') return unreadBoost + 300;
  if (type === 'PIN_CREATED' || type === 'PIN_UPDATED' || type === 'PIN_DONE' || type === 'PIN_CANCELED') return unreadBoost + 250;
  if (type === 'POST_LIKE' || type === 'POST_LIKED' || type === 'FOLLOW') return unreadBoost + 150;
  return unreadBoost + 100;
}
function ts(v) {
  const n = Date.parse(v || '');
  return Number.isFinite(n) ? n : 0;
}
function sortForInbox(list) {
  return [...(list || [])].sort((a, b) => {
    const pa = typePriority(a); const pb = typePriority(b);
    if (pb !== pa) return pb - pa;
    return ts(b?.createdAt) - ts(a?.createdAt);
  });
}
function loadPendingAction() {
  try { pendingAction.value = JSON.parse(sessionStorage.getItem('reallife:pendingAction') || 'null'); }
  catch { pendingAction.value = null; }
}
function goConversations() { router.push('/inbox/conversations'); }
function goNewDm() { router.push('/inbox/new'); }
function switchInboxFilter(next) { inboxFilter.value = next; }
function formatType(t) {
  if (t === 'MESSAGE_RECEIVED') return '메시지';
  if (t === 'COMMENT_CREATED' || t === 'POST_COMMENT') return '댓글';
  if (t === 'POST_LIKED' || t === 'POST_LIKE') return '좋아요';
  if (t === 'FOLLOW') return '팔로우';
  if (t === 'PIN_CREATED' || t === 'PIN_UPDATED') return '액션';
  if (t === 'PIN_REMIND') return '리마인더';
  return t || '알림';
}
function formatTime(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function itemStatus(n) {
  const type = String(n?.type || '');
  if (type === 'PIN_REMIND') return !n?.read ? '지금 확인' : '확인해 둔 리마인더';
  if (type === 'MESSAGE_RECEIVED') return !n?.read ? '답장 대기' : '최근 대화 흐름';
  if (type === 'POST_COMMENT' || type === 'COMMENT_CREATED') return !n?.read ? '반응 확인 필요' : '댓글 흐름 확인됨';
  if (type === 'POST_LIKE' || type === 'POST_LIKED' || type === 'FOLLOW') return !n?.read ? '가벼운 반응 도착' : '확인된 반응';
  return !n?.read ? '새 알림' : '확인한 알림';
}
function itemNextAction(n) {
  const type = String(n?.type || '');
  if (type === 'PIN_REMIND') return '원본 메시지 위치로 바로 이동해서 약속·할일 흐름 이어가기';
  if (type === 'MESSAGE_RECEIVED') return '대화로 이동해서 답장하거나 액션 만들기';
  if (type === 'POST_COMMENT' || type === 'COMMENT_CREATED') return '댓글 맥락 보고 약속·할일·장소 흐름으로 이어가기';
  if (type === 'POST_LIKE' || type === 'POST_LIKED' || type === 'FOLLOW') return '반응을 확인하고 필요한 경우 게시글로 이동하기';
  return '상세 흐름을 열어 다음 행동 정하기';
}
function itemPriorityTone(n) {
  const p = typePriority(n);
  if (p >= 1400) return 'strong';
  if (p >= 1200) return 'warning';
  return 'normal';
}
function enc(v) { return encodeURIComponent(String(v ?? '')); }
async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}
async function markAllRead() {
  if (busy.value) return; busy.value = true; noti.markAllLocalRead?.();
  try { await readAllNotifications(); toast.success('완료', '알림을 모두 읽음 처리했어요.'); noti.refresh?.(); }
  catch (e) { toast.error('실패', e?.response?.data?.message || '잠시 후 다시 시도해주세요.'); await refreshNow(); }
  finally { busy.value = false; }
}
async function clearRead() {
  if (cleaning.value) return; cleaning.value = true;
  try { const res = await clearReadNotifications(); const removedLocal = noti.purgeReadLocal?.() ?? 0; toast.success('정리 완료', `읽은 알림 ${res?.deletedCount ?? removedLocal ?? 0}개를 정리했어요.`); noti.refresh?.(); }
  catch (e) { toast.error('실패', e?.response?.data?.message || '잠시 후 다시 시도해주세요.'); await refreshNow(); }
  finally { cleaning.value = false; }
}
async function routeForNotification(n) {
  if (['PIN_CREATED','PIN_REMIND','PIN_UPDATED','PIN_DONE','PIN_CANCELED'].includes(n.type)) {
    const cid = n.conversationId; if (!cid) return '/inbox/conversations';
    const mid = n.ref2Id || n.messageId || null;
    if (mid) return `/inbox/conversations/${enc(cid)}?notiId=${enc(n.id)}&fromNoti=1&mid=${enc(mid)}&pinId=${enc(n.refId)}`;
    return `/inbox/conversations/${enc(cid)}/pins?pinId=${enc(n.refId)}&notiId=${enc(n.id)}`;
  }
  if (n.type === 'MESSAGE_RECEIVED') {
    if (!n.refId) return '/inbox/conversations';
    if (n.messageId || n.ref2Id) return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1&mid=${enc(n.messageId || n.ref2Id)}`;
    return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
  }
  if (n.type === 'POST_COMMENT') {
    const pid = n.ref2Id || n.postId || null; if (pid) return `/posts/${enc(pid)}?notiId=${enc(n.id)}&fromNoti=1`; return '/inbox';
  }
  if (n.type === 'POST_LIKE' || n.type === 'POST_LIKED') {
    if (n.refId) return `/posts/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`; return '/inbox';
  }
  return '/inbox/conversations';
}
async function openItem(n) {
  const wasUnread = !n.read;
  if (wasUnread) noti.markLocalRead?.(n.id);
  try { if (wasUnread) await readNotification(n.id); } catch {}
  const to = await routeForNotification(n);
  if (router.currentRoute.value.fullPath !== to) router.push(to);
  noti.refresh?.();
}
async function loadMore() { if (loading.value || loadingMore.value || !hasNext.value) return; await noti.loadMore({ size: 20 }); }
function attachObserver() {
  if (io) io.disconnect();
  io = new IntersectionObserver(async (entries) => { const e = entries?.[0]; if (!e?.isIntersecting) return; await loadMore(); }, { root: null, rootMargin: '200px', threshold: 0.01 });
  if (sentinelEl.value) io.observe(sentinelEl.value);
}
onMounted(async () => { loadPendingAction(); await refreshNow(); await nextTick(); attachObserver(); });
onBeforeUnmount(() => { if (io) io.disconnect(); io = null; });
</script>

<template>
  <div class="page">
    <header class="head rl-cardish">
      <div>
        <div class="eyebrow">CONNECT</div>
        <h1 class="title">Inbox</h1>
        <p class="sub">대화, 리마인더, 댓글 반응을 우선순위 순으로 정리해서 보여줘요.</p>
      </div>
      <div class="actions">
        <RlButton size="sm" variant="primary" @click="goNewDm">새 DM</RlButton>
        <RlButton size="sm" variant="soft" @click="goConversations">대화</RlButton>
        <RlButton size="sm" variant="soft" @click="refreshNow" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <section class="hero rl-cardish">
      <div class="heroMain">
        <div class="heroLabel">지금 먼저 확인할 흐름</div>
        <div class="heroTitle">{{ todayPriorityTitle }}</div>
        <div class="heroSub">{{ todayPriorityBody }}</div>
        <div class="heroPills">
          <span v-for="pill in inboxSummaryPills" :key="pill" class="heroPill">{{ pill }}</span>
        </div>
      </div>
      <div class="heroStats">
        <div class="heroStat"><strong>{{ unreadCount }}</strong><span>읽지 않은 알림</span></div>
        <div class="heroStat"><strong>{{ unreadReminderCount }}</strong><span>미확인 리마인더</span></div>
        <div class="heroStat"><strong>{{ unreadMessageCount }}</strong><span>답장 필요 메시지</span></div>
      </div>
    </section>

    <section class="priorityRail rl-cardish">
      <div class="priorityRail__head">
        <div>
          <div class="priorityRail__eyebrow">PRIORITY ORDER</div>
          <div class="priorityRail__title">우선 확인 순서</div>
        </div>
        <div class="priorityRail__hint">{{ prioritySummary }}</div>
      </div>
      <div class="priorityRail__list" v-if="priorityItems.length">
        <button v-for="n in priorityItems" :key="n.id" class="priorityMini" :class="`priorityMini--${itemPriorityTone(n)}`" type="button" @click="openItem(n)">
          <div class="priorityMini__top"><span>{{ formatType(n.type) }}</span><span>{{ formatTime(n.createdAt) }}</span></div>
          <div class="priorityMini__body">{{ n.body || '알림 내용을 열어 흐름을 확인해 보세요.' }}</div>
          <div class="priorityMini__foot">{{ itemNextAction(n) }}</div>
        </button>
      </div>
    </section>

    <AsyncStatePanel v-if="loading && !items.length" icon="⏳" title="새 흐름을 불러오는 중이에요" description="리마인더, 메시지, 댓글 흐름을 모으고 있어요." tone="loading" :show-actions="false" />
    <AsyncStatePanel v-else-if="error" icon="⚠️" title="Connect 흐름을 불러오지 못했어요" :description="error" tone="danger" primary-label="다시 시도" secondary-label="대화로 이동" @primary="refreshNow" @secondary="goConversations" />
    <AsyncStatePanel v-else-if="items.length === 0" icon="✨" title="아직 이어질 흐름이 없어요" description="새 메시지, 댓글, 리마인더가 생기면 이곳에서 바로 다음 행동으로 이어갈 수 있어요." primary-label="새 DM 시작" secondary-label="새로고침" @primary="goNewDm" @secondary="refreshNow" />

    <div v-else class="listWrap">
      <section class="summary rl-cardish">
        <div class="sumLeft"><div class="sumTitle">알림 요약</div><div class="sumValue">{{ unreadCount }}개</div></div>
        <div class="sumMeta">
          <span class="sumChip">리마인더 {{ reminderItems.length }}</span>
          <span class="sumChip">메시지 {{ messageItems.length }}</span>
          <span class="sumChip">댓글 {{ commentItems.length }}</span>
          <span class="sumChip">반응 {{ reactionItems.length }}</span>
          <span class="sumChip">현재 보기 {{ currentFilterLabel }}</span>
        </div>
        <div class="sumActions">
          <RlButton size="sm" variant="soft" @click="markAllRead" :disabled="busy || loading || !hasUnread">전체 읽음</RlButton>
          <RlButton size="sm" variant="soft" @click="clearRead" :disabled="cleaning || loading || !items.length">읽은 알림 정리</RlButton>
        </div>
      </section>

      <div class="listHead">
        <div>
          <div class="listTitle">모든 알림</div>
          <div class="listSub">리마인더 → 메시지 → 댓글/반응 순으로 우선순위를 높여 정렬해 보여줘요.</div>
        </div>
        <div class="listGuide">필터를 바꾸면 해당 종류만 우선순위 기준으로 다시 정리해 보여줘요.</div>
      </div>

      <div class="filterRail">
        <button v-for="chip in filterChips" :key="chip.key" class="filterChip" :class="{ on: inboxFilter === chip.key }" type="button" @click="switchInboxFilter(chip.key)">{{ chip.label }}</button>
      </div>

      <div v-if="filteredItems.length === 0" class="filteredEmpty rl-cardish">선택한 필터에 맞는 알림이 아직 없어요. 다른 필터로 바꾸면 다른 흐름을 확인할 수 있어요.</div>

      <div v-else class="list">
        <button v-for="n in filteredItems" :key="n.id" class="item rl-cardish" :class="[{ unread: !n.read }, `item--${itemPriorityTone(n)}`]" type="button" @click="openItem(n)">
          <div class="line1">
            <span class="typeWrap"><span class="type">{{ formatType(n.type) }}</span><span v-if="!n.read" class="newBadge">NEW</span></span>
            <span class="time">{{ formatTime(n.createdAt || n.createdDateTime) }}</span>
          </div>
          <div class="body">{{ n.body || '알림 내용이 도착하면 여기에 보여요.' }}</div>
          <div class="statusBox">
            <div class="statusLine"><span class="statusLabel">현재 상태</span><span class="statusValue">{{ itemStatus(n) }}</span></div>
            <div class="statusLine"><span class="statusLabel">다음 액션</span><span class="statusValue statusValue--muted">{{ itemNextAction(n) }}</span></div>
          </div>
          <div class="line2"><span class="hint">{{ typePriority(n) >= 1400 ? '지금 바로 열기' : '상세 흐름 보기' }}</span><span class="arrow">›</span></div>
        </button>
      </div>

      <div ref="sentinelEl" class="sentinel">
        <div v-if="loadingMore" class="loadingMore">더 불러오는 중…</div>
        <div v-else-if="!hasNext" class="end">여기까지 확인했어요 ✨</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 96px;max-width:980px;margin:0 auto;display:grid;gap:12px}
.rl-cardish{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 86%,transparent);box-shadow:0 18px 60px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.06) inset;backdrop-filter:blur(14px)}
.head{border-radius:22px;padding:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}.title{margin:6px 0 0;font-size:24px;font-weight:950}.sub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.45}.actions{display:flex;gap:8px;flex-wrap:wrap}
.hero{border-radius:24px;padding:16px;display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.heroLabel{font-size:12px;font-weight:900;letter-spacing:.05em;color:color-mix(in oklab,var(--accent) 78%,white)}.heroTitle{margin-top:8px;font-size:22px;font-weight:950;line-height:1.22}.heroSub{margin-top:8px;color:var(--muted);line-height:1.55}.heroPills{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}.heroPill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);font-size:12px;font-weight:900}.heroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.heroStat{padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:5px}.heroStat strong{font-size:22px;font-weight:950}.heroStat span{font-size:12px;color:var(--muted)}
.priorityRail{border-radius:22px;padding:15px;display:grid;gap:10px}.priorityRail__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.priorityRail__eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}.priorityRail__title{margin-top:6px;font-size:18px;font-weight:950}.priorityRail__hint{max-width:360px;color:var(--muted);font-size:13px;line-height:1.5}.priorityRail__list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.priorityMini{padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);text-align:left;display:grid;gap:8px}.priorityMini--strong{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,transparent),rgba(255,255,255,.04))}.priorityMini--warning{background:linear-gradient(180deg,color-mix(in oklab,var(--warning) 8%,transparent),rgba(255,255,255,.04))}.priorityMini__top{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:var(--muted)}.priorityMini__body{font-size:13px;font-weight:900;line-height:1.5}.priorityMini__foot{font-size:12px;color:var(--muted);line-height:1.5}
.summary{border-radius:20px;padding:14px 15px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.sumTitle{font-size:12px;color:var(--muted);font-weight:900}.sumValue{margin-top:4px;font-size:24px;font-weight:950}.sumMeta{display:flex;gap:8px;flex-wrap:wrap}.sumChip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);font-size:12px;font-weight:900}.sumActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.listWrap{display:grid;gap:10px}.listHead{padding:2px 2px 0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.listTitle{font-size:18px;font-weight:950}.listSub{margin-top:4px;color:var(--muted);font-size:13px}.listGuide{font-size:12px;color:var(--muted);max-width:320px;text-align:right;line-height:1.5}.filterRail{display:flex;gap:8px;flex-wrap:wrap}.filterChip{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);font-size:12px;font-weight:900}.filterChip.on{background:color-mix(in oklab,var(--accent) 18%,transparent);border-color:color-mix(in oklab,var(--accent) 35%,var(--border))}.filteredEmpty{padding:14px;border-radius:18px;color:var(--muted)}
.list{display:grid;gap:10px}.item{width:100%;text-align:left;border-radius:18px;padding:14px;cursor:pointer;transition:transform .14s ease,border-color .18s ease,background .18s ease}.item:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 30%,var(--border))}.item.unread{border-color:color-mix(in oklab,var(--accent) 28%,var(--border));background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 7%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}.item--strong{border-color:color-mix(in oklab,var(--accent) 30%,var(--border))}.item--warning{border-color:color-mix(in oklab,var(--warning) 22%,var(--border))}.line1,.line2{display:flex;align-items:center;justify-content:space-between;gap:10px}.typeWrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.type{font-size:12px;font-weight:900;color:color-mix(in oklab,var(--text) 92%,white)}.newBadge{height:20px;padding:0 8px;border-radius:999px;background:color-mix(in oklab,var(--accent) 72%,white);color:#0b1020;font-size:11px;font-weight:950;display:inline-flex;align-items:center}.time{font-size:12px;color:var(--muted)}.body{margin-top:9px;line-height:1.5;color:color-mix(in oklab,var(--text) 90%,white)}.statusBox{margin-top:11px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:grid;gap:7px}.statusLine{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.statusLabel{font-size:11px;font-weight:900;letter-spacing:.06em;color:var(--muted);min-width:62px}.statusValue{font-size:12px;font-weight:900;line-height:1.45;text-align:right}.statusValue--muted{color:var(--muted);font-weight:800}.line2{margin-top:10px}.hint{font-size:12px;color:var(--muted);font-weight:800}.arrow{font-size:20px;opacity:.45}.sentinel{padding:8px 0 2px;text-align:center}.loadingMore,.end{font-size:12px;color:var(--muted)}
@media (max-width:900px){.hero,.summary{grid-template-columns:1fr}.heroStats{grid-template-columns:1fr 1fr 1fr}.priorityRail__list{grid-template-columns:1fr 1fr}.sumActions{justify-content:flex-start}.listGuide{text-align:left;max-width:none}}
@media (max-width:640px){.page{padding:14px 12px 96px}.title{font-size:22px}.heroTitle{font-size:20px}.heroStats,.priorityRail__list{grid-template-columns:1fr}.statusLine{grid-template-columns:1fr;display:grid}.statusValue{text-align:left}}
</style>

