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

function openConversation(id) {
  router.push(`/inbox/conversations/${id}`);
}

function goNewDm() {
  router.push("/inbox/new");
}

// ✅ 목록 시간 자동 갱신용 tick (분 경계 맞춤)
const nowTick = ref(Date.now());
let _timeTimer = null;
let _timeTimer2 = null;

onMounted(async () => {
  // 목록 로딩
  await conv._refreshNow?.();
  if (!conv._refreshNow) await conv.refresh();

  // 분 경계에 맞춰 시간 라벨 갱신
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

  const now = nowTick.value; // ✅ 핵심: tick 사용

  const diffMs = now - t;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;

  const d = new Date(t);
  const nowD = new Date(now);

  const sameDay =
      d.getFullYear() === nowD.getFullYear() &&
      d.getMonth() === nowD.getMonth() &&
      d.getDate() === nowD.getDate();

  const y = new Date(nowD);
  y.setDate(nowD.getDate() - 1);

  const isYesterday =
      d.getFullYear() === y.getFullYear() &&
      d.getMonth() === y.getMonth() &&
      d.getDate() === y.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h < 12 ? "오전" : "오후";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${ap} ${hh}:${m}`;
  }

  if (isYesterday) return "어제";

  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return `${mm}/${dd}`;
}
</script>

<template>
  <div class="page">
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
            <div class="preview">{{ c.lastMessagePreview || " " }}</div>
            <span v-if="c.unreadCount > 0" class="badge">{{ c.unreadCount }}</span>
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
.page{padding:18px 14px 90px;max-width:760px;margin:0 auto}

.rl-cardish{
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(14px);
}

.head{
  border-radius: var(--r-lg);
  padding: 14px 14px;
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  align-items:flex-end;
  justify-content:space-between;
  margin-bottom:14px
}
.title{font-size:20px;font-weight:950;margin:0}
.sub{margin:6px 0 0;color:var(--muted);font-size:12px}
.actions{display:flex;gap:8px;flex-wrap:wrap}

.state{padding:28px 0;text-align:center;color:var(--muted)}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.cta{color:color-mix(in oklab, var(--accent) 88%, white); font-weight:950; cursor:pointer}

.list{display:grid;gap:10px}
.item{
  width:100%;
  text-align:left;
  border-radius: var(--r-lg);
  padding:12px;
  display:grid;
  grid-template-columns:38px 1fr auto;
  gap:10px;
  align-items:center;
  cursor:pointer;
  transition: transform .10s ease, border-color .12s ease, background .12s ease;
}
.item:hover{
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--accent) 32%, var(--border));
  background: color-mix(in oklab, var(--surface) 82%, transparent);
}

.avatar{
  width:38px;height:38px;border-radius:50%;
  background:
      radial-gradient(14px 14px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white));
  opacity:.75;
}
.content{display:grid;gap:6px;min-width:0}
.row1{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.name{font-weight:950;font-size:13px}
.time{font-size:12px;color:var(--muted)}
.row2{display:flex;justify-content:space-between;gap:10px;align-items:center}
.preview{font-size:13px;color:var(--text);opacity:.9;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--warning);color:#111;display:grid;place-items:center;font-size:12px;font-weight:950}
.chev{font-size:20px;opacity:.55}

.more{display:grid;place-items:center;padding:6px 0}
.moreBtn{height:40px;padding:0 12px;border-radius:14px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.end{font-size:12px;color:var(--muted)}
</style>