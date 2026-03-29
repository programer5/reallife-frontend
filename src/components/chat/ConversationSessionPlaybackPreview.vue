<template>
  <div v-if="previewKind !== 'link'" class="sessionPlaybackPreview">
    <div v-if="shouldUseYouTubeApi" ref="youtubeHost" class="sessionPlaybackPreview__youtube" />
    <iframe
      v-else-if="isYouTube && previewUrl"
      class="sessionPlaybackPreview__iframe"
      :src="previewUrl"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    />
    <div v-if="shouldUseYouTubeApi && playerLoadError" class="sessionPlaybackPreview__fallback">
      <strong>YouTube 플레이어를 불러오지 못했어요.</strong>
      <p>브라우저 보안 설정이나 네트워크 상태 때문에 iframe API가 준비되지 않았을 수 있어요.</p>
      <a v-if="previewLink" :href="previewLink" target="_blank" rel="noopener noreferrer">YouTube에서 바로 열기</a>
    </div>
    <iframe
      v-else-if="previewKind === 'iframe' && previewUrl"
      class="sessionPlaybackPreview__iframe"
      :src="previewUrl"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    />
    <img v-else-if="previewKind === 'image' && previewThumbnail" class="sessionPlaybackPreview__thumb" :src="previewThumbnail" alt="" />
    <div v-if="isYouTube && syncLabel" class="sessionPlaybackPreview__syncBadge">{{ syncLabel }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';
import { subscribePlaybackCommand } from '@/lib/playbackCommandBus';
import { loadYouTubeIframeApi } from '@/lib/youtubeIframeApi';

const DRIFT_TOLERANCE_SECONDS = 2.5;
const LOCAL_INTENT_GRACE_MS = 1400;

const props = defineProps({
  session: { type: Object, required: true },
  interactive: { type: Boolean, default: true },
});

const emit = defineEmits(['playback-intent', 'position-sampled']);

const youtubeHost = ref(null);
const sourceMeta = computed(() => getPlaybackSourceMeta(props.session?.sourceUrl, props.session?.thumbnailUrl));
const previewKind = computed(() => sourceMeta.value.previewKind);
const previewUrl = computed(() => sourceMeta.value.embedUrl);
const previewThumbnail = computed(() => sourceMeta.value.thumbnailUrl);
const previewLink = computed(() => sourceMeta.value.cleanUrl || props.session?.sourceUrl || '');
const isYouTube = computed(() => sourceMeta.value.provider === 'youtube' && !!sourceMeta.value.mediaId);
const shouldUseYouTubeApi = computed(() => isYouTube.value && props.interactive);
const syncLabel = ref('');
const playerLoadError = ref('');
let syncLabelTimer = null;
let player = null;
let telemetryTimer = null;
let syncTimer = null;
let isProgrammatic = false;
let lastIntentKey = '';
let unsubscribePlaybackCommand = null;
let pendingCommand = null;
let localIntentUntil = 0;
let localIntentState = '';

function roundPosition(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}


function mapYouTubeState(rawState) {
  const state = Number(rawState);
  if (state === 1) return 'PLAYING';
  if (state === 2) return 'PAUSED';
  return "";
}

function markLocalIntent(playbackState = '') {
  localIntentState = String(playbackState || '').toUpperCase();
  localIntentUntil = Date.now() + LOCAL_INTENT_GRACE_MS;
}

function isWithinLocalIntentGrace(playbackState = '') {
  return !!localIntentState && Date.now() < localIntentUntil && String(playbackState || '').toUpperCase() !== localIntentState;
}

function markSyncLabel(text) {
  syncLabel.value = text;
  if (syncLabelTimer) window.clearTimeout(syncLabelTimer);
  syncLabelTimer = window.setTimeout(() => {
    syncLabel.value = '';
  }, 1800);
}

function emitPositionSample(playbackStateOverride = null) {
  if (!player || !shouldUseYouTubeApi.value) return;
  const positionSeconds = roundPosition(player.getCurrentTime?.() || props.session?.positionSeconds || 0);
  const currentPlaybackState = playbackStateOverride || mapYouTubeState(player.getPlayerState?.()) || props.session?.playbackState || 'PAUSED';
  emit('position-sampled', {
    session: props.session,
    positionSeconds,
    playbackState: currentPlaybackState,
  });
}

function applyPlayerSync({ forceSeek = false } = {}) {
  if (!player || !shouldUseYouTubeApi.value) return;
  const targetState = String(props.session?.playbackState || 'PAUSED').toUpperCase();
  const targetPosition = Number(props.session?.positionSeconds || 0);
  const currentPosition = Number(player.getCurrentTime?.() || 0);
  const ytState = Number(player.getPlayerState?.() || -1);
  const drift = Math.abs(currentPosition - targetPosition);

  if (forceSeek || drift >= DRIFT_TOLERANCE_SECONDS) {
    isProgrammatic = true;
    player.seekTo?.(targetPosition, true);
    if (!props.session?.canControl) markSyncLabel(`위치를 ${roundPosition(targetPosition)}초로 맞췄어요`);
    window.setTimeout(() => {
      isProgrammatic = false;
    }, 250);
  }

  if (targetState === 'PLAYING' && ytState !== 1) {
    isProgrammatic = true;
    player.playVideo?.();
    window.setTimeout(() => {
      isProgrammatic = false;
    }, 250);
  }
  if (targetState !== 'PLAYING' && ytState === 1) {
    isProgrammatic = true;
    player.pauseVideo?.();
    window.setTimeout(() => {
      isProgrammatic = false;
    }, 250);
  }
}


function applyImmediateCommand(command = {}) {
  if (!command || !shouldUseYouTubeApi.value) return;
  if (!player) {
    pendingCommand = command;
    return;
  }
  const hasPosition = command.positionSeconds !== undefined && command.positionSeconds !== null;
  const targetPosition = Number(command.positionSeconds || 0);
  const targetState = String(command.playbackState || '').toUpperCase();
  if (hasPosition) {
    isProgrammatic = true;
    player.seekTo?.(targetPosition, true);
  }
  if (targetState === 'PLAYING') {
    markLocalIntent('PLAYING');
    isProgrammatic = true;
    player.playVideo?.();
    markSyncLabel('재생 요청을 바로 반영했어요');
  } else if (targetState === 'PAUSED') {
    markLocalIntent('PAUSED');
    isProgrammatic = true;
    player.pauseVideo?.();
    markSyncLabel('일시정지를 바로 반영했어요');
  }
  window.setTimeout(() => {
    isProgrammatic = false;
  }, 300);
  emitPositionSample(targetState || null);
}

function bindPlaybackCommand() {
  if (unsubscribePlaybackCommand) unsubscribePlaybackCommand();
  unsubscribePlaybackCommand = subscribePlaybackCommand(props.session?.sessionId, (command) => {
    applyImmediateCommand(command);
  });
}

function restartTelemetry() {
  if (telemetryTimer) window.clearInterval(telemetryTimer);
  telemetryTimer = null;
  if (!player || !shouldUseYouTubeApi.value) return;
  telemetryTimer = window.setInterval(() => {
    emitPositionSample();
    if (!props.session?.canControl) applyPlayerSync();
  }, 2500);
}

async function ensurePlayer() {
  if (!shouldUseYouTubeApi.value || player || !youtubeHost.value || typeof window === 'undefined') return;
  playerLoadError.value = '';
  let YT;
  try {
    YT = await loadYouTubeIframeApi();
  } catch (error) {
    playerLoadError.value = error?.message || 'player-load-failed';
    return;
  }
  await nextTick();
  if (!youtubeHost.value || player) return;

  try {
    player = new YT.Player(youtubeHost.value, {
    videoId: sourceMeta.value.mediaId,
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      playsinline: 1,
      modestbranding: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        applyPlayerSync({ forceSeek: true });
        if (pendingCommand) {
          const command = pendingCommand;
          pendingCommand = null;
          applyImmediateCommand(command);
        }
        restartTelemetry();
      },
      onStateChange: () => {
        if (!player) return;
        const playbackState = mapYouTubeState(player.getPlayerState?.());
        if (!playbackState) return;
        emitPositionSample(playbackState);
        if (isProgrammatic) return;
        if (isWithinLocalIntentGrace(playbackState)) return;
        if (localIntentState === playbackState) {
          localIntentState = '';
          localIntentUntil = 0;
        }
        if (!props.session?.canControl) {
          window.setTimeout(() => applyPlayerSync(), 120);
          return;
        }
        const payload = {
          session: props.session,
          playbackState,
          positionSeconds: roundPosition(player.getCurrentTime?.() || props.session?.positionSeconds || 0),
        };
        const key = `${payload.playbackState}:${payload.positionSeconds}`;
        if (lastIntentKey === key) return;
        lastIntentKey = key;
        emit('playback-intent', payload);
      },
    },
  });
  } catch (error) {
    playerLoadError.value = error?.message || 'player-init-failed';
  }
}

function destroyPlayer() {
  playerLoadError.value = '';
  if (telemetryTimer) window.clearInterval(telemetryTimer);
  if (syncTimer) window.clearTimeout(syncTimer);
  telemetryTimer = null;
  syncTimer = null;
  if (player?.destroy) player.destroy();
  player = null;
}

watch(shouldUseYouTubeApi, async (enabled) => {
  destroyPlayer();
  bindPlaybackCommand();
  if (enabled) await nextTick();
  if (enabled) await ensurePlayer();
}, { immediate: true });

watch(youtubeHost, async (host) => {
  if (!host || !shouldUseYouTubeApi.value || player) return;
  await nextTick();
  await ensurePlayer();
});

watch(() => [props.session?.sessionId, props.session?.playbackState, props.session?.positionSeconds, props.session?.status], () => {
  if (!shouldUseYouTubeApi.value || !player) return;
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    applyPlayerSync();
  }, 80);
});

watch(() => sourceMeta.value.mediaId, async () => {
  destroyPlayer();
  bindPlaybackCommand();
  if (shouldUseYouTubeApi.value) await ensurePlayer();
});

watch(() => props.session?.sessionId, () => {
  bindPlaybackCommand();
});

onMounted(async () => {
  bindPlaybackCommand();
  if (shouldUseYouTubeApi.value) {
    await nextTick();
    await ensurePlayer();
  }
});

onBeforeUnmount(() => {
  if (syncLabelTimer) window.clearTimeout(syncLabelTimer);
  if (unsubscribePlaybackCommand) unsubscribePlaybackCommand();
  destroyPlayer();
});
</script>

<style scoped>
.sessionPlaybackPreview{position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}
.sessionPlaybackPreview__iframe,.sessionPlaybackPreview__thumb,.sessionPlaybackPreview__youtube{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}
.sessionPlaybackPreview__thumb{object-fit:cover}
.sessionPlaybackPreview__syncBadge{position:absolute;right:12px;bottom:12px;display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(10,13,24,.78);border:1px solid rgba(255,255,255,.12);font-size:11px;font-weight:800;color:#fff;backdrop-filter:blur(14px)}
.sessionPlaybackPreview__fallback{position:absolute;inset:12px;display:grid;gap:8px;align-content:end;padding:12px;border-radius:14px;background:linear-gradient(180deg,rgba(5,8,16,.12),rgba(5,8,16,.86));border:1px solid rgba(255,255,255,.08);color:#fff}.sessionPlaybackPreview__fallback p{margin:0;font-size:12px;line-height:1.45;color:rgba(255,255,255,.72)}.sessionPlaybackPreview__fallback a{display:inline-flex;justify-self:start;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);font-size:12px;font-weight:800;color:#fff}
</style>
