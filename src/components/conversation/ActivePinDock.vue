<template>
  <div class="dockWrap dockWrapInline" :class="{ dockPulse: dockPulseOn }">
    <div class="dockBar dockBarInline">
      <button
        class="dockTab"
        :class="{ on: dockModeModel === 'active' }"
        type="button"
        title="액션"
        aria-label="액션"
        @click="dockModeModel = 'active'"
      >
        📌 <span class="dockCount">{{ activeCount }}</span>
      </button>
      <button
        class="dockTab"
        :class="{ on: dockModeModel === 'suggestions' }"
        type="button"
        :disabled="suggestionCount === 0"
        title="제안"
        aria-label="제안"
        @click="dockModeModel = 'suggestions'"
      >
        ✨ <span class="dockCount">{{ suggestionCount }}</span>
      </button>
      <div class="dockSpacer"></div>
      <RlButton size="sm" variant="ghost" class="dockMore" @click="$emit('open-all')" title="전체 보기" aria-label="전체 보기">전체</RlButton>
    </div>

    <div class="dockPanel dockPanelInline">
      <div v-if="dockModeModel === 'active'" class="dockGrid">
        <div class="dockFilterBar">
          <button class="dockPill" :class="{ on: activeFilterModel === 'ALL' }" type="button" @click="activeFilterModel = 'ALL'" title="전체" aria-label="전체">◉ <span class="dockPillCount">{{ activeCount }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'PROMISE' }" type="button" @click="activeFilterModel = 'PROMISE'" title="약속" aria-label="약속">📅 <span class="dockPillText">약속</span> <span class="dockPillCount">{{ activeCounts?.PROMISE ?? 0 }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'TODO' }" type="button" @click="activeFilterModel = 'TODO'" title="할 일" aria-label="할 일">✅ <span class="dockPillText">할일</span> <span class="dockPillCount">{{ activeCounts?.TODO ?? 0 }}</span></button>
          <button class="dockPill" :class="{ on: activeFilterModel === 'PLACE' }" type="button" @click="activeFilterModel = 'PLACE'" title="장소" aria-label="장소">📍 <span class="dockPillText">장소</span> <span class="dockPillCount">{{ activeCounts?.PLACE ?? 0 }}</span></button>
        </div>

        <div v-if="normalizedActivePins.length" class="dockActiveList">
          <button
            v-for="pin in normalizedActivePins"
            :key="pin?.pinId || pin?.id || pin?.title"
            type="button"
            class="dockActiveCard"
            @click="$emit('open-all')"
          >
            <span class="dockActiveIcon">{{ pinIcon(pin) }}</span>
            <span class="dockActiveMain">
              <strong>{{ pin?.title || '액션' }}</strong>
              <small>{{ pinMeta(pin) }}</small>
            </span>
            <span class="dockActiveGo">›</span>
          </button>
        </div>
        <div v-else class="dockEmpty">저장된 액션이 없어요.</div>
      </div>

      <div v-else class="dockSuggestions">
        <div v-if="normalizedCandidates.length" class="dockSuggestionList">
          <PinCandidateCard
            v-for="candidate in normalizedCandidates"
            :key="candidate?.candidateId || candidate?.id || candidate?.title"
            :candidate="candidate"
            :busy="isCandidateBusy(candidate)"
            compact
            @confirm="emitConfirm(candidate, $event)"
            @dismiss="emitDismiss(candidate)"
          />
        </div>
        <div v-else class="dockEmpty">제안이 없어요.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import RlButton from '@/components/ui/RlButton.vue';
import PinCandidateCard from '@/components/pins/PinCandidateCard.vue';

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
  activePins: { type: Array, default: () => [] },
  pinKindMeta: { type: Function, default: null },
  pinPrimarySummary: { type: Function, default: null },
  sourceMessage: { type: Object, default: null },
  candidates: { type: Array, default: () => [] },
  savingCandidateId: { type: [String, Number, null], default: null },
  isConfirmBusy: { type: Function, default: () => false },
});

const emit = defineEmits([
  'update:dockMode',
  'update:activeFilter',
  'open-all',
  'confirm-candidate',
  'dismiss-candidate',
]);

const dockModeModel = computed({
  get: () => props.dockMode,
  set: (value) => emit('update:dockMode', value),
});

const activeFilterModel = computed({
  get: () => props.activeFilter,
  set: (value) => emit('update:activeFilter', value),
});

const normalizedCandidates = computed(() => (Array.isArray(props.candidates) ? props.candidates : []));
const normalizedActivePins = computed(() => (Array.isArray(props.activePins) ? props.activePins : []));


function pinIcon(pin) {
  try {
    const meta = props.pinKindMeta?.(pin);
    if (meta?.emoji) return meta.emoji;
  } catch {}
  if (pin?.placeText) return '📍';
  if (pin?.startAt) return '📅';
  return '✅';
}

function formatDateLike(value) {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 16);
}

function pinMeta(pin) {
  try {
    const summary = props.pinPrimarySummary?.(pin);
    if (summary) return summary;
  } catch {}
  const parts = [formatDateLike(pin?.startAt), pin?.placeText].filter(Boolean);
  return parts.join(' · ') || '저장됨';
}

function candidateKey(candidate) {
  return candidate?.candidateId ?? candidate?.id ?? '';
}

function isCandidateBusy(candidate) {
  const cid = String(candidateKey(candidate) || '');
  const saving = props.savingCandidateId != null && cid && String(props.savingCandidateId) === cid;
  const messageBusy = props.sourceMessage?.messageId ? props.isConfirmBusy(props.sourceMessage.messageId) : false;
  return Boolean(saving || messageBusy);
}

function emitConfirm(candidate, payload) {
  emit('confirm-candidate', {
    message: props.sourceMessage,
    candidate,
    payload: {
      ...candidate,
      ...(payload || {}),
    },
  });
}

function emitDismiss(candidate) {
  emit('dismiss-candidate', {
    message: props.sourceMessage,
    candidate,
  });
}
</script>


<style scoped>
.dockWrapInline{
  display:flex;
  flex-direction:column;
  min-height:0;
  width:100%;
}
.dockBarInline{
  display:grid;
  grid-template-columns:1fr 1fr auto;
  gap:8px;
  align-items:center;
  flex:0 0 auto;
}
.dockTab,.dockMore{
  min-height:36px;
  border-radius:14px;
}
.dockPanelInline{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  padding:8px 2px calc(env(safe-area-inset-bottom, 0px) + 16px);
}
.dockGrid,.dockSuggestions{
  display:grid;
  align-content:start;
  gap:10px;
  min-height:0;
}
.dockFilterBar{
  display:flex;
  gap:8px;
  overflow-x:auto;
  padding:0 0 2px;
  scrollbar-width:none;
}
.dockFilterBar::-webkit-scrollbar{display:none}
.dockPill{
  flex:0 0 auto;
  min-height:34px;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.88);
  font-weight:850;
  font-size:11px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:5px;
}
.dockPill.on{
  border-color:rgba(126,154,255,.42);
  background:rgba(126,154,255,.18);
  color:#fff;
}
.dockPillCount{
  min-width:18px;
  height:18px;
  padding:0 5px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:rgba(255,255,255,.10);
  font-size:10px;
}
.dockActiveList,.dockSuggestionList{
  display:grid;
  gap:8px;
  min-height:0;
  padding-bottom:4px;
}
.dockActiveCard{
  width:100%;
  min-height:54px;
  border:1px solid rgba(255,255,255,.11);
  background:rgba(255,255,255,.045);
  color:#fff;
  border-radius:16px;
  padding:9px 10px;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  gap:8px;
  align-items:center;
  text-align:left;
}
.dockActiveIcon{
  width:30px;
  height:30px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:rgba(126,154,255,.16);
}
.dockActiveMain{min-width:0;display:grid;gap:3px}
.dockActiveMain strong{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:12px;
  line-height:1.25;
}
.dockActiveMain small{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(226,232,255,.62);
  font-size:10.5px;
}
.dockActiveGo{color:rgba(226,232,255,.62);font-size:20px}
.dockEmpty{
  border:1px dashed rgba(255,255,255,.12);
  border-radius:16px;
  padding:14px;
  color:rgba(226,232,255,.62);
  text-align:center;
  font-size:12px;
}
@media (max-width:720px){
  .dockWrapInline{height:100%;}
  .dockPanelInline{
    max-height:calc(88dvh - 170px) !important;
    padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 28px) !important;
  }
  .dockBarInline{grid-template-columns:1fr 1fr 58px;gap:6px}
  .dockMore{font-size:11px;padding-inline:8px}
  .dockPill{min-height:32px;padding:0 9px;font-size:10.5px}
  .dockPillText{display:none}
  .dockSuggestionList :deep(.wrap){margin-top:0}
}
</style>
