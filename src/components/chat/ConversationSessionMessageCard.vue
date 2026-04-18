<template>
  <article class="sessionMessageCard" :class="{ 'sessionMessageCard--compact': compact }" :data-status="displaySession?.status || 'ACTIVE'">
    <div class="sessionMessageCard__head">
      <div>
        <div class="sessionMessageCard__eyebrow">{{ mediaLabel }}</div>
        <strong>{{ displaySession?.title || '공동 플레이' }}</strong>
      </div>
      <span class="sessionMessageCard__state">{{ stateLabel }}</span>
    </div>
    <p v-if="message?.content && !compact" class="sessionMessageCard__summary">{{ message.content }}</p>
    <div class="sessionMessageCard__meta">
      <span>{{ positionLabel }}</span>
      <span>활성 {{ displaySession?.activeParticipantCount ?? 0 }}/{{ displaySession?.participants?.length || 0 }}명</span>
      <span>{{ permissionLabel }}</span>
    </div>
    <div class="sessionMessageCard__actions">
      <button type="button" class="sessionMessageCard__primary" :title="joinLabel" :aria-label="joinLabel" @click="joinSession">↗</button>
      <a v-if="previewLink" class="sessionMessageCard__link" :href="previewLink" target="_blank" rel="noreferrer" :title="`${providerLabel}에서 열기`" :aria-label="`${providerLabel}에서 열기`">🌐</a>
      <button v-if="previewLink" type="button" class="sessionMessageCard__ghost" :title="copied ? '링크 복사됨' : '링크 복사'" :aria-label="copied ? '링크 복사됨' : '링크 복사'" @click="copyLink">⧉</button>
    </div>
    <p v-if="syncStampLabel" class="sessionMessageCard__sync">{{ syncStampLabel }}</p>
    <p v-if="displaySession?.status === 'ENDED'" class="sessionMessageCard__notice">기록 전용</p>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';
import { formatPlaybackPosition, playbackMediaLabel, playbackPermissionLabel, playbackStateLabel } from '@/lib/playbackSessionUi';

const props = defineProps({
  message: { type: Object, required: true },
  session: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  currentUserId: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['touch-presence', 'activate-session']);

const displaySession = computed(() => props.session || {});
const mediaLabel = computed(() => playbackMediaLabel(displaySession.value));
const stateLabel = computed(() => playbackStateLabel(displaySession.value));
const permissionLabel = computed(() => playbackPermissionLabel(displaySession.value));
const sourceMeta = computed(() => getPlaybackSourceMeta(displaySession.value?.sourceUrl, displaySession.value?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewLink = computed(() => sourceMeta.value.cleanUrl || displaySession.value?.sourceUrl || '');
const providerLabel = computed(() => sourceMeta.value.label || '링크');
const positionLabel = computed(() => `현재 위치 ${formatPlaybackPosition(displaySession.value?.positionSeconds)}`);
const myParticipant = computed(() => (displaySession.value?.participants || []).find((item) => String(item?.userId || '') === String(props.currentUserId || '')) || null);
const compactJoinLabel = computed(() => (displaySession.value?.status === 'ACTIVE' ? '세션 열기' : '기록 열기'));
const joinLabel = computed(() => (props.compact ? compactJoinLabel.value : (displaySession.value?.status === 'ACTIVE' ? '세션 열기' : '기록 열기')));
const syncStampLabel = computed(() => {
  const stamp = myParticipant.value?.lastSeenAt || displaySession.value?.lastControlledAt || displaySession.value?.createdAt;
  if (!stamp) return '';
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return '';
  return `마지막 동기화 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
});
const copied = ref(false);
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
  } catch {
    copied.value = false;
  }
}


function joinSession() {
  emit('activate-session', displaySession.value);
  emit('touch-presence', displaySession.value);
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
.sessionMessageCard{display:grid;gap:8px;margin-top:6px;padding:10px 11px;border-radius:16px;border:1px solid rgba(122,140,255,.16);background:linear-gradient(180deg,rgba(22,28,52,.9),rgba(11,16,29,.9))}
.sessionMessageCard--compact{gap:6px;margin-top:0;padding:8px 9px;border-radius:14px}
.sessionMessageCard__head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.sessionMessageCard__eyebrow{font-size:9.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionMessageCard__state{display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:999px;background:rgba(122,140,255,.14);border:1px solid rgba(122,140,255,.22);font-size:9.5px;font-weight:900}.sessionMessageCard[data-status="ENDED"] .sessionMessageCard__state{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72)}
.sessionMessageCard__summary{margin:0;font-size:11px;line-height:1.45;color:rgba(255,255,255,.76)}
.sessionMessageCard__meta{display:flex;gap:6px;flex-wrap:wrap;font-size:10px;color:rgba(255,255,255,.6)}
.sessionMessageCard__actions{display:flex;gap:8px;flex-wrap:wrap}.sessionMessageCard__primary,.sessionMessageCard__ghost,.sessionMessageCard__link{display:inline-flex;align-items:center;justify-content:center;min-height:26px;min-width:26px;padding:0 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:10.5px;font-weight:800}.sessionMessageCard--compact .sessionMessageCard__primary,.sessionMessageCard--compact .sessionMessageCard__ghost,.sessionMessageCard--compact .sessionMessageCard__link{min-height:24px;min-width:24px;padding:0 8px;font-size:10px}.sessionMessageCard__primary{background:rgba(122,140,255,.16);border-color:rgba(122,140,255,.28);color:#fff}.sessionMessageCard__ghost{background:rgba(255,255,255,.05);color:#e8edff}.sessionMessageCard__link{background:rgba(255,255,255,.04);color:#cfd6ff}
.sessionMessageCard__sync,.sessionMessageCard__notice{margin:0;font-size:10px;line-height:1.35;color:rgba(255,255,255,.58)}.sessionMessageCard--compact .sessionMessageCard__meta{font-size:9.75px}.sessionMessageCard--compact .sessionMessageCard__sync,.sessionMessageCard--compact .sessionMessageCard__notice{font-size:9.75px;line-height:1.3}
@media (max-width: 720px){
  .sessionMessageCard{gap:7px;padding:9px 10px;border-radius:15px}
  .sessionMessageCard__actions{gap:6px}
  .sessionMessageCard__primary,.sessionMessageCard__ghost,.sessionMessageCard__link{min-height:24px;min-width:24px;padding:0 8px;font-size:10px}
}

.sessionMessageCard__actions{gap:6px}
.sessionMessageCard__primary,.sessionMessageCard__ghost,.sessionMessageCard__link{display:inline-flex;align-items:center;justify-content:center;min-height:26px;min-width:26px;padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:10px;font-weight:800}
.sessionMessageCard__meta{gap:6px;font-size:10px}
.sessionMessageCard__sync,.sessionMessageCard__notice{font-size:9.75px;line-height:1.3}

</style>