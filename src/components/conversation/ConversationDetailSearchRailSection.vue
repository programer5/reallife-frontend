<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  expanded: { type: Boolean, default: true },
  summary: { type: String, default: "" },
  hasSearchFocus: { type: Boolean, default: false },
  searchQuery: { type: String, default: "" },
});

const emit = defineEmits([
  "update:searchQuery",
  "toggle",
  "search",
  "search-promise",
  "search-capsule",
  "search-global",
]);
</script>

<template>
  <section
    v-if="visible"
    class="conversationSearchRail rl-cardish"
    :class="{ compact }"
  >
    <div class="conversationSearchRail__top">
      <div class="conversationSearchRail__copy">
        <div class="conversationSearchRail__eyebrow">Conversation OS</div>
        <strong>찾고 바로 이어가기</strong>
        <p v-if="!compact">대화, 액션, 캡슐을 한 번에 다시 찾고 바로 다음 행동으로 이어지게 설계했어요.</p>
        <span v-else class="conversationSearchRail__summary">{{ summary }}</span>
        <span v-if="compact && hasSearchFocus" class="conversationSearchRail__focusPill">검색 결과 위치로 바로 이어지는 중</span>
      </div>
      <div class="conversationSearchRail__topActions">
        <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--ghost" @click="emit('toggle')">
          {{ compact ? '검색 열기' : '접기' }}
        </button>
      </div>
    </div>

    <div v-if="expanded" class="conversationSearchRail__controls">
      <div class="conversationSearchRail__inputWrap">
        <input
          :value="searchQuery"
          class="conversationSearchRail__input"
          placeholder="이 대화에서 찾고 싶은 키워드를 입력해 보세요"
          @input="emit('update:searchQuery', $event.target.value)"
          @keydown.enter.prevent="emit('search')"
        />
        <button type="button" class="conversationSearchRail__submit" @click="emit('search')">검색</button>
      </div>
      <div class="conversationSearchRail__meta">
        <span class="conversationSearchRail__summary">{{ summary }}</span>
        <div class="conversationSearchRail__actions">
          <button type="button" class="conversationSearchRail__chip" @click="emit('search-promise')">약속</button>
          <button type="button" class="conversationSearchRail__chip" @click="emit('search-capsule')">캡슐</button>
          <button type="button" class="conversationSearchRail__chip" @click="emit('search-global')">전체 검색</button>
        </div>
      </div>
    </div>
  </section>
</template>
