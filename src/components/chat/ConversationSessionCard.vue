<template>
  <article class="sessionCard" :class="{ 'sessionCard--compact': compact }" :data-status="session?.status || 'ACTIVE'">
    <div class="sessionCard__head">
      <div>
        <div class="sessionCard__eyebrow">{{ mediaLabel }}</div>
        <strong>{{ session?.title || '공동 플레이' }}</strong>
      </div>
      <span class="sessionCard__state">{{ stateLabel }}</span>
    </div>
    <div class="sessionCard__meta">
      <span>위치 {{ positionLabel }}</span>
      <span>활성 {{ session?.activeParticipantCount ?? 0 }}/{{ session?.participants?.length || 0 }}명</span>
      <span>{{ permissionLabel }}</span>
    </div>
    <div class="sessionCard__participants" v-if="!compact && session?.participants?.length">
      <span
        v-for="participant in session.participants"
        :key="participant.userId"
        class="sessionCard__participant"
        :data-active="participant.active ? 'true' : 'false'"
      >
        <span class="sessionCard__participantRole">{{ participant.role === 'HOST' ? '호스트' : '게스트' }}</span>
        <span>{{ participant.userId === currentUserId ? '나' : shortId(participant.userId) }}</span>
      </span>
    </div>
    <ConversationSessionPlaybackPreview
      v-if="!compact && previewKind !== 'link'"
      :session="session"
      :interactive="interactivePreview"
      @playback-intent="forwardPlaybackIntent"
      @position-sampled="forwardPositionSample"
    />
    <div v-if="previewLink" class="sessionCard__linkRow">
      <div class="sessionCard__linkActions">
        <button type="button" class="sessionCard__join" @click="joinSession">{{ joinLabel }}</button>
        <a class="sessionCard__link" :href="previewLink" target="_blank" rel="noreferrer">{{ providerLabel }}에서 열기</a>
      </div>
      <button type="button" class="sessionCard__copy" @click="copyLink">{{ copied ? '링크 복사됨' : '링크 복사' }}</button>
    </div>
    <p v-if="!compact && syncStampLabel" class="sessionCard__sync">{{ syncStampLabel }}</p>
    <p v-if="!compact && session?.status === 'ENDED'" class="sessionCard__notice">종료된 세션이에요. 링크는 다시 열 수 있지만 재생 제어는 잠겨 있어요.</p>
    <p v-else-if="!compact && !interactivePreview" class="sessionCard__notice">자동 재생이 되지 않도록 잠깐 대기 중이에요. <strong>이 세션에 참여</strong>를 누르면 여기서만 재생을 붙여요.</p>
    <p v-else-if="!compact && !session?.canControl" class="sessionCard__notice">지금은 호스트만 재생을 제어할 수 있어요.</p>
    <div v-if="!compact" class="sessionCard__actions">
      <button type="button" class="sessionCard__btn" :disabled="busy || !canControl" @click="emitImmediate('PLAYING')">재생</button>
      <button type="button" class="sessionCard__btn" :disabled="busy || !canControl" @click="emitImmediate('PAUSED')">일시정지</button>
      <button type="button" class="sessionCard__btn" :disabled="busy || !canControl" @click="emitSeek">+15초</button>
      <button type="button" class="sessionCard__btn sessionCard__btn--danger" :disabled="busy || !canControl" @click="$emit('end', session)">종료</button>
    </div>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import ConversationSessionPlaybackPreview from '@/components/chat/ConversationSessionPlaybackPreview.vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';
import { dispatchPlaybackCommand } from '@/lib/playbackCommandBus';
import { formatPlaybackPosition, playbackMediaLabel, playbackPermissionLabel, playbackStateLabel } from '@/lib/playbackSessionUi';

const props = defineProps({
  session: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  currentUserId: { type: String, default: '' },
  forceInteractive: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['play', 'pause', 'seek', 'end', 'playback-intent', 'position-sampled', 'touch-presence', 'activate-session']);

const canControl = computed(() => !!props.session?.canControl && props.session?.status === 'ACTIVE');
const mediaLabel = computed(() => playbackMediaLabel(props.session));
const stateLabel = computed(() => playbackStateLabel(props.session));
const permissionLabel = computed(() => playbackPermissionLabel(props.session));
const sourceMeta = computed(() => getPlaybackSourceMeta(props.session?.sourceUrl, props.session?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewLink = computed(() => sourceMeta.value.cleanUrl || props.session?.sourceUrl || '');
const providerLabel = computed(() => sourceMeta.value.label || '링크');
const positionLabel = computed(() => formatPlaybackPosition(props.session?.positionSeconds));
const myParticipant = computed(() => (props.session?.participants || []).find((item) => String(item?.userId || '') === String(props.currentUserId || '')) || null);
const interactivePreview = computed(() => (props.forceInteractive || hasJoinedLocally.value) && props.session?.status === 'ACTIVE');
const joinLabel = computed(() => {
  if (props.compact) return props.session?.status === 'ACTIVE' ? '현재 세션으로 열기' : '기록 열기';
  return interactivePreview.value ? '참여 중' : '이 세션에 참여';
});
const syncStampLabel = computed(() => {
  const stamp = myParticipant.value?.lastSeenAt || props.session?.lastControlledAt || props.session?.createdAt;
  if (!stamp) return '';
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return '';
  return `마지막 동기화 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
});
const copied = ref(false);
const hasJoinedLocally = ref(false);
let copyTimer = null;

async function copyLink() {
  if (!previewLink.value) return;
  try {
    if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(previewLink.value);
    else {
      const input = document.createElement('input');
      input.value = previewLink.value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    copied.value = true;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch (error) {
    copied.value = false;
  }
}


function forwardPlaybackIntent(payload) {
  emit('playback-intent', payload);
}

function forwardPositionSample(payload) {
  emit('position-sampled', payload);
}

function emitImmediate(playbackState) {
  hasJoinedLocally.value = true;
  emit('activate-session', props.session);
  dispatchPlaybackCommand(props.session?.sessionId, {
    playbackState,
    positionSeconds: Number(props.session?.positionSeconds || 0),
  });
  emit(playbackState === 'PLAYING' ? 'play' : 'pause', props.session);
}

function emitSeek() {
  hasJoinedLocally.value = true;
  emit('activate-session', props.session);
  const positionSeconds = Number(props.session?.positionSeconds || 0) + 15;
  dispatchPlaybackCommand(props.session?.sessionId, {
    playbackState: String(props.session?.playbackState || 'PAUSED').toUpperCase(),
    positionSeconds,
  });
  emit('seek', props.session);
}

async function joinSession() {
  hasJoinedLocally.value = true;
  emit('activate-session', props.session);
  emit('touch-presence', props.session);
}

function shortId(value) {
  const raw = String(value || '');
  if (!raw) return '참여자';
  return raw.slice(0, 8);
}

onBeforeUnmount(() => {
  if (copyTimer) window.clearTimeout(copyTimer);
});
</script>

<style scoped>
.sessionCard{display:grid;gap:10px;padding:14px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(18,22,38,.9),rgba(10,13,24,.92))}.sessionCard--compact{gap:8px;padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.04)}.sessionCard__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionCard__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionCard__state{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(122,140,255,.16);border:1px solid rgba(122,140,255,.28);font-size:11px;font-weight:900}.sessionCard[data-status="ENDED"] .sessionCard__state{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72)}.sessionCard__meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.68)}.sessionCard__participants{display:flex;gap:8px;flex-wrap:wrap}.sessionCard__participant{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.05);font-size:11px;font-weight:700;color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.08)}.sessionCard__participant[data-active="true"]{border-color:rgba(122,140,255,.32);background:rgba(122,140,255,.12)}.sessionCard__participantRole{opacity:.72}.sessionCard__preview{overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.sessionCard__iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}.sessionCard__thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.sessionCard__linkRow{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sessionCard__linkActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sessionCard__join,.sessionCard__link,.sessionCard__copy{font-size:13px;font-weight:800;color:#cfd6ff}.sessionCard__join,.sessionCard__copy{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}.sessionCard__copy{color:rgba(255,255,255,.86);font-size:11px}.sessionCard__sync{margin:0;font-size:11px;color:rgba(255,255,255,.58)}.sessionCard__notice{margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,.66)}.sessionCard__actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sessionCard__btn{min-height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;font-weight:800}.sessionCard__btn:disabled{opacity:.45;cursor:not-allowed}.sessionCard__btn--danger{border-color:rgba(255,120,120,.24);color:#ffb4b4}.sessionCard--compact .sessionCard__meta{font-size:11px}.sessionCard--compact .sessionCard__join,.sessionCard--compact .sessionCard__copy{font-size:12px}@media (max-width:720px){.sessionCard__actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
