<!-- src/views/NewDirectMessageView.vue -->
<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";

import { searchUsers } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();

const q = ref("");
const loading = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const opening = ref(false);

const canSearch = computed(() => q.value.trim().length > 0);

let debounceTimer = null;

function pickInitial(u) {
  const raw = String(u?.nickname || u?.name || u?.handle || "").trim();
  if (!raw) return "U";
  const ch = raw[0];
  return ch.toUpperCase();
}

async function runSearch({ reset = true } = {}) {
  const query = q.value.trim();
  if (!query) {
    items.value = [];
    nextCursor.value = null;
    hasNext.value = false;
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const res = await searchUsers({
      q: query,
      cursor: reset ? null : nextCursor.value,
      size: 20,
    });

    if (reset) items.value = res.items;
    else items.value = [...items.value, ...res.items];

    nextCursor.value = res.nextCursor;
    hasNext.value = res.hasNext;
  } catch (e) {
    error.value = e?.response?.data?.message || "검색에 실패했어요.";
  } finally {
    loading.value = false;
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch({ reset: true }), 250);
}

watch(q, () => onInput());

async function openDirect(user) {
  const targetUserId = user?.userId;
  if (!targetUserId || opening.value) return;

  opening.value = true;
  try {
    const res = await createDirectConversation(targetUserId); // { conversationId }
    const conversationId = res?.conversationId;
    if (conversationId) {
      router.push(`/inbox/conversations/${conversationId}`);
      return;
    }
    toast.error("실패", "대화방을 열 수 없어요.");
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "대화방을 열 수 없어요.");
  } finally {
    opening.value = false;
  }
}

onMounted(async () => {
  await auth.ensureSession?.();
});
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1 class="title">새 DM</h1>
        <p class="sub">유저를 검색해서 바로 대화를 시작하세요.</p>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="soft" @click="router.back()">뒤로</RlButton>
        <RlButton size="sm" variant="soft" @click="runSearch({ reset: true })" :disabled="!canSearch || loading">
          검색
        </RlButton>
      </div>
    </header>

    <div class="searchBox">
      <input
          class="searchInput"
          v-model="q"
          placeholder="닉네임으로 검색 (예: seed)"
          autocomplete="off"
      />
    </div>

    <div v-if="error" class="state err">{{ error }}</div>
    <div v-else-if="loading" class="state">검색 중…</div>
    <div v-else-if="!q.trim()" class="state">검색어를 입력해 주세요.</div>
    <div v-else-if="items.length === 0" class="state">검색 결과가 없어요.</div>

    <div v-else class="list">
      <button
          v-for="u in items"
          :key="u.userId"
          class="item"
          type="button"
          @click="openDirect(u)"
          :disabled="opening"
      >
        <div class="avatar" aria-hidden="true">{{ pickInitial(u) }}</div>

        <div class="content">
          <div class="name">{{ u.nickname || "사용자" }}</div>
          <div class="meta">{{ u.handle ? `@${u.handle}` : u.userId }}</div>
        </div>

        <div class="chev">›</div>
      </button>

      <div class="more">
        <button v-if="hasNext" class="moreBtn" type="button" @click="runSearch({ reset: false })" :disabled="loading">
          더 보기
        </button>
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

.searchBox{
  border:1px solid var(--border);
  border-radius:18px;
  padding:10px 12px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  margin-bottom:12px;
}
.searchInput{
  width:100%;
  height:40px;
  border:none;
  outline:none;
  background:transparent;
  color:var(--text);
  font-size:14px;
}

.state{padding:18px 0;text-align:center;color:var(--muted)}
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
.item:disabled{opacity:.7;cursor:not-allowed}
.item:hover{border-color:color-mix(in oklab,var(--accent) 32%,var(--border))}
.avatar{
  width:38px;height:38px;border-radius:50%;
  display:grid;place-items:center;
  background:linear-gradient(135deg,var(--accent),var(--success));
  color:#0b0f14;font-weight:950;
  opacity:.75;
}
.content{display:grid;gap:6px}
.name{font-weight:950;font-size:13px}
.meta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chev{font-size:20px;opacity:.5}

.more{display:grid;place-items:center;padding:6px 0}
.moreBtn{height:40px;padding:0 12px;border-radius:14px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.end{font-size:12px;color:var(--muted)}
</style>