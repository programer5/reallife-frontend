<template>
  <article class="sessionMessageCard" :data-status="displaySession?.status || 'ACTIVE'">
    <div class="sessionMessageCard__head">
      <div>
        <div class="sessionMessageCard__eyebrow">{{ mediaLabel }}</div>
        <strong>{{ displaySession?.title || '공동 플레이' }}</strong>
      </div>
      <span class="sessionMessageCard__state">{{ stateLabel }}</span>
    </div>
    <p v-if="message?.content" class="sessionMessageCard__summary">{{ message.content }}</p>
    <div class="sessionMessageCard__meta">
      <span>{{ positionLabel }}</span>
      <span>활성 {{ displaySession?.activeParticipantCount ?? 0 }}/{{ displaySession?.participants?.length || 0 }}명</span>
      <span>{{ permissionLabel }}</span>
    </div>
    <div class="sessionMessageCard__participants" v-if="displaySession?.participants?.length">
      <span
        v-for="participant in displaySession.participants"
        :key="participant.userId"
        class="sessionMessageCard__participant"
        :data-active="participant.active ? 'true' : 'false'"
      >
        <span class="sessionMessageCard__participantRole">{{ participant.role === 'HOST' ? '호스트' : '게스트' }}</span>
        <span>{{ participant.userId === currentUserId ? '나' : shortId(participant.userId) }}</span>
      </span>
    </div>
    <div v-if="previewKind !== 'link'" class="sessionMessageCard__preview">
      <iframe
        v-if="previewKind === 'iframe' && previewUrl"
        class="sessionMessageCard__iframe"
        :src="previewUrl"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
      <img v-else-if="previewKind === 'image' && previewThumbnail" class="sessionMessageCard__thumb" :src="previewThumbnail" alt="" />
    </div>
    <div v-if="previewLink" class="sessionMessageCard__linkRow">
      <a class="sessionMessageCard__link" :href="previewLink" target="_blank" rel="noreferrer">{{ providerLabel }}에서 열기</a>
      <button type="button" class="sessionMessageCard__copy" @click="copyLink">{{ copied ? '링크 복사됨' : '링크 복사' }}</button>
    </div>
    <p v-if="displaySession?.status === 'ENDED'" class="sessionMessageCard__notice">종료된 세션이에요. 링크 재오픈만 가능하고 재생 제어는 잠겨 있어요.</p>
    <p v-else-if="!displaySession?.canControl" class="sessionMessageCard__notice">참여 상태는 유지되지만 재생 제어는 호스트만 할 수 있어요.</p>
    <div class="sessionMessageCard__actions">
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !canControl" @click="$emit('play', displaySession)">재생</button>
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !canControl" @click="$emit('pause', displaySession)">일시정지</button>
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !canControl" @click="$emit('seek', displaySession)">+15초</button>
      <button type="button" class="sessionMessageCard__btn sessionMessageCard__btn--danger" :disabled="busy || !canControl" @click="$emit('end', displaySession)">종료</button>
    </div>
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
});

defineEmits(['play', 'pause', 'seek', 'end']);

const displaySession = computed(() => props.session || {});
const canControl = computed(() => !!displaySession.value?.canControl && displaySession.value?.status === 'ACTIVE');
const mediaLabel = computed(() => playbackMediaLabel(displaySession.value));
const stateLabel = computed(() => playbackStateLabel(displaySession.value));
const permissionLabel = computed(() => playbackPermissionLabel(displaySession.value));
const sourceMeta = computed(() => getPlaybackSourceMeta(displaySession.value?.sourceUrl, displaySession.value?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewUrl = computed(() => sourceMeta.value.embedUrl);
const previewThumbnail = computed(() => sourceMeta.value.thumbnailUrl);
const previewLink = computed(() => sourceMeta.value.cleanUrl || displaySession.value?.sourceUrl || '');
const providerLabel = computed(() => sourceMeta.value.label || '링크');
const positionLabel = computed(() => `현재 위치 ${formatPlaybackPosition(displaySession.value?.positionSeconds)}`);
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
  } catch (error) {
    copied.value = false;
  }
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
.sessionMessageCard{display:grid;gap:10px;margin-top:8px;padding:14px 16px;border-radius:20px;border:1px solid rgba(122,140,255,.22);background:linear-gradient(180deg,rgba(26,32,58,.96),rgba(11,16,29,.94));box-shadow:0 14px 34px rgba(0,0,0,.22)}
.sessionMessageCard__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionMessageCard__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionMessageCard__state{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(122,140,255,.16);border:1px solid rgba(122,140,255,.28);font-size:11px;font-weight:900}.sessionMessageCard[data-status="ENDED"] .sessionMessageCard__state{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72)}.sessionMessageCard__summary{margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.82)}.sessionMessageCard__meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.68)}.sessionMessageCard__participants{display:flex;gap:8px;flex-wrap:wrap}.sessionMessageCard__participant{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.05);font-size:11px;font-weight:700;color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.08)}.sessionMessageCard__participant[data-active="true"]{border-color:rgba(122,140,255,.32);background:rgba(122,140,255,.12)}.sessionMessageCard__participantRole{opacity:.72}.sessionMessageCard__preview{overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.sessionMessageCard__iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}.sessionMessageCard__thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.sessionMessageCard__linkRow{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sessionMessageCard__link{font-size:13px;font-weight:800;color:#cfd6ff}.sessionMessageCard__copy{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.86);font-size:11px;font-weight:800}.sessionMessageCard__notice{margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,.66)}.sessionMessageCard__actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sessionMessageCard__btn{min-height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;font-weight:800}.sessionMessageCard__btn:disabled{opacity:.45;cursor:not-allowed}.sessionMessageCard__btn--danger{border-color:rgba(255,120,120,.24);color:#ffb4b4}@media (max-width:720px){.sessionMessageCard__actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
