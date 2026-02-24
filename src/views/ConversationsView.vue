, <!-- src/views/ConversationsView.vue -->
<script setup>
import { computed, onMounted } from "vue";
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

onMounted(async () => {
  await conv._refreshNow?.();
  if (!conv._refreshNow) await conv.refresh();
});
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1 class="title">대화</h1>
        <p class="sub">새 메시지는 SSE 이벤트 후 목록이 자동 갱신됩니다.</p>
      </div>
      <div class="actions">
        <RlButton size="sm" variant="soft" @click="conv.refresh()" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>
    <div v-else-if="items.length === 0" class="state">대화가 아직 없어요.</div>

    <div v-else class="list">
      <button
          v-for="c in items"
          :key="c.conversationId"
          class="item"
          type="button"
          @click="openConversation(c.conversationId)"
      >
        <div class="avatar"></div>

        <div class="content">
          <div class="row1">
            <div class="name">{{ c.peerUser?.nickname || "상대" }}</div>
            <div class="time">{{ (c.lastMessageAt || "").replace("T", " ").slice(0, 19) }}</div>
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
.head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:14px}
.title{font-size:20px;font-weight:950;margin:0}
.sub{margin:6px 0 0;color:var(--muted);font-size:12px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.state{padding:28px 0;text-align:center;color:var(--muted)}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.list{display:grid;gap:10px}
.item{
  width:100%;
  text-align:left;
  border:1px solid var(--border);
  border-radius:18px;
  padding:12px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  display:grid;
  grid-template-columns:38px 1fr auto;
  gap:10px;
  align-items:center;
  cursor:pointer;
}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--success));opacity:.6}
.content{display:grid;gap:6px}
.row1{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.name{font-weight:950;font-size:13px}
.time{font-size:12px;color:var(--muted)}
.row2{display:flex;justify-content:space-between;gap:10px;align-items:center}
.preview{font-size:13px;color:var(--text);opacity:.9;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--warning);color:#111;display:grid;place-items:center;font-size:12px;font-weight:950}
.chev{font-size:20px;opacity:.5}
.more{display:grid;place-items:center;padding:6px 0}
.moreBtn{height:40px;padding:0 12px;border-radius:14px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.end{font-size:12px;color:var(--muted)}
</style>