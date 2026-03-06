<!-- src/views/ConversationsView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import { useConversationsStore } from "@/stores/conversations";

const router = useRouter();
const conv = useConversationsStore();

const items = computed(() => conv.items);
const loading = computed(() => conv.loading);
const error = computed(() => conv.error);
const unreadTotal = computed(() => (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0));

const pendingAction = ref(null);
const pendingActionExists = computed(() => !!pendingAction.value);
const pendingTargetConversationId = ref("");

function loadPendingAction() {
  try {
    pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
  } catch {
    pendingAction.value = null;
  }
}
function loadPendingTarget() {
  try { pendingTargetConversationId.value = String(sessionStorage.getItem("reallife:pendingActionTargetConversationId") || ""); }
  catch { pendingTargetConversationId.value = ""; }
}
function markPendingTarget(conversationId) {
  const v = String(conversationId || "");
  try { sessionStorage.setItem("reallife:pendingActionTargetConversationId", v); } catch {}
  pendingTargetConversationId.value = v;
}
function isPendingTarget(conversationId) {
  return pendingActionExists.value && String(conversationId) === String(pendingTargetConversationId.value || "");
}

function openConversation(id) {
  if (pendingActionExists.value) markPendingTarget(id);
  router.push(`/inbox/conversations/${id}`);
}

function goNewDm() {
  router.push("/inbox/new");
}

const nowTick = ref(Date.now());
let _timeTimer = null;
let _timeTimer2 = null;

onMounted(async () => {
  loadPendingAction();
  loadPendingTarget();
  await conv._refreshNow?.();
  if (!conv._refreshNow) await conv.refresh();

  const delay = 60000 - (Date.now() % 60000);
  _timeTimer = setTimeout(() => {
    nowTick.value = Date.now();
    _timeTimer2 = setInterval(() => {
      nowTick.value = Date.now();
    }, 60000);
  }, delay);
});

onBeforeUnmount(() => {
  if (_timeTimer) clearTimeout(_timeTimer);
  if (_timeTimer2) clearInterval(_timeTimer2);
  _timeTimer = null;
  _timeTimer2 = null;
});

function fmtListTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";

  const now = nowTick.value;
  const diffMs = now - t;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;

  const d = new Date(t);
  const nowD = new Date(now);
  const sameDay = d.getFullYear() === nowD.getFullYear() && d.getMonth() === nowD.getMonth() && d.getDate() === nowD.getDate();
  const y = new Date(nowD); y.setDate(nowD.getDate() - 1);
  const isYesterday = d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h < 12 ? "오전" : "오후";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${ap} ${hh}:${m}`;
  }
  if (isYesterday) return "어제";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
</script>

<template>
  <div class="page">
    <div v-if="pendingActionExists" class="pendingBanner rl-cardish" role="status">
      <div class="pbLeft">
        <div class="pbTitle">댓글에서 만든 액션이 준비돼 있어요</div>
        <div class="pbSub">대화방을 열면 입력창과 Dock 흐름으로 바로 이어집니다.</div>
      </div>
      <RlButton size="sm" variant="primary" @click="goNewDm">새 대화</RlButton>
    </div>

    <header class="head rl-cardish">
      <div class="left">
        <h1 class="title">대화</h1>
        <p class="sub">새 메시지는 실시간으로 목록이 갱신돼요.</p>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="primary" @click="goNewDm">새 DM</RlButton>
        <RlButton size="sm" variant="soft" @click="conv.refresh()" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <div class="summary rl-cardish">
      <div>
        <div class="sumTitle">읽지 않은 대화</div>
        <div class="sumValue">{{ unreadTotal }}개</div>
      </div>
      <div class="sumHint">대화방에 들어가면 해당 방 unread는 바로 정리돼요.</div>
    </div>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>
    <div v-else-if="items.length === 0" class="state">
      아직 대화가 없어요. <span class="cta" @click="goNewDm">새 DM</span>으로 시작해봐요 ✨
    </div>

    <div v-else class="list">
      <button
        v-for="c in items"
        :key="c.conversationId"
        class="item rl-cardish"
        :class="{ itemPending: pendingActionExists, itemPendingTarget: isPendingTarget(c.conversationId), itemUnread: (c.unreadCount || 0) > 0 }"
        type="button"
        @click="openConversation(c.conversationId)"
      >
        <div class="avatar" aria-hidden="true"></div>

        <div class="content">
          <div class="row1">
            <div class="name">{{ c.peerUser?.nickname || "상대" }}</div>
            <div class="time">{{ fmtListTime(c.lastMessageAt || c.updatedAt) }}</div>
          </div>
          <div class="row2">
            <div class="preview">{{ c.lastMessagePreview || "메시지가 오면 여기에 보여요." }}</div>
            <div class="rightMeta">
              <span v-if="pendingActionExists" class="takeHint" :class="{ takeHintTarget: isPendingTarget(c.conversationId) }">{{ isPendingTarget(c.conversationId) ? "여기로 가져오기" : "가져오기" }}</span>
              <span v-if="c.unreadCount > 0" class="badge">{{ c.unreadCount > 99 ? '99+' : c.unreadCount }}</span>
            </div>
          </div>
        </div>

        <div class="chev">›</div>
      </button>

      <div class="more">
        <button v-if="conv.hasNext" class="moreBtn" type="button" @click="conv.loadMore()">더 보기</button>
        <div v-else class="end">끝 ✨</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:980px;margin:0 auto}
.rl-cardish{border:1px solid color-mix(in oklab, var(--border) 88%, transparent);background:color-mix(in oklab, var(--surface) 86%, transparent);box-shadow:0 18px 60px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.06) inset;backdrop-filter: blur(14px)}
.pendingBanner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px;margin-bottom:12px;border-radius:16px}
.pbTitle{font-weight:950}.pbSub{margin-top:4px;font-size:12.5px;color:var(--muted)}
.takeHint{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;font-weight:800;white-space:nowrap;color:color-mix(in oklab,var(--text) 90%, white);transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease}
.takeHintTarget{border-color:color-mix(in oklab,var(--accent) 44%, rgba(255,255,255,.14));background:color-mix(in oklab,var(--accent) 18%, rgba(255,255,255,.06));box-shadow:0 0 0 1px rgba(255,255,255,.04) inset, 0 8px 20px color-mix(in oklab,var(--accent) 18%, transparent);transform:translateY(-1px)}
.head{border-radius:var(--r-lg);padding:15px 15px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:14px}
.title{font-size:20px;font-weight:950;margin:0}.sub{margin:6px 0 0;color:var(--muted);font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap}
.summary{border-radius:18px;padding:14px 15px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.sumTitle{font-size:12px;color:var(--muted);font-weight:800}.sumValue{margin-top:4px;font-size:24px;font-weight:950;letter-spacing:-.03em}.sumHint{font-size:12px;color:var(--muted)}
.state{padding:28px 0;text-align:center;color:var(--muted)}.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}.cta{color:color-mix(in oklab, var(--accent) 88%, white); font-weight:950; cursor:pointer}
.list{display:grid;gap:10px}
.item{width:100%;min-height:76px;text-align:left;border-radius:var(--r-lg);padding:12px;display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;cursor:pointer;transition: transform .14s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease}
.itemPending{border-color: color-mix(in oklab, var(--accent) 18%, var(--border));}
.itemUnread{border-color: color-mix(in oklab, var(--accent) 28%, var(--border));}
.itemPendingTarget{transform: translateY(-2px) scale(1.012);border-color: color-mix(in oklab, var(--accent) 42%, var(--border));background:linear-gradient(180deg, color-mix(in oklab, var(--accent) 10%, var(--surface)), color-mix(in oklab, var(--surface) 88%, transparent));box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab, var(--accent) 22%, transparent) inset,0 0 28px color-mix(in oklab, var(--accent) 18%, transparent);animation: pendingTargetPulse 2.4s ease-in-out infinite}
.item:hover{transform: translateY(-1px);border-color: color-mix(in oklab, var(--accent) 32%, var(--border));background: color-mix(in oklab, var(--surface) 82%, transparent)}
.itemPendingTarget:hover{transform: translateY(-3px) scale(1.014)}
.avatar{width:38px;height:38px;border-radius:50%;background:radial-gradient(14px 14px at 30% 30%, rgba(255,255,255,.22), transparent 60%),linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white))}
.content{min-width:0}.row1,.row2{display:flex;align-items:center;justify-content:space-between;gap:10px}.row2{margin-top:5px}.name{font-weight:950;color:var(--text)}.time{font-size:12px;color:var(--muted)}.preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:color-mix(in oklab,var(--text) 88%, white)}.rightMeta{display:flex;align-items:center;gap:8px;flex-shrink:0}.badge{min-width:24px;height:24px;padding:0 7px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in oklab,var(--accent) 72%, white);color:#0b1020;font-size:12px;font-weight:950;box-shadow:0 8px 18px rgba(0,0,0,.18)}.chev{font-size:22px;opacity:.45}
.more{display:grid;place-items:center;padding:8px 0 4px}.moreBtn{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:var(--text);font-weight:900}.end{font-size:12px;opacity:.7}
@keyframes pendingTargetPulse {0%,100%{box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab, var(--accent) 22%, transparent) inset,0 0 22px color-mix(in oklab, var(--accent) 12%, transparent)}50%{box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab, var(--accent) 28%, transparent) inset,0 0 32px color-mix(in oklab, var(--accent) 20%, transparent)}}
@media (max-width: 720px){.summary{flex-direction:column;align-items:flex-start}.item{grid-template-columns:38px 1fr auto}.row2{align-items:flex-start;flex-direction:column}.rightMeta{width:100%;justify-content:space-between}}
</style>
