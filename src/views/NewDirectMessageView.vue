<!-- src/views/NewDirectMessageView.vue -->
<script setup>
import { computed, onMounted, ref, watch, nextTick } from "vue";
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
const qCommitted = ref("");

const loading = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const opening = ref(false);
const inputRef = ref(null);

const canSearch = computed(() => q.value.trim().length > 0);

let t = null;

function initial(u) {
  const s = String(u?.nickname || u?.name || u?.handle || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function escBack(e) {
  if (e.key === "Escape") router.back();
  if (e.key === "Enter") runSearch({ reset: true });
}

async function runSearch({ reset = true } = {}) {
  const query = q.value.trim();
  if (!query) {
    items.value = [];
    nextCursor.value = null;
    hasNext.value = false;
    qCommitted.value = "";
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

    qCommitted.value = query;

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

function onTyping() {
  clearTimeout(t);
  t = setTimeout(() => runSearch({ reset: true }), 260);
}

watch(q, () => onTyping());

async function openDirect(u) {
  const targetUserId = u?.userId;
  if (!targetUserId || opening.value) return;

  opening.value = true;
  try {
    const res = await createDirectConversation(targetUserId); // { conversationId }
    const cid = res?.conversationId;
    if (!cid) throw new Error("no conversationId");
    router.push(`/inbox/conversations/${cid}`);
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "대화방을 열 수 없어요.");
  } finally {
    opening.value = false;
  }
}

onMounted(async () => {
  await auth.ensureSession?.();
  await nextTick();
  inputRef.value?.focus?.();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="heroTop">
        <RlButton size="sm" variant="ghost" @click="router.back()">←</RlButton>
        <div class="heroTitle">
          <div class="h1">새 DM</div>
          <div class="h2">닉네임으로 검색해서 바로 대화를 시작하세요.</div>
        </div>
        <div class="spacer"></div>
      </div>

      <div class="searchBar rl-cardish">
        <div class="mag" aria-hidden="true">⌕</div>
        <input
            ref="inputRef"
            v-model="q"
            class="input"
            placeholder="닉네임 검색… (Enter)"
            autocomplete="off"
            @keydown="escBack"
        />
        <RlButton size="sm" variant="primary" @click="runSearch({ reset: true })" :disabled="!canSearch || loading">
          검색
        </RlButton>
      </div>

      <div class="hint">
        <span class="pill">Enter</span> 검색
        <span class="dot">·</span>
        <span class="pill">Esc</span> 뒤로
      </div>
    </header>

    <section class="body">
      <div v-if="error" class="state err">{{ error }}</div>
      <div v-else-if="loading && items.length === 0" class="state">검색 중…</div>
      <div v-else-if="!qCommitted" class="state">검색어를 입력해 주세요.</div>
      <div v-else-if="items.length === 0" class="state">검색 결과가 없어요.</div>

      <div v-else class="list">
        <button
            v-for="u in items"
            :key="u.userId"
            class="card rl-cardish"
            type="button"
            @click="openDirect(u)"
            :disabled="opening"
        >
          <div class="ava" aria-hidden="true">{{ initial(u) }}</div>

          <div class="meta">
            <div class="name">{{ u.nickname || "사용자" }}</div>
            <div class="sub">
              <span v-if="u.handle">@{{ u.handle }}</span>
              <span v-else class="muted">{{ u.userId }}</span>
            </div>
          </div>

          <div class="go" aria-hidden="true">›</div>
        </button>

        <div class="more">
          <RlButton
              v-if="hasNext"
              size="sm"
              variant="soft"
              @click="runSearch({ reset: false })"
              :disabled="loading"
          >
            더 보기
          </RlButton>
          <div v-else class="end">끝 ✨</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:760px;margin:0 auto}

.hero{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.heroTop{display:flex;align-items:center;gap:10px}
.heroTitle{display:flex;flex-direction:column;gap:4px}
.h1{font-size:20px;font-weight:950;letter-spacing:.2px}
.h2{font-size:12px;color:var(--muted)}
.spacer{flex:1}

.rl-cardish{
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  backdrop-filter: blur(14px);
}

.searchBar{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  border-radius: var(--r-lg);
  padding: 10px 10px;
}
.mag{
  width:34px;height:34px;border-radius:12px;
  display:grid;place-items:center;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 20%, var(--border));
  color: color-mix(in oklab, var(--accent) 80%, white);
  font-weight: 900;
}
.input{
  height: 40px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
}

.hint{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px}
.pill{
  padding:3px 8px;border-radius:999px;
  border:1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text);
  font-weight: 850;
  font-size: 11px;
}
.dot{opacity:.6}

.body{display:flex;flex-direction:column;gap:10px}
.state{padding:22px 0;text-align:center;color:var(--muted)}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

.list{display:flex;flex-direction:column;gap:10px}
.card{
  width:100%;
  text-align:left;
  border-radius: var(--r-lg);
  padding: 12px;
  display:grid;
  grid-template-columns:42px 1fr auto;
  gap:12px;
  align-items:center;
  cursor:pointer;
  transition: transform .10s ease, border-color .12s ease, background .12s ease;
}
.card:hover{
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--accent) 32%, var(--border));
  background: color-mix(in oklab, var(--surface) 82%, transparent);
}
.card:disabled{opacity:.65;cursor:not-allowed;transform:none}

.ava{
  width:42px;height:42px;border-radius:50%;
  display:grid;place-items:center;
  background:
      radial-gradient(18px 18px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 80%, white), color-mix(in oklab, var(--success) 70%, white));
  color: #0b0f14;
  font-weight: 950;
}
.meta{display:flex;flex-direction:column;gap:6px;min-width:0}
.name{font-weight:950;font-size:13.5px}
.sub{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.go{font-size:22px;opacity:.55}

.more{display:grid;place-items:center;padding:6px 0}
.end{font-size:12px;color:var(--muted)}
</style>