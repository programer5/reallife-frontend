<script setup>
const props = defineProps({
  lensBadge: { type: [Number, String], default: 0 },
  stageTotal: { type: [Number, String], default: 0 },
  messageDepthEnabled: { type: Boolean, default: false },
  railPrimarySession: { type: Object, default: null },
});
const emit = defineEmits(["open-lens", "open-stage", "toggle-depth", "open-rail-session", "open-session-modal"]);
</script>

<template>
  <div class="composerUtilityBar composerUtilityBar--compact">
    <button type="button" class="composerUtilityBar__pill composerUtilityBar__pill--lens" title="렌즈" aria-label="렌즈" @click="emit('open-lens')">
      <span class="composerUtilityBar__pillTag">🔎</span>
      <strong>{{ props.lensBadge }}</strong>
    </button>
    <button type="button" class="composerUtilityBar__pill" title="무대" aria-label="무대" @click="emit('open-stage')">
      <span class="composerUtilityBar__pillTag">🎞</span>
      <strong>{{ props.stageTotal }}</strong>
    </button>
    <button type="button" class="composerUtilityBar__pill" :class="{ 'composerUtilityBar__pill--active': props.messageDepthEnabled }" :title="props.messageDepthEnabled ? '집중 끄기' : '집중 켜기'" :aria-label="props.messageDepthEnabled ? '집중 끄기' : '집중 켜기'" @click="emit('toggle-depth')">
      <span class="composerUtilityBar__pillTag">👁</span>
      <strong>{{ props.messageDepthEnabled ? '●' : '○' }}</strong>
    </button>
    <button v-if="props.railPrimarySession" type="button" class="composerUtilityBar__pill composerUtilityBar__pill--session" :title="props.railPrimarySession.title || '세션'" :aria-label="props.railPrimarySession.title || '세션'" @click="emit('open-rail-session')">
      <span class="composerUtilityBar__pillTag">▶</span>
      <strong>{{ props.railPrimarySession.title || '세션' }}</strong>
    </button>
    <button type="button" class="composerUtilityBar__pill composerUtilityBar__pill--ghost" title="세션 만들기" aria-label="세션 만들기" @click="emit('open-session-modal')">
      <span class="composerUtilityBar__pillTag">＋</span>
      <strong>▶</strong>
    </button>
  </div>
</template>
