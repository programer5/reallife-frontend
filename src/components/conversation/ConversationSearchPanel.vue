<script setup>
const query = defineModel({ type: String, default: "" });
const props = defineProps({ summary: { type: String, default: "" } });
const emit = defineEmits(["submit", "search-appointments", "search-capsules", "open-global"]);
</script>

<template>
  <section class="conversationSearchRail rl-cardish">
    <div class="conversationSearchRail__top">
      <div class="conversationSearchRail__copy">
        <strong>🔎</strong>
      </div>
    </div>
    <div class="conversationSearchRail__controls">
      <div class="conversationSearchRail__inputWrap">
        <input v-model.trim="query" class="conversationSearchRail__input" placeholder="대화 검색" @keydown.enter.prevent="emit('submit')" />
        <button type="button" class="conversationSearchRail__submit" title="검색" aria-label="검색" @click="emit('submit')">🔎</button>
      </div>
      <div class="conversationSearchRail__meta">
        <span class="conversationSearchRail__summary">{{ props.summary }}</span>
        <div class="conversationSearchRail__actions">
          <button type="button" class="conversationSearchRail__chip" title="약속" aria-label="약속" @click="emit('search-appointments')">📅</button>
          <button type="button" class="conversationSearchRail__chip" title="캡슐" aria-label="캡슐" @click="emit('search-capsules')">⏳</button>
          <button type="button" class="conversationSearchRail__chip" title="전체 검색" aria-label="전체 검색" @click="emit('open-global')">🌐</button>
        </div>
      </div>
    </div>
  </section>
</template>
