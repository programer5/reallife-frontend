<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  focusTerm: { type: String, default: "" },
  hasMessageFocus: { type: Boolean, default: false },
  hasPinFocus: { type: Boolean, default: false },
  hasCapsuleFocus: { type: Boolean, default: false },
  focusSummary: { type: String, default: "" },
});

const emit = defineEmits(["refocus", "search-again", "close", "back-to-search"]);
</script>

<template>
  <div v-if="visible" class="searchReturnBar rl-cardish">
    <div class="searchReturnBar__copy">
      <div class="searchReturnBar__eyebrow">Search Return</div>
      <strong>검색 결과에서 다시 들어왔어요</strong>
      <p>
        <template v-if="focusTerm">“{{ focusTerm }}”</template>
        <template v-if="hasMessageFocus"> 메시지를 강조해서 보여주고, </template>
        <template v-if="hasPinFocus">액션 위치로 바로 이동하고, </template>
        <template v-if="hasCapsuleFocus">캡슐 영역도 같이 찾아드릴게요.</template>
      </p>
      <div v-if="focusSummary" class="searchReturnBar__chips">
        <span v-if="hasMessageFocus" class="searchReturnBar__chipPill">메시지 위치</span>
        <span v-if="hasPinFocus" class="searchReturnBar__chipPill">액션 카드 강조</span>
        <span v-if="hasCapsuleFocus" class="searchReturnBar__chipPill">캡슐 카드 강조</span>
      </div>
    </div>
    <div class="searchReturnBar__actions">
      <button type="button" class="searchReturnBar__btn searchReturnBar__btn--accent" @click="$emit('refocus')">위치 다시 찾기</button>
      <button type="button" class="searchReturnBar__btn" @click="$emit('search-again')">같은 검색 다시 보기</button>
      <button type="button" class="searchReturnBar__btn" @click="$emit('back-to-search')">검색으로 돌아가기</button>
      <button type="button" class="searchReturnBar__btn searchReturnBar__btn--ghost" @click="$emit('close')">닫기</button>
    </div>
  </div>
</template>

<style scoped>
.searchReturnBar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 12px;padding:12px 14px;border-radius:20px;border:1px solid rgba(122,140,255,.22);background:rgba(79,101,255,.10)}
.searchReturnBar__copy{display:grid;gap:4px}
.searchReturnBar__eyebrow{font-size:11px;font-weight:900;letter-spacing:.1em;color:rgba(145,170,255,.82);text-transform:uppercase}
.searchReturnBar__copy p{margin:0;font-size:12px;color:rgba(255,255,255,.72)}
.searchReturnBar__actions{display:flex;gap:8px;flex-wrap:wrap}
.searchReturnBar__btn{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#fff;font-size:12px;font-weight:800}
.searchReturnBar__btn--ghost{background:transparent}
.searchReturnBar__btn--accent{background:rgba(122,140,255,.22);border-color:rgba(122,140,255,.34)}
.searchReturnBar__chipPill{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(255,214,102,.14);border:1px solid rgba(255,214,102,.26);font-size:11px;font-weight:900;color:#ffd666;white-space:nowrap}
.searchReturnBar__chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
@media (max-width:720px){.searchReturnBar{display:grid}.searchReturnBar__actions{width:100%}}
</style>
