
<!-- src/components/chat/GroupUserSearchPanel.vue -->
<script setup>
import RlButton from "@/components/ui/RlButton.vue";

const props = defineProps({
  q: { type: String, default: "" },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  canSearch: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
});
const emit = defineEmits(["update:q", "search", "load-more", "add"]);

function updateQ(e) {
  emit("update:q", e?.target?.value || "");
}
function userInitial(u) {
  const s = String(u?.nickname || u?.name || u?.handle || "").trim();
  return s ? s[0].toUpperCase() : "U";
}
</script>

<template>
  <section class="panel rl-cardish">
    <div class="panelHead">
      <div>
        <div class="eyebrow">사용자 검색</div>
        <div class="title">그룹에 초대할 사람을 찾아보세요</div>
      </div>
      <RlButton size="sm" variant="soft" @click="$emit('search')" :disabled="!canSearch || loading">검색</RlButton>
    </div>

    <div class="searchBar">
      <div class="mag">⌕</div>
      <input :value="q" class="input" placeholder="닉네임 검색…" autocomplete="off" @input="updateQ" @keydown.enter="$emit('search')" />
    </div>

    <div v-if="error" class="state err">{{ error }}</div>
    <div v-else-if="loading && items.length === 0" class="state">검색 중…</div>
    <div v-else-if="!q" class="state">검색어를 입력하면 멤버 후보가 여기에 보여요.</div>
    <div v-else-if="items.length === 0" class="state">검색 결과가 없어요.</div>

    <div v-else class="list">
      <article v-for="u in items" :key="u.userId" class="userCard">
        <div class="ava">{{ userInitial(u) }}</div>
        <div class="meta">
          <div class="name">{{ u.nickname || u.name || "사용자" }}</div>
          <div class="sub">{{ u.handle ? `@${u.handle}` : u.userId }}</div>
        </div>
        <RlButton size="sm" variant="primary" @click="$emit('add', u)">추가</RlButton>
      </article>

      <div class="moreWrap">
        <RlButton v-if="hasNext" size="sm" variant="soft" @click="$emit('load-more')" :disabled="loading">
          더 불러오기
        </RlButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel{padding:16px;border-radius:24px;display:grid;gap:12px}
.panelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.title{margin-top:4px;font-size:18px;font-weight:950}
.searchBar{display:flex;align-items:center;gap:10px;height:50px;border-radius:18px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);padding:0 12px}
.mag{font-size:18px;color:var(--muted)}
.input{flex:1;height:100%;border:none;background:transparent;color:var(--text);outline:none}
.state{padding:22px 10px;text-align:center;color:var(--muted)}
.state.err{color:color-mix(in oklab,var(--danger) 80%, white)}
.list{display:grid;gap:10px}
.userCard{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:12px;border-radius:18px;border:1px solid color-mix(in oklab,var(--border) 84%, transparent);background:color-mix(in oklab,var(--surface) 84%, transparent)}
.ava{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;font-weight:900;background:color-mix(in oklab,var(--accent) 18%, transparent);color:color-mix(in oklab,var(--accent) 76%, white)}
.meta{min-width:0}
.name{font-weight:900}
.sub{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.moreWrap{display:flex;justify-content:center;padding-top:6px}
</style>
