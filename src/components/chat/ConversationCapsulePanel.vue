
<!-- src/components/chat/ConversationCapsulePanel.vue -->
<script setup>
import { computed, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
const props = defineProps({ items: { type: Array, default: () => [] }, loading: { type: Boolean, default: false } });
const emit = defineEmits(["refresh", "relay"]);
const selected = ref(null);
const expanded = ref(false);
const openedItems = computed(() => (props.items || []).filter((x) => x?.opened));
const lockedItems = computed(() => (props.items || []).filter((x) => !x?.opened));
function statusText(item){ return item?.opened ? "열림" : "잠금"; }
function fmt(v){ if(!v) return ""; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(); }
function openDetail(item){ selected.value = item || null; }
function closeDetail(){ selected.value = null; }
function suggest(kind){
  if (!selected.value) return;
  emit("relay",{ kind, text:selected.value.title || "열린 캡슐에서 이어진 액션", sourceLabel:"타임 캡슐", sourcePostPreview:selected.value.title || "", sourceRoute:"" });
  selected.value = null;
}
</script>
<template>
  <section class="capsulePanel rl-cardish">
    <div class="capsuleHead">
      <div class="left">
        <div class="capsuleEyebrow">TIME CAPSULE</div>
        <div class="capsuleTitle">이 대화의 타임 캡슐</div>
      </div>
      <div class="capsuleHeadActions">
        <RlButton size="sm" variant="soft" @click="$emit('refresh')" :disabled="loading">{{ loading ? "새로고침 중…" : "새로고침" }}</RlButton>
        <RlButton size="sm" variant="ghost" @click="expanded = !expanded">{{ expanded ? "접기" : "펼치기" }}</RlButton>
      </div>
    </div>
    <div class="capsuleSummary">
      <div class="summaryPill"><strong>{{ openedItems.length }}</strong><span>열린 캡슐</span></div>
      <div class="summaryPill"><strong>{{ lockedItems.length }}</strong><span>대기 중</span></div>
      <div class="summaryHint">캡슐은 입력창의 ⏳ 버튼으로 만들어요.</div>
    </div>

    <div v-if="expanded" class="capsuleBody">
      <div v-if="loading && !items.length" class="state">캡슐 목록을 불러오는 중…</div>
      <div v-else-if="!items.length" class="state">아직 타임 캡슐이 없어요.</div>
      <div v-else class="capsuleList">
        <article v-for="item in items" :key="item.capsuleId" class="capsuleCard" :data-opened="item.opened">
          <div class="capsuleRow"><div class="capsuleCardTitle">{{ item.title || "제목 없는 캡슐" }}</div><span class="capsuleState">{{ statusText(item) }}</span></div>
          <div class="capsuleMeta">열릴 시간 · {{ fmt(item.unlockAt) }}</div>
          <div v-if="item.openedAt" class="capsuleMeta">열린 시간 · {{ fmt(item.openedAt) }}</div>
          <div class="capsuleActions">
            <RlButton size="sm" variant="soft" @click="openDetail(item)">상세 보기</RlButton>
            <RlButton v-if="item.opened" size="sm" variant="primary" @click="openDetail(item)">액션 제안</RlButton>
          </div>
        </article>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="selected" class="overlay" @click.self="closeDetail">
        <div class="sheet rl-cardish">
          <div class="sheetEyebrow">CAPSULE DETAIL</div>
          <div class="sheetTitle">{{ selected.title || "제목 없는 캡슐" }}</div>
          <div class="sheetMeta">열릴 시간 · {{ fmt(selected.unlockAt) }}</div>
          <div v-if="selected.openedAt" class="sheetMeta">열린 시간 · {{ fmt(selected.openedAt) }}</div>
          <div v-if="selected.opened" class="relayBox">
            <div class="relayTitle">열린 캡슐에서 바로 액션으로 이어가기</div>
            <div class="relayActions">
              <RlButton size="sm" variant="soft" @click="suggest('PROMISE')">약속 제안</RlButton>
              <RlButton size="sm" variant="soft" @click="suggest('TODO')">할일 제안</RlButton>
              <RlButton size="sm" variant="soft" @click="suggest('PLACE')">장소 제안</RlButton>
            </div>
          </div>
          <div class="sheetFoot"><RlButton size="sm" variant="soft" @click="closeDetail">닫기</RlButton></div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
<style scoped>
.capsulePanel{margin-top:8px;padding:12px 14px;border-radius:18px;display:grid;gap:12px}.capsuleHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.left{display:grid;gap:4px}.capsuleEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}.capsuleTitle{font-size:16px;font-weight:950}.capsuleHeadActions{display:flex;gap:8px;flex-wrap:wrap}.capsuleSummary{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.summaryPill{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent)}.summaryPill strong{font-size:14px}.summaryPill span{font-size:12px;color:var(--muted)}.summaryHint{font-size:12px;color:var(--muted)}.capsuleBody{display:grid;gap:8px}.state{padding:12px 8px;text-align:center;color:var(--muted)}.capsuleList{display:grid;gap:8px;max-height:220px;overflow:auto;padding-right:2px}.capsuleCard{padding:12px;border-radius:16px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent)}.capsuleCard[data-opened="true"]{border-color:color-mix(in oklab,var(--accent) 35%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent)}.capsuleRow{display:flex;align-items:center;justify-content:space-between;gap:10px}.capsuleCardTitle{font-size:13px;font-weight:900}.capsuleState{font-size:11px;font-weight:900;color:var(--muted)}.capsuleMeta{margin-top:6px;font-size:12px;color:var(--muted)}.capsuleActions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;z-index:90}.sheet{width:min(560px,100%);padding:18px;border-radius:24px;display:grid;gap:12px}.sheetEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}.sheetTitle{font-size:22px;font-weight:950}.sheetMeta{font-size:13px;color:var(--muted)}.relayBox{margin-top:8px;padding:14px;border-radius:18px;border:1px solid color-mix(in oklab,var(--accent) 28%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent)}.relayTitle{font-size:13px;font-weight:900}.relayActions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}.sheetFoot{display:flex;justify-content:flex-end}
</style>
