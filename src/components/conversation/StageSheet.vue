<script setup>
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  tab: { type: String, default: 'overview' },
  tabs: { type: Array, default: () => [] },
  spotlightMessage: { type: Object, default: null },
  railCards: { type: Array, default: () => [] },
  sessions: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  media: { type: Array, default: () => [] },
  resolveSessionTitle: { type: Function, default: () => '' },
  messageTypeIcon: { type: Function, default: () => '💬' },
})

const emit = defineEmits(['update:open', 'update:tab', 'jump-to-message', 'open-session'])

const currentTab = computed({
  get: () => props.tab,
  set: (value) => emit('update:tab', value),
})

function closeSheet() {
  emit('update:open', false)
}

function selectTab(key) {
  currentTab.value = key
}

function iconForTab(key) {
  if (key === 'overview') return '◉'
  if (key === 'sessions') return '▶'
  if (key === 'actions') return '📌'
  return '🖼'
}

function openMessage(message) {
  emit('jump-to-message', message?.messageId)
  closeSheet()
}

function openSession(message) {
  emit('open-session', message)
  closeSheet()
}
</script>

<template>
  <teleport to="body">
    <div v-if="props.open" class="messageStageSheetBackdrop" @click.self="closeSheet">
      <section class="messageStageSheet rl-cardish">
        <div class="messageStageSheet__grab"></div>
        <div class="messageStageSheet__head">
          <div>
            <strong>🎞</strong>
          </div>
          <button type="button" class="messageStageSheet__close" title="닫기" aria-label="닫기" @click="closeSheet">✕</button>
        </div>

        <div class="messageStageSheetTabs">
          <button
            v-for="tabItem in props.tabs"
            :key="`stage-sheet-${tabItem.key}`"
            type="button"
            class="messageStageSheetTabs__tab"
            :class="{ on: currentTab === tabItem.key }"
            :title="tabItem.label"
            :aria-label="tabItem.label"
            @click="selectTab(tabItem.key)"
          >
            <span>{{ iconForTab(tabItem.key) }}</span>
            <small>{{ tabItem.count }}</small>
          </button>
        </div>

        <div v-if="currentTab === 'overview'" class="messageStageSheetBody">
          <button
            v-if="props.spotlightMessage"
            type="button"
            class="messageStageSheetCard"
            @click="openMessage(props.spotlightMessage)"
          >
            <span class="messageStageSheetCard__tag">👁</span>
            <strong>{{ props.spotlightMessage.content || '핵심 장면' }}</strong>
          </button>
          <div v-if="props.railCards.length" class="messageStageSheetMiniStack">
            <button
              v-for="stackMessage in props.railCards"
              :key="`stage-mini-${stackMessage.messageId}`"
              type="button"
              class="messageStageSheetMiniStack__card"
              @click="openMessage(stackMessage)"
            >
              <span>{{ props.messageTypeIcon(stackMessage) }}</span>
              <strong>{{ stackMessage.content || '핵심 장면' }}</strong>
            </button>
          </div>
        </div>

        <div v-else-if="currentTab === 'sessions'" class="messageStageSheetBody">
          <button
            v-for="sessionMessage in props.sessions"
            :key="`stage-session-${sessionMessage.messageId}`"
            type="button"
            class="messageStageSheetCard"
            @click="openSession(sessionMessage)"
          >
            <span class="messageStageSheetCard__tag">▶</span>
            <strong>{{ sessionMessage.content || props.resolveSessionTitle(sessionMessage) || '공동 플레이 장면' }}</strong>
          </button>
          <div v-if="!props.sessions.length" class="messageStageSheetEmpty">▶ 없음</div>
        </div>

        <div v-else-if="currentTab === 'actions'" class="messageStageSheetBody">
          <button
            v-for="actionMessage in props.actions"
            :key="`stage-action-${actionMessage.messageId}`"
            type="button"
            class="messageStageSheetCard"
            @click="openMessage(actionMessage)"
          >
            <span class="messageStageSheetCard__tag">📌</span>
            <strong>{{ actionMessage.content || '액션 장면' }}</strong>
          </button>
          <div v-if="!props.actions.length" class="messageStageSheetEmpty">📌 없음</div>
        </div>

        <div v-else class="messageStageSheetBody">
          <button
            v-for="mediaMessage in props.media"
            :key="`stage-media-${mediaMessage.messageId}`"
            type="button"
            class="messageStageSheetCard"
            @click="openMessage(mediaMessage)"
          >
            <span class="messageStageSheetCard__tag">🖼</span>
            <strong>{{ mediaMessage.content || '미디어 장면' }}</strong>
          </button>
          <div v-if="!props.media.length" class="messageStageSheetEmpty">🖼 없음</div>
        </div>
      </section>
    </div>
  </teleport>
</template>

<style scoped>
.messageStageSheetBackdrop{
  position:fixed;
  inset:0;
  z-index:100170;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding:12px;
  background:rgba(3,6,16,.56);
  backdrop-filter:blur(14px);
}
.messageStageSheet{
  width:min(100%,720px);
  max-height:min(82vh,760px);
  overflow:auto;
  display:grid;
  gap:10px;
  padding:12px;
  border-radius:24px;
  border:1px solid rgba(255,255,255,.1);
  background:linear-gradient(180deg,rgba(14,18,34,.98),rgba(8,12,24,.98));
  color:#fff;
  box-shadow:0 22px 60px rgba(0,0,0,.38);
}
.messageStageSheet__grab{
  width:44px;
  height:4px;
  margin:0 auto;
  border-radius:999px;
  background:rgba(255,255,255,.18);
}
.messageStageSheet__head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}
.messageStageSheet__head strong{
  font-size:20px;
  line-height:1;
}
.messageStageSheet__close{
  appearance:none;
  -webkit-appearance:none;
  width:34px;
  height:34px;
  border:1px solid rgba(255,255,255,.1);
  border-radius:999px;
  background:rgba(255,255,255,.05);
  color:#fff;
  font-size:14px;
  font-weight:900;
}
.messageStageSheetTabs{
  display:flex;
  gap:6px;
  overflow:auto;
  padding-bottom:2px;
}
.messageStageSheetTabs::-webkit-scrollbar{ display:none; }
.messageStageSheetTabs__tab{
  appearance:none;
  -webkit-appearance:none;
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:5px;
  min-height:32px;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.05);
  color:rgba(236,241,255,.8);
  font-size:12px;
  font-weight:800;
}
.messageStageSheetTabs__tab.on{
  background:rgba(122,140,255,.2);
  border-color:rgba(122,140,255,.34);
  color:#fff;
}
.messageStageSheetTabs__tab small{
  font-size:11px;
  opacity:.78;
}
.messageStageSheetBody{
  display:grid;
  gap:8px;
}
.messageStageSheetCard,
.messageStageSheetMiniStack__card{
  appearance:none;
  -webkit-appearance:none;
  width:100%;
  display:grid;
  gap:5px;
  padding:11px 12px;
  border-radius:15px;
  border:1px solid rgba(122,140,255,.14);
  background:linear-gradient(180deg,rgba(18,24,45,.96),rgba(10,15,29,.94));
  text-align:left;
  color:#fff;
}
.messageStageSheetCard strong,
.messageStageSheetMiniStack__card strong{
  font-size:13px;
  line-height:1.35;
}
.messageStageSheetCard__tag,
.messageStageSheetMiniStack__card span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:max-content;
  min-width:28px;
  height:20px;
  padding:0 7px;
  border-radius:999px;
  background:rgba(122,140,255,.16);
  font-size:10px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.messageStageSheetMiniStack{
  display:grid;
  gap:8px;
}
.messageStageSheetEmpty{
  padding:12px;
  border-radius:15px;
  border:1px dashed rgba(255,255,255,.12);
  font-size:12px;
  color:rgba(226,232,255,.62);
}
@media (max-width: 720px){
  .messageStageSheetBackdrop{ padding:10px; }
  .messageStageSheet{
    width:100%;
    max-height:min(78vh,680px);
    gap:8px;
    padding:10px;
    border-radius:20px;
  }
  .messageStageSheetTabs{ gap:5px; }
  .messageStageSheetTabs__tab{ min-height:30px; padding:0 9px; }
  .messageStageSheetBody{ gap:7px; }
  .messageStageSheetCard,
  .messageStageSheetMiniStack__card{ padding:10px 11px; border-radius:14px; }
}
</style>
