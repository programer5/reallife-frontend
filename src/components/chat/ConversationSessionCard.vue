<template>
  <article class="sessionCard" :data-status="session?.status || 'ACTIVE'">
    <div class="sessionCard__head">
      <div>
        <div class="sessionCard__eyebrow">{{ mediaLabel }}</div>
        <strong>{{ session?.title || '공동 플레이' }}</strong>
      </div>
      <span class="sessionCard__state">{{ stateLabel }}</span>
    </div>
    <div class="sessionCard__meta">
      <span>위치 {{ positionLabel }}</span>
      <span v-if="session?.participants?.length">참여 {{ session.participants.length }}명</span>
    </div>
    <div v-if="previewKind !== 'link'" class="sessionCard__preview">
      <iframe
        v-if="previewKind === 'iframe' && previewUrl"
        class="sessionCard__iframe"
        :src="previewUrl"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
      <img v-else-if="previewKind === 'image' && previewThumbnail" class="sessionCard__thumb" :src="previewThumbnail" alt="" />
    </div>
    <a class="sessionCard__link" :href="previewLink" target="_blank" rel="noreferrer">{{ providerLabel }}에서 열기</a>
    <div class="sessionCard__actions">
      <button type="button" class="sessionCard__btn" :disabled="busy || !isActive" @click="$emit('play', session)">재생</button>
      <button type="button" class="sessionCard__btn" :disabled="busy || !isActive" @click="$emit('pause', session)">일시정지</button>
      <button type="button" class="sessionCard__btn" :disabled="busy || !isActive" @click="$emit('seek', session)">+15초</button>
      <button type="button" class="sessionCard__btn sessionCard__btn--danger" :disabled="busy || !isActive" @click="$emit('end', session)">종료</button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';

const props = defineProps({
  session: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});
const isActive = computed(() => props.session?.status === 'ACTIVE');
const mediaLabel = computed(() => {
  const kind = String(props.session?.mediaKind || '').toUpperCase();
  if (kind === 'MUSIC') return '같이 듣기';
  if (kind === 'MOVIE') return '같이 보기 · 영화';
  if (kind === 'VIDEO') return '같이 보기 · 영상';
  return '같이 열기';
});
const stateLabel = computed(() => {
  if (props.session?.status === 'ENDED') return '종료됨';
  return props.session?.playbackState === 'PLAYING' ? '재생 중' : '대기 중';
});

const sourceMeta = computed(() => getPlaybackSourceMeta(props.session?.sourceUrl, props.session?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewUrl = computed(() => sourceMeta.value.embedUrl);
const previewThumbnail = computed(() => sourceMeta.value.thumbnailUrl);
const previewLink = computed(() => sourceMeta.value.cleanUrl || props.session?.sourceUrl || '#');
const providerLabel = computed(() => sourceMeta.value.label || '링크');

const positionLabel = computed(() => {
  const total = Number(props.session?.positionSeconds || 0);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
});
</script>

<style scoped>
.sessionCard{display:grid;gap:10px;padding:14px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(18,22,38,.9),rgba(10,13,24,.92))}.sessionCard__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionCard__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionCard__state{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(122,140,255,.16);border:1px solid rgba(122,140,255,.28);font-size:11px;font-weight:900}.sessionCard[data-status="ENDED"] .sessionCard__state{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.72)}.sessionCard__meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.68)}.sessionCard__preview{overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}.sessionCard__iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}.sessionCard__thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.sessionCard__link{font-size:13px;font-weight:800;color:#cfd6ff}.sessionCard__actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sessionCard__btn{min-height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;font-weight:800}.sessionCard__btn--danger{border-color:rgba(255,120,120,.24);color:#ffb4b4}@media (max-width:720px){.sessionCard__actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
