
<!-- src/components/PostComposer.vue -->
<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="close">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Create post">
        <div class="top">
          <div>
            <div class="title">새 게시글</div>
            <div class="sub">이미지와 동영상을 함께 올릴 수 있어요</div>
          </div>
          <button class="x" type="button" @click="close" aria-label="Close">✕</button>
        </div>

        <form class="form" @submit.prevent="submit">
          <div class="bodyScroll">
            <div class="row">
              <label class="label">
                공개 범위
                <select v-model="visibility" class="select">
                  <option value="ALL">전체 공개</option>
                  <option value="FOLLOWERS">서로 연결된 사람 중심</option>
                  <option value="PRIVATE">나만</option>
                </select>
              </label>

              <label class="label">
                레거시 이미지 URL(옵션)
                <input
                  v-model.trim="legacyUrl"
                  class="input"
                  placeholder="https://example.com/image.jpg"
                  inputmode="url"
                />
              </label>
            </div>

            <label class="label">
              내용
              <textarea
                ref="contentEl"
                v-model="content"
                class="textarea"
                rows="6"
                maxlength="2000"
                placeholder="무슨 일이 있었나요?"
              />
              <div class="hint"><span>{{ content.length }}</span><span>/2000</span></div>
            </label>

            <div class="uploader">
              <div
                class="drop"
                :data-drag="dragOver"
                @dragenter.prevent="dragOver = true"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="onDrop"
              >
                <div class="dropTitle">미디어 업로드</div>
                <div class="dropSub">이미지 또는 동영상을 드래그&드롭 하거나 파일 선택</div>

                <input
                  ref="fileInput"
                  class="hiddenInput"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  @change="onPick"
                />

                <button class="pickBtn" type="button" @click="fileInput?.click()">
                  파일 선택
                </button>

                <div class="rules">
                  <div>• 이미지/동영상 최대 {{ MAX_FILES }}개</div>
                  <div>• 이미지 한 장 최대 {{ IMAGE_MAX_MB }}MB</div>
                  <div>• 동영상 한 개 최대 {{ VIDEO_MAX_MB }}MB</div>
                </div>
              </div>

              <div v-if="previews.length" class="grid" aria-label="Selected media">
                <div v-for="p in previews" :key="p.key" class="thumb" :data-kind="p.kind">
                  <img v-if="p.kind === 'image'" :src="p.url" alt="" class="img" />
                  <video v-else class="img" :src="p.url" muted playsinline preload="metadata"></video>
                  <div class="mediaBadge">{{ p.kind === 'video' ? 'VIDEO' : 'IMAGE' }}</div>
                  <button class="rm" type="button" @click="remove(p.key)" aria-label="Remove media">✕</button>
                </div>
              </div>

              <div v-if="uploading" class="progress" role="status" aria-live="polite">
                <div class="bar"><div class="barFill" :style="{ width: progress + '%' }"></div></div>
                <div class="progressText">업로드 중… {{ progress }}%</div>
              </div>

              <div v-if="uploadError" class="err" role="alert">
                {{ uploadError }}
                <button type="button" class="retry" @click="uploadNow">재시도</button>
              </div>
            </div>

            <div class="footNote">• 피드 목록은 <b>/api/feed</b>, 게시글 생성은 <b>/api/posts</b>로 맞춰져 있어요.</div>
          </div>

          <div class="actions">
            <button type="button" class="btn ghost" @click="close" :disabled="busy">취소</button>
            <button type="submit" class="btn primary" :disabled="!canSubmit || busy">
              {{ busy ? '게시 중...' : '게시하기' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Teleport, computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { useToastStore } from '../stores/toast';
import { uploadFiles } from '../api/files';
import { createPost } from '../api/posts';

const props = defineProps({
  initialDraft: { type: Object, default: null },
  sourceMeta: { type: Object, default: null },
  locationHint: { type: Object, default: null },
});

const emit = defineEmits(['close', 'created']);
const toast = useToastStore();

const MAX_FILES = 5;
const IMAGE_MAX_MB = 10;
const VIDEO_MAX_MB = 60;
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;

const content = ref('');
const contentEl = ref(null);
const visibility = ref('ALL');
const legacyUrl = ref('');

const fileInput = ref(null);
const dragOver = ref(false);
const selectedFiles = ref([]);
const previews = ref([]);
const uploadedIds = ref([]);
const uploading = ref(false);
const progress = ref(0);
const uploadError = ref('');
const busy = ref(false);

const canSubmit = computed(() => {
  return !busy.value && (
    String(content.value || '').trim().length > 0 ||
    selectedFiles.value.length > 0 ||
    legacyUrl.value.trim().length > 0
  );
});

function onKeydown(e) {
  if (e.key === 'Escape') close();
}

const { setLocked: setBodyLocked } = useBodyScrollLock();

onMounted(async () => {
  setBodyLocked(true);
  window.addEventListener('keydown', onKeydown);

  if (props.initialDraft) {
    content.value = String(props.initialDraft.content || props.initialDraft.text || '');
    visibility.value = props.initialDraft.visibility || 'ALL';
    legacyUrl.value = props.initialDraft.legacyUrl || '';
  }

  await nextTick();
  contentEl.value?.focus?.();
});

onUnmounted(() => {
  setBodyLocked(false);
  window.removeEventListener('keydown', onKeydown);
  for (const p of previews.value) {
    if (p.url?.startsWith?.('blob:')) {
      try { URL.revokeObjectURL(p.url); } catch {}
    }
  }
});

function close() {
  if (busy.value) return;
  emit('close');
}

function makeKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
}
function kindOf(file) {
  const type = String(file?.type || '').toLowerCase();
  return type.startsWith('video/') ? 'video' : 'image';
}

function addFiles(files) {
  const incoming = Array.from(files || []);
  if (!incoming.length) return;
  const remaining = MAX_FILES - selectedFiles.value.length;
  const clipped = incoming.slice(0, Math.max(0, remaining));

  if (incoming.length > clipped.length) {
    toast.info('미디어 제한', `최대 ${MAX_FILES}개까지 업로드할 수 있어요.`);
  }

  for (const f of clipped) {
    const kind = kindOf(f);
    if (!(String(f.type || '').startsWith('image/') || String(f.type || '').startsWith('video/'))) {
      toast.error('업로드 불가', '이미지 또는 동영상 파일만 업로드할 수 있어요.');
      continue;
    }
    if (kind === 'image' && f.size > IMAGE_MAX_BYTES) {
      toast.error('업로드 불가', `이미지는 한 장당 최대 ${IMAGE_MAX_MB}MB까지 가능해요.`);
      continue;
    }
    if (kind === 'video' && f.size > VIDEO_MAX_BYTES) {
      toast.error('업로드 불가', `동영상은 한 개당 최대 ${VIDEO_MAX_MB}MB까지 가능해요.`);
      continue;
    }

    const key = makeKey(f);
    const url = URL.createObjectURL(f);
    selectedFiles.value.push(f);
    previews.value.push({ key, url, file: f, kind });
  }

  uploadedIds.value = [];
  uploadError.value = '';
}

function onPick(e) {
  addFiles(e.target.files);
  e.target.value = '';
}
function onDrop(e) {
  dragOver.value = false;
  addFiles(e.dataTransfer?.files || []);
}
function remove(key) {
  const idx = previews.value.findIndex((p) => p.key === key);
  if (idx < 0) return;
  const p = previews.value[idx];
  if (p.url?.startsWith?.('blob:')) {
    try { URL.revokeObjectURL(p.url); } catch {}
  }
  previews.value.splice(idx, 1);
  selectedFiles.value.splice(idx, 1);
  uploadedIds.value = [];
}

async function uploadNow() {
  if (!selectedFiles.value.length) return [];
  uploading.value = true;
  progress.value = 0;
  uploadError.value = '';
  try {
    const ids = await uploadFiles(selectedFiles.value, {
      onProgress: (p) => { progress.value = p; }
    });
    uploadedIds.value = ids || [];
    return uploadedIds.value;
  } catch (e) {
    uploadError.value = e?.response?.data?.message || '미디어 업로드에 실패했어요.';
    throw e;
  } finally {
    uploading.value = false;
  }
}

async function submit() {
  if (!canSubmit.value || busy.value) return;
  busy.value = true;
  try {
    let mediaFileIds = uploadedIds.value;
    if (selectedFiles.value.length && (!mediaFileIds || !mediaFileIds.length)) {
      mediaFileIds = await uploadNow();
    }
    const imageUrls = legacyUrl.value.trim() ? [legacyUrl.value.trim()] : [];

    const created = await createPost({
      content: content.value || '',
      visibility: visibility.value,
      mediaFileIds: mediaFileIds || [],
      imageFileIds: mediaFileIds || [],
      imageUrls,
      latitude: props.locationHint?.latitude ?? null,
      longitude: props.locationHint?.longitude ?? null,
      placeName: props.locationHint?.placeName ?? null,
    });

    toast.success?.('게시 완료', '새 게시글을 올렸어요.');
    emit('created', created);
    emit('close');
  } catch (e) {
    toast.error?.('게시 실패', e?.response?.data?.message || '게시에 실패했어요.');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(12px);display:grid;place-items:center;padding:16px;z-index:var(--z-modal)}
.sheet{width:min(760px,100%);max-height:min(90vh,920px);display:grid;grid-template-rows:auto 1fr;overflow:hidden;border-radius:28px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg, rgba(10,18,40,.98), rgba(8,14,30,.98))}
.top{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
.title{font-size:22px;font-weight:950;color:rgba(255,255,255,.98)}
.sub{margin-top:4px;font-size:13px;color:rgba(255,255,255,.7)}
.x{width:40px;height:40px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff}
.form{min-height:0;display:grid;grid-template-rows:1fr auto}
.bodyScroll{overflow:auto;padding:16px 20px 18px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.label{display:grid;gap:8px;color:#fff;font-size:13px;font-weight:800}
.select,.input,.textarea{width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(7,13,30,.85);color:#fff;padding:0 14px}
.select,.input{height:46px}
.textarea{min-height:170px;padding:14px;resize:vertical}
.hint{margin-top:6px;display:flex;justify-content:flex-end;gap:4px;color:rgba(255,255,255,.56);font-size:12px}
.uploader{margin-top:14px;display:grid;gap:12px}
.drop{padding:16px;border-radius:22px;border:1px dashed rgba(255,255,255,.14);background:rgba(255,255,255,.02)}
.drop[data-drag="true"]{border-color:rgba(120,180,255,.6);background:rgba(90,130,255,.08)}
.dropTitle{font-size:16px;font-weight:950;color:#fff}
.dropSub{margin-top:8px;color:rgba(255,255,255,.7);font-size:13px}
.hiddenInput{display:none}
.pickBtn{margin-top:14px;height:42px;padding:0 16px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(46,72,125,.62);color:#fff;font-weight:900}
.rules{margin-top:12px;display:grid;gap:4px;color:rgba(255,255,255,.64);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.thumb{position:relative;border-radius:18px;overflow:hidden;background:rgba(255,255,255,.04);aspect-ratio:1 / 1}
.thumb[data-kind="video"]{aspect-ratio:4 / 5}
.img{width:100%;height:100%;object-fit:cover;display:block}
.mediaBadge{position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.44);color:#fff;font-size:10px;font-weight:900}
.rm{position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:999px;border:none;background:rgba(0,0,0,.52);color:#fff}
.progress{display:grid;gap:8px}
.bar{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.barFill{height:100%;background:linear-gradient(90deg,#76a7ff,#9ecbff)}
.progressText{font-size:12px;color:rgba(255,255,255,.7);font-weight:800}
.err{padding:10px 12px;border-radius:14px;background:rgba(255,96,120,.08);color:#ffb7c3;font-size:13px;font-weight:700}
.retry{margin-left:10px;border:none;background:transparent;color:#fff;text-decoration:underline}
.footNote{margin-top:8px;color:rgba(255,255,255,.62);font-size:12px}
.actions{display:flex;justify-content:space-between;gap:12px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.06)}
.btn{flex:1;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.1);font-weight:950;color:#fff}
.btn.ghost{background:rgba(255,255,255,.03)}
.btn.primary{background:linear-gradient(180deg, rgba(65,86,143,.88), rgba(53,76,134,.86))}
@media (max-width: 640px){
  .row{grid-template-columns:1fr}
  .sheet{padding-bottom:env(safe-area-inset-bottom)}
  .bodyScroll{padding:14px 14px 16px}
  .top{padding:14px 14px 10px}
  .actions{padding:12px 14px calc(12px + env(safe-area-inset-bottom))}
  .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
</style>
