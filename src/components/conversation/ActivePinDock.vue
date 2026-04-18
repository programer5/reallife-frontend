<template>
  <div class="dockWrap dockWrapInline" :class="{ dockPulse: dockPulseOn }">
    <div class="dockBar dockBarInline">
      <button class="dockTab" :class="{ on: dockModeModel === 'active' }" type="button" title="액션" aria-label="액션" @click="dockModeModel = 'active'">📌 <span class="dockCount">{{ activeCount }}</span></button>
      <button class="dockTab" :class="{ on: dockModeModel === 'suggestions' }" type="button" :disabled="suggestionCount === 0" title="제안" aria-label="제안" @click="dockModeModel = 'suggestions'">✨ <span class="dockCount">{{ suggestionCount }}</span></button>
      <div class="dockSpacer"></div>
      <RlButton size="sm" variant="ghost" class="dockMore" @click="$emit('open-all')" title="전체 보기" aria-label="전체 보기">☰</RlButton>
    </div>
    <div class="dockPanel dockPanelInline">
      <div v-if="dockModeModel === 'active'" class="dockGrid">
        <div class="dockFilterBar">
          <button class="dockPill" :class="{ on: activeFilterModel === 'ALL' }" type="button" @click="activeFilterModel = 'ALL'">◉ <span class="dockPillCount">{{ activeCount }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'PROMISE' }" type="button" @click="activeFilterModel = 'PROMISE'">📅 약속 <span class="dockPillCount">{{ activeCounts?.PROMISE ?? 0 }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'TODO' }" type="button" @click="activeFilterModel = 'TODO'">✅ 할일 <span class="dockPillCount">{{ activeCounts?.TODO ?? 0 }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'PLACE' }" type="button" @click="activeFilterModel = 'PLACE'">📍 장소 <span class="dockPillCount">{{ activeCounts?.PLACE ?? 0 }}</span></button>
        </div>
      </div>
      <div v-else class="dockEmpty">제안이 없어요.</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import RlButton from '@/components/ui/RlButton.vue';

const props = defineProps({
  dockPulseOn: { type: Boolean, default: false },
  dockMode: { type: String, default: 'active' },
  suggestionCount: { type: Number, default: 0 },
  activeCount: { type: Number, default: 0 },
  activeFilter: { type: String, default: 'ALL' },
  activeCounts: {
    type: Object,
    default: () => ({ PROMISE: 0, TODO: 0, PLACE: 0 }),
  },
});

const emit = defineEmits(['update:dockMode', 'update:activeFilter', 'open-all']);

const dockModeModel = computed({
  get: () => props.dockMode,
  set: (value) => emit('update:dockMode', value),
});

const activeFilterModel = computed({
  get: () => props.activeFilter,
  set: (value) => emit('update:activeFilter', value),
});
</script>
