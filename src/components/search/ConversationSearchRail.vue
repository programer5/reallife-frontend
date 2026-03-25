<script setup>
const props = defineProps({
  visible: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  mobileViewport: { type: Boolean, default: false },
  expanded: { type: Boolean, default: true },
  conversationSearchQ: { type: String, default: "" },
  summary: { type: String, default: "" },
  hasSearchFocus: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:conversationSearchQ",
  "toggle",
  "search",
  "quick-search",
  "global-search",
]);
</script>

<template>
  <section v-if="visible" class="conversationSearchRail rl-cardish" :class="{ compact }">
    <div class="conversationSearchRail__top">
      <div class="conversationSearchRail__copy">
        <div class="conversationSearchRail__eyebrow">Conversation OS</div>
        <strong>찾고 바로 이어가기</strong>
        <p v-if="!mobileViewport || expanded">대화, 액션, 캡슐을 한 번에 다시 찾고 바로 다음 행동으로 이어지게 설계했어요.</p>
        <span v-else class="conversationSearchRail__summary">{{ summary }}</span>
        <span v-if="mobileViewport && !expanded && hasSearchFocus" class="conversationSearchRail__focusPill">검색 결과 위치로 바로 이어지는 중</span>
      </div>
      <div class="conversationSearchRail__topActions">
        <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--ghost" @click="$emit('toggle')">
          {{ mobileViewport && !expanded ? "검색 열기" : "접기" }}
        </button>
      </div>
    </div>

    <div v-if="!mobileViewport || expanded" class="conversationSearchRail__controls">
      <div class="conversationSearchRail__inputWrap">
        <input
          :value="conversationSearchQ"
          class="conversationSearchRail__input"
          placeholder="이 대화에서 찾고 싶은 키워드를 입력해 보세요"
          @input="$emit('update:conversationSearchQ', $event.target.value)"
          @keydown.enter.prevent="$emit('search')"
        />
        <button type="button" class="conversationSearchRail__submit" @click="$emit('search')">검색</button>
      </div>
      <div class="conversationSearchRail__meta">
        <span class="conversationSearchRail__summary">{{ summary }}</span>
        <div class="conversationSearchRail__actions">
          <button type="button" class="conversationSearchRail__chip" @click="$emit('quick-search', '약속')">약속</button>
          <button type="button" class="conversationSearchRail__chip" @click="$emit('quick-search', '캡슐')">캡슐</button>
          <button type="button" class="conversationSearchRail__chip" @click="$emit('global-search')">전체 검색</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.conversationSearchRail{display:grid;gap:12px;padding:14px 16px;border-radius:24px;background:linear-gradient(180deg,rgba(11,16,30,.94),rgba(7,11,22,.88));border:1px solid rgba(255,255,255,.08)}
.conversationSearchRail.compact{padding:10px 12px;border-radius:18px;gap:8px}
.conversationSearchRail__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.conversationSearchRail__copy{display:grid;gap:4px;min-width:0}
.conversationSearchRail__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}
.conversationSearchRail__copy strong{font-size:18px;line-height:1.2}
.conversationSearchRail.compact .conversationSearchRail__copy strong{font-size:15px}
.conversationSearchRail__copy p{margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,.72)}
.conversationSearchRail__controls{display:grid;gap:10px}
.conversationSearchRail__inputWrap{display:flex;gap:10px}
.conversationSearchRail__input{flex:1;min-height:48px;border-radius:18px;border:1px solid rgba(255,255,255,.10);background:rgba(9,13,24,.82);color:#fff;padding:0 14px;outline:none}
.conversationSearchRail__submit{min-width:96px;min-height:48px;border-radius:18px;border:0;background:linear-gradient(135deg,#7a8cff,#8e66ff);color:#fff;font-weight:900}
.conversationSearchRail__meta{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.conversationSearchRail__summary{font-size:12px;color:rgba(255,255,255,.62)}
.conversationSearchRail__focusPill{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(255,220,120,.12);border:1px solid rgba(255,220,120,.18);font-size:11px;font-weight:800;color:rgba(255,236,170,.96)}
.conversationSearchRail__actions,.conversationSearchRail__topActions{display:flex;gap:8px;flex-wrap:wrap}
.conversationSearchRail__chip{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#fff;font-size:12px;font-weight:800}
.conversationSearchRail__chip--ghost{background:transparent}
@media (max-width:720px){.conversationSearchRail{gap:10px}.conversationSearchRail__copy strong{font-size:16px}.conversationSearchRail__inputWrap{flex-direction:column}.conversationSearchRail__submit{width:100%}}
</style>
