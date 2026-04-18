<script setup>
const emit = defineEmits(["refocus", "repeat-search", "close"]);
</script>

<template>
  <div class="searchReturnBar rl-cardish">
    <div class="searchReturnBar__copy">
      <strong>검색으로 돌아옴</strong>
    </div>
    <div class="searchReturnBar__actions">
      <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--accent" title="위치 다시 찾기" aria-label="위치 다시 찾기" @click="emit('refocus')">🎯</button>
      <button type="button" class="conversationSearchRail__chip" title="같은 검색 다시 보기" aria-label="같은 검색 다시 보기" @click="emit('repeat-search')">↺</button>
      <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--ghost" title="닫기" aria-label="닫기" @click="emit('close')">✕</button>
    </div>
  </div>
</template>
