<template>
  <RlModal :open="open" title="공동 플레이 시작" @close="$emit('close')">
    <div class="sessionComposer">
      <label class="sessionComposer__field">
        <span>형식</span>
        <select v-model="form.mediaKind" :disabled="busy">
          <option value="MOVIE">같이 보기 · 영화</option>
          <option value="VIDEO">같이 보기 · 영상</option>
          <option value="MUSIC">같이 듣기 · 음악</option>
          <option value="LINK">같이 열기 · 링크</option>
        </select>
      </label>
      <label class="sessionComposer__field">
        <span>세션 제목</span>
        <input v-model.trim="form.title" type="text" maxlength="160" placeholder="예: 비 오는 날 같이 듣기" :disabled="busy" />
      </label>
      <label class="sessionComposer__field">
        <span>링크</span>
        <input v-model.trim="form.sourceUrl" type="url" maxlength="1000" placeholder="https://..." :disabled="busy" />
      </label>
      <label class="sessionComposer__field">
        <span>썸네일 URL</span>
        <input v-model.trim="form.thumbnailUrl" type="url" maxlength="1000" placeholder="선택 사항" :disabled="busy" />
      </label>
      <div class="sessionComposer__detected">
        <strong>감지된 소스</strong>
        <span>{{ detectedSource.label }}</span>
        <small>{{ detectedSource.previewKind === 'iframe' ? '임베드 미리보기를 지원합니다.' : '링크 카드 형태로 표시됩니다.' }}</small>
      </div>
      <div class="sessionComposer__actions">
        <button type="button" class="sessionComposer__btn sessionComposer__btn--ghost" title="닫기" aria-label="닫기" :disabled="busy" @click="$emit('close')">✕</button>
        <button type="button" class="sessionComposer__btn" :title="busy ? '생성 중' : '세션 만들기'" :aria-label="busy ? '생성 중' : '세션 만들기'" :disabled="busy || !canSubmit" @click="submit">{{ busy ? '…' : '＋' }}</button>
      </div>
    </div>
  </RlModal>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import RlModal from '@/components/ui/RlModal.vue';
import { getPlaybackSourceMeta } from '@/lib/playbackSourceMeta';

const props = defineProps({
  open: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'submit']);

const form = reactive({ mediaKind: 'VIDEO', title: '', sourceUrl: '', thumbnailUrl: '' });
const canSubmit = computed(() => !!form.title.trim() && !!form.sourceUrl.trim());
const detectedSource = computed(() => getPlaybackSourceMeta(form.sourceUrl, form.thumbnailUrl));

watch(() => props.open, (open) => {
  if (open) return;
  form.mediaKind = 'VIDEO';
  form.title = '';
  form.sourceUrl = '';
  form.thumbnailUrl = '';
});

function submit() {
  if (!canSubmit.value || props.busy) return;
  emit('submit', {
    mediaKind: form.mediaKind,
    title: form.title.trim(),
    sourceUrl: form.sourceUrl.trim(),
    thumbnailUrl: form.thumbnailUrl.trim() || null,
  });
}
</script>

<style scoped>
.sessionComposer{display:grid;gap:11px}.sessionComposer__field{display:grid;gap:5px}.sessionComposer__field span{font-size:11px;font-weight:800;color:var(--muted)}.sessionComposer__field input,.sessionComposer__field select{min-height:40px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:0 11px}.sessionComposer__detected{display:grid;gap:2px;padding:10px 11px;border-radius:12px;border:1px solid var(--border);background:var(--surface-soft, rgba(255,255,255,.03))}.sessionComposer__detected strong{font-size:11px}.sessionComposer__detected span{font-size:12px;font-weight:800}.sessionComposer__detected small{font-size:11px;color:var(--muted)}.sessionComposer__actions{display:flex;justify-content:flex-end;gap:6px}.sessionComposer__btn{min-height:34px;min-width:34px;padding:0 12px;border-radius:10px;border:0;background:linear-gradient(135deg,#7a8cff,#8e66ff);color:#fff;font-weight:900}.sessionComposer__btn--ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
@media (max-width: 720px){
  .sessionComposer{gap:10px}
  .sessionComposer__field input,.sessionComposer__field select{min-height:38px}
  .sessionComposer__btn{min-height:32px;min-width:32px;padding:0 10px}
}

.sessionComposer__actions{gap:6px}
.sessionComposer__btn{min-height:34px;min-width:34px;padding:0 10px;border-radius:10px}

</style>
