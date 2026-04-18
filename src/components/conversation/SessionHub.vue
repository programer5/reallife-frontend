<template>
  <div ref="rootRef" class="sessionHub">
    <div class="sessionHub__head">
      <div><strong>공동 플레이</strong></div>
      <button type="button" class="conversationSearchRail__chip conversationSearchRail__chip--accent" @click="$emit('open-session-modal')" title="세션 만들기" aria-label="세션 만들기">＋</button>
    </div>
    <div v-if="loadingSessions" class="sessionHub__empty">세션을 불러오는 중이에요…</div>
    <div v-else-if="sessionError" class="sessionHub__empty">{{ sessionError }}</div>
    <div v-else-if="activeSessions.length || recentSessions.length" class="sessionHub__stack">
      <section v-if="featuredActiveSession" class="sessionHub__section sessionHub__section--featured">
        <div class="sessionHub__sectionHead">
          <div><strong>▶</strong></div>
          <span>1개</span>
        </div>
        <ConversationSessionCard
          :session="featuredActiveSession"
          :busy="busyFor(featuredActiveSession)"
          :current-user-id="meId"
          :force-interactive="activated(featuredActiveSession)"
          @activate-session="emitActivate($event)"
          @play="$emit('play', $event)"
          @pause="$emit('pause', $event)"
          @seek="$emit('seek', $event)"
          @end="$emit('end', $event)"
          @playback-intent="$emit('playback-intent', $event)"
          @position-sampled="$emit('position-sampled', $event)"
          @touch-presence="$emit('touch-presence', $event)"
        />
      </section>
      <section v-if="secondaryActiveSessions.length" class="sessionHub__section">
        <div class="sessionHub__sectionHead">
          <strong>↻</strong>
          <span>{{ secondaryActiveSessions.length }}개</span>
        </div>
        <div class="sessionHub__compactList">
          <ConversationSessionCard
            v-for="session in secondaryActiveSessions"
            :key="session.sessionId"
            :session="session"
            compact
            :busy="busyFor(session)"
            :current-user-id="meId"
            :force-interactive="activated(session)"
            @activate-session="emitActivate($event, { scroll: true })"
            @play="$emit('play', $event)"
            @pause="$emit('pause', $event)"
            @seek="$emit('seek', $event)"
            @end="$emit('end', $event)"
            @touch-presence="$emit('touch-presence', $event)"
          />
        </div>
      </section>
      <section v-if="recentSessions.length" class="sessionHub__section">
        <div class="sessionHub__sectionHead">
          <strong>🕘</strong>
          <div class="sessionHub__historyActions">
            <span>{{ recentSessions.length }}개</span>
            <button type="button" class="conversationSearchRail__chip" @click="$emit('toggle-session-history')" :title="sessionHistoryOpen ? '접기' : '펼치기'" :aria-label="sessionHistoryOpen ? '접기' : '펼치기'">{{ sessionHistoryOpen ? '▴' : '▾' }}</button>
          </div>
        </div>
        <div class="sessionHub__compactList">
          <ConversationSessionCard
            v-for="session in visibleRecentSessions"
            :key="session.sessionId"
            :session="session"
            compact
            :busy="busyFor(session)"
            :current-user-id="meId"
            :force-interactive="activated(session)"
            @activate-session="emitActivate($event, { scroll: true })"
            @play="$emit('play', $event)"
            @pause="$emit('pause', $event)"
            @seek="$emit('seek', $event)"
            @end="$emit('end', $event)"
            @touch-presence="$emit('touch-presence', $event)"
          />
        </div>
      </section>
    </div>
    <div v-else class="sessionHub__empty">세션이 없어요.</div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import ConversationSessionCard from "@/components/chat/ConversationSessionCard.vue";

const emit = defineEmits([
  'open-session-modal',
  'toggle-session-history',
  'activate-session',
  'play',
  'pause',
  'seek',
  'end',
  'playback-intent',
  'position-sampled',
  'touch-presence',
]);

const props = defineProps({
  loadingSessions: { type: Boolean, default: false },
  sessionError: { type: String, default: '' },
  activeSessions: { type: Array, default: () => [] },
  recentSessions: { type: Array, default: () => [] },
  featuredActiveSession: { type: Object, default: null },
  secondaryActiveSessions: { type: Array, default: () => [] },
  visibleRecentSessions: { type: Array, default: () => [] },
  sessionHistoryOpen: { type: Boolean, default: false },
  meId: { type: String, default: '' },
  isActionBusy: { type: Function, default: null },
  isSessionActivated: { type: Function, default: null },
});

const rootRef = ref(null);
function scrollIntoView(options) {
  rootRef.value?.scrollIntoView?.(options);
}
defineExpose({ rootRef, scrollIntoView });

function busyFor(session) {
  return props.isActionBusy ? props.isActionBusy(session?.sessionId) : false;
}

function activated(session) {
  return props.isSessionActivated ? props.isSessionActivated(session?.sessionId) : false;
}

function emitActivate(session, options) {
  emit('activate-session', options ? { session, options } : { session });
}
</script>
