<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  searchFocusTerm: { type: String, default: "" },
  searchFocusMid: { type: String, default: "" },
  searchFocusPinId: { type: String, default: "" },
  searchFocusCapsuleId: { type: String, default: "" },
  searchFocusSummary: { type: String, default: "" },
});

const emit = defineEmits(["refocus", "open-search", "close"]);
</script>

<template>
  <div v-if="visible" class="searchReturnBar rl-cardish">
    <div class="searchReturnBar__copy">
      <div class="searchReturnBar__eyebrow">Search Return</div>
      <strong>검색 결과에서 다시 들어왔어요</strong>
      <p>
        <template v-if="searchFocusTerm">“{{ searchFocusTerm }}”</template>
        <template v-if="searchFocusMid"> 메시지를 강조해서 보여주고, </template>
        <template v-if="searchFocusPinId">액션 위치로 바로 이동하고, </template>
        <template v-if="searchFocusCapsuleId">캡슐 영역도 같이 찾아드릴게요.</template>
      </p>
      <div v-if="searchFocusSummary" class="searchReturnBar__chips">
        <span v-if="searchFocusMid" class="searchReturnBar__chipPill">메시지 위치</span>
        <span v-if="searchFocusPinId" class="searchReturnBar__chipPill">액션 카드 강조</span>
        <span v-if="searchFocusCapsuleId" class="searchReturnBar__chipPill">캡슐 카드 강조</span>
      </div>
    </div>
    <div class="searchReturnBar__actions">
      <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--accent" @click="emit('refocus')">위치 다시 찾기</button>
      <button type="button" class="conversationSearchRail__chip" @click="emit('open-search')">같은 검색 다시 보기</button>
      <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--ghost" @click="emit('close')">닫기</button>
    </div>
  </div>
</template>
