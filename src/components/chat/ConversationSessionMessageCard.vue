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
      <span v-if="displaySession?.participants?.length">참여 {{ displaySession.participants.length }}명</span>
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
    <a v-if="previewLink" class="sessionMessageCard__link" :href="previewLink" target="_blank" rel="noreferrer">{{ providerLabel }}에서 열기</a>
    <div class="sessionMessageCard__actions">
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !isActionable" @click="$emit('play', displaySession)">재생</button>
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !isActionable" @click="$emit('pause', displaySession)">일시정지</button>
      <button type="button" class="sessionMessageCard__btn" :disabled="busy || !isActionable" @click="$emit('seek', displaySession)">+15초</button>
      <button type="button" class="sessionMessageCard__btn sessionMessageCard__btn--danger" :disabled="busy || !isActionable" @click="$emit('end', displaySession)">종료</button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';

const props = defineProps({
  message: { type: Object, required: true },
  session: { type: Object, default: null },
  busy: { type: Boolean, default: false },
});

defineEmits(['play', 'pause', 'seek', 'end']);

const displaySession = computed(() => props.session || {});
const isActionable = computed(() => displaySession.value?.status === 'ACTIVE' && !!displaySession.value?.sessionId);
const mediaLabel = computed(() => {
  const kind = String(displaySession.value?.mediaKind || '').toUpperCase();
  if (kind === 'MUSIC') return '같이 듣기';
  if (kind === 'MOVIE' || kind === 'VIDEO') return '같이 보기';
  return '공동 플레이';
});
const stateLabel = computed(() => {
  if (displaySession.value?.status === 'ENDED') return '종료됨';
  return displaySession.value?.playbackState === 'PLAYING' ? '재생 중' : '대기 중';
});

const sourceMeta = computed(() => getPlaybackSourceMeta(displaySession.value?.sourceUrl, displaySession.value?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewUrl = computed(() => sourceMeta.value.embedUrl);
const previewThumbnail = computed(() => sourceMeta.value.thumbnailUrl);
const previewLink = computed(() => sourceMeta.value.cleanUrl || displaySession.value?.sourceUrl || '');
const providerLabel = computed(() => sourceMeta.value.label || '링크');

const positionLabel = computed(() => {
  const total = Number(displaySession.value?.positionSeconds || 0);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `현재 위치 ${mm}:${ss}`;
});
</script>

<style scoped>
.sessionMessageCard{display:grid;gap:10px;margin-top:8px;padding:14px 16px;border-radius:20px;border:1px solid rgba(122,140,255,.22);background:linear-gradient(180deg,rgba(26,32,58,.96),rgba(11,16,29,.94));box-shadow:0 14px 34px rgba(0,0,0,.22)}
.sessionMessageCard__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionMessageCard__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionMessageCard__state{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(122,140,255,.16);border:1px solid rgba(122,140,255,.28);font-size:11px;font-weight:900}.sessionMessageCard[data-status="ENDED"] .sessionMessageCard__state{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72)}.sessionMessageCard__summary{margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.82)}.sessionMessageCard__meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.68)}.sessionMessageCard__preview{overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.sessionMessageCard__iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}.sessionMessageCard__thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.sessionMessageCard__link{font-size:13px;font-weight:800;color:#cfd6ff}.sessionMessageCard__actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sessionMessageCard__btn{min-height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;font-weight:800}.sessionMessageCard__btn--danger{border-color:rgba(255,120,120,.24);color:#ffb4b4}@media (max-width:720px){.sessionMessageCard__actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
