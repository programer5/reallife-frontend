<!-- src/components/PostComposer.vue -->
<template>
  <div class="backdrop" @click.self="close">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Create post">
      <div class="top">
        <div class="heading">
          <div class="title">새 게시글</div>
          <div class="sub">누가 볼 수 있을지도 선택할 수 있어요</div>
        </div>
        <button class="x" type="button" @click="close" aria-label="Close">✕</button>
      </div>

      <form class="form" @submit.prevent="submit">
        <div class="bodyScroll">
          <div class="row row--top">
            <label class="label">
              공개 범위
              <div class="visibilityPicker" role="radiogroup" aria-label="공개 범위">
                <button
                  v-for="opt in visibilityOptions"
                  :key="opt.value"
                  type="button"
                  class="visibilityBtn"
                  :class="{ on: visibility === opt.value }"
                  :aria-pressed="visibility === opt.value"
                  @click="visibility = opt.value"
                >
                  <span class="visibilityTitle">{{ opt.label }}</span>
                  <span class="visibilityDesc">{{ opt.desc }}</span>
                </button>
              </div>
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
              <div class="dropTitle">이미지 업로드</div>
              <div class="dropSub">드래그&드롭 또는 파일 선택</div>

              <input
                ref="fileInput"
                class="hiddenInput"
                type="file"
                accept="image/*"
                multiple
                @change="onPick"
              />

              <button class="pickBtn" type="button" @click="fileInput?.click()">
                파일 선택
              </button>

              <div class="rules">
                <div>• 최대 {{ MAX_FILES }}장</div>
                <div>• 한 장 최대 {{ MAX_MB }}MB</div>
              </div>
            </div>

            <div v-if="previews.length" class="grid" aria-label="Selected images">
              <div v-for="p in previews" :key="p.key" class="thumb">
                <img :src="p.url" alt="" class="img" />
                <button class="rm" type="button" @click="remove(p.key)" aria-label="Remove image">
                  ✕
                </button>
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

          <div class="footNote">
            • 피드 목록은 <b>/api/feed</b>, 게시글 생성은 <b>/api/posts</b>로 맞춰져 있어요.
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn ghost" @click="close" :disabled="busy">취소</button>
          <button type="submit" class="btn primary" :disabled="!canSubmit || busy">
            {{ busy ? "게시 중..." : "게시하기" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, onUnmounted, nextTick, ref } from "vue";
import { useToastStore } from "../stores/toast";
import { uploadImages } from "../api/files";
import { createPost } from "../api/posts";

const emit = defineEmits(["close", "created"]);
const toast = useToastStore();

const MAX_FILES = 5;
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const visibilityOptions = [
  { value: "ALL", label: "전체 공개", desc: "누구나 볼 수 있어요" },
  { value: "FOLLOWERS", label: "팔로워만", desc: "서로 연결된 사람 중심" },
  { value: "PRIVATE", label: "나만", desc: "임시 저장처럼 남겨둘 수 있어요" },
];

const content = ref("");
const contentEl = ref(null);
const visibility = ref("ALL");
const legacyUrl = ref("");

const fileInput = ref(null);
const dragOver = ref(false);

const selectedFiles = ref([]);
const previews = ref([]);
const uploadedIds = ref([]);

const uploading = ref(false);
const progress = ref(0);
const uploadError = ref("");
const busy = ref(false);

let prevOverflow = "";
function onKeydown(e) {
  if (e.key === "Escape") close();
}

onMounted(async () => {
  prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", onKeydown);

  await nextTick();
  contentEl.value?.focus?.();
});

onUnmounted(() => {
  document.body.style.overflow = prevOverflow;
  window.removeEventListener("keydown", onKeydown);
});

function close() {
  if (busy.value) return;
  emit("close");
}

function makeKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
}

function addFiles(files) {
  const incoming = Array.from(files || []);
  if (!incoming.length) return;

  const remaining = MAX_FILES - selectedFiles.value.length;
  const clipped = incoming.slice(0, Math.max(0, remaining));

  if (incoming.length > clipped.length) {
    toast.info("이미지 제한", `최대 ${MAX_FILES}장까지 업로드할 수 있어요.`);
  }

  for (const f of clipped) {
    if (!f.type.startsWith("image/")) {
      toast.error("업로드 불가", "이미지 파일만 업로드할 수 있어요.");
      continue;
    }
    if (f.size > MAX_BYTES) {
      toast.error("업로드 불가", `이미지는 한 장당 최대 ${MAX_MB}MB까지 가능해요.`);
      continue;
    }
    const key = makeKey(f);
    const url = URL.createObjectURL(f);
    selectedFiles.value.push(f);
    previews.value.push({ key, url, file: f });
  }

  uploadedIds.value = [];
  uploadError.value = "";
}

function onPick(e) {
  addFiles(e.target.files);
  e.target.value = "";
}

function onDrop(e) {
  dragOver.value = false;
  addFiles(e.dataTransfer?.files);
}

function remove(key) {
  const idx = previews.value.findIndex((p) => p.key === key);
  if (idx < 0) return;

  URL.revokeObjectURL(previews.value[idx].url);
  previews.value.splice(idx, 1);
  selectedFiles.value.splice(idx, 1);

  uploadedIds.value = [];
  uploadError.value = "";
}

async function uploadNow() {
  uploadError.value = "";
  progress.value = 0;

  if (!selectedFiles.value.length) {
    uploadedIds.value = [];
    return [];
  }

  uploading.value = true;
  try {
    const ids = await uploadImages(selectedFiles.value, {
      onProgress: (pct) => (progress.value = pct),
    });
    uploadedIds.value = (ids || []).filter(Boolean);
    return uploadedIds.value;
  } catch (e) {
    uploadError.value = e?.response?.data?.message || e?.message || "이미지 업로드에 실패했습니다.";
    throw e;
  } finally {
    uploading.value = false;
  }
}

const canSubmit = computed(() => {
  const hasText = content.value.trim().length > 0;
  const hasImage = selectedFiles.value.length > 0;
  const hasLegacy = legacyUrl.value.trim().length > 0;
  return hasText || hasImage || hasLegacy;
});

async function submit() {
  if (!canSubmit.value) return;
  busy.value = true;

  try {
    let imageFileIds = uploadedIds.value;

    if (selectedFiles.value.length && !uploadedIds.value.length) {
      imageFileIds = await uploadNow();
    }

    const imageUrls = legacyUrl.value.trim() ? [legacyUrl.value.trim()] : [];

    const created = await createPost({
      content: content.value.trim(),
      visibility: visibility.value,
      imageFileIds: imageFileIds || [],
      imageUrls,
    });

    toast.success("게시 완료", "피드에 반영되었습니다.");
    emit("created", created);
    emit("close");
  } catch {
    toast.error("게시 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => {
  previews.value.forEach((p) => URL.revokeObjectURL(p.url));
});
</script>

<style scoped>
.backdrop{
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background:
    radial-gradient(circle at 20% 12%, rgba(87, 180, 255, .08), transparent 28%),
    radial-gradient(circle at 82% 84%, rgba(103, 76, 255, .10), transparent 24%),
    rgba(2, 6, 18, .64);
  backdrop-filter: blur(12px);
}

.sheet{
  width: min(760px, 100%);
  max-height: min(880px, calc(100dvh - 40px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 28px;
  border: 1px solid color-mix(in oklab, var(--border) 88%, rgba(255,255,255,.08));
  background:
    linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)),
    color-mix(in oklab, var(--surface) 94%, rgba(6, 10, 26, .92));
  box-shadow:
    0 28px 90px rgba(0,0,0,.48),
    inset 0 1px 0 rgba(255,255,255,.05);
  overflow: hidden;
}

.top{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0));
}

.heading{min-width:0}
.title{font-weight:950;font-size:28px;letter-spacing:-.03em;line-height:1.1}
.sub{margin-top:6px;font-size:14px;color:rgba(255,255,255,.72)}

.x{
  flex: 0 0 auto;
  width:48px;
  height:48px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.03);
  color:var(--text);
  font-size:18px;
}

.form{
  min-height: 0;
  display:grid;
  grid-template-rows:minmax(0, 1fr) auto;
}

.bodyScroll{
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 14px;
  display:grid;
  gap:16px;
}

.bodyScroll::-webkit-scrollbar{width:10px}
.bodyScroll::-webkit-scrollbar-thumb{
  background: rgba(255,255,255,.14);
  border-radius: 999px;
}

.row{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;align-items:start}
.label{display:grid;gap:8px;font-size:13px;font-weight:700;color:rgba(255,255,255,.84)}

.visibilityPicker{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:8px;
}

.visibilityBtn{
  min-width:0;
  min-height:72px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(18,28,60,.92), rgba(11,18,42,.92));
  color:rgba(255,255,255,.94);
  padding:12px 12px 11px;
  display:grid;
  gap:4px;
  text-align:left;
  transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.visibilityBtn:hover{
  transform:translateY(-1px);
  border-color: rgba(255,255,255,.16);
}

.visibilityBtn.on{
  border-color: color-mix(in oklab, var(--accent) 56%, rgba(255,255,255,.16));
  background:
    linear-gradient(180deg, rgba(29, 54, 120, .88), rgba(15, 28, 68, .96)),
    color-mix(in oklab, var(--accent) 12%, rgba(255,255,255,.03));
  box-shadow: 0 0 0 3px rgba(94, 129, 255, .15);
}

.visibilityTitle{
  font-size:13px;
  font-weight:900;
  letter-spacing:-.02em;
}

.visibilityDesc{
  font-size:11.5px;
  line-height:1.35;
  color:rgba(255,255,255,.62);
}

.input{
  width: 100%;
  height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(18,28,60,.92), rgba(11,18,42,.92));
  padding: 0 14px;
  color: rgba(255,255,255,.96);
  outline: none;
}

.textarea{
  width: 100%;
  resize: vertical;
  min-height: 170px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(19,30,65,.96), rgba(12,20,46,.96));
  padding: 14px 16px;
  color: rgba(255,255,255,.96);
  line-height: 1.55;
  outline: none;
}

.visibilityBtn:focus-visible,
.input:focus,
.textarea:focus{
  border-color: color-mix(in oklab, var(--accent) 56%, rgba(255,255,255,.16));
  box-shadow: 0 0 0 3px rgba(94, 129, 255, .16);
}

.input::placeholder,
.textarea::placeholder{color:rgba(255,255,255,.34)}

.hint{display:flex;justify-content:flex-end;gap:2px;font-size:12px;color:rgba(255,255,255,.62)}
.uploader{display:grid;gap:12px}

.drop{
  border-radius:20px;
  border:1px dashed rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01));
  padding:16px;
  display:grid;
  gap:8px;
}

.drop[data-drag="true"]{
  border-color:color-mix(in oklab,var(--accent) 62%, rgba(255,255,255,.16));
  background:color-mix(in oklab,var(--accent) 11%, rgba(255,255,255,.02));
}

.dropTitle{font-weight:900;color:rgba(255,255,255,.96)}
.dropSub{font-size:13px;color:rgba(255,255,255,.72)}
.hiddenInput{display:none}

.pickBtn{
  justify-self:start;
  height:42px;
  padding:0 14px;
  border-radius:14px;
  border:1px solid color-mix(in oklab,var(--accent) 48%, rgba(255,255,255,.12));
  background:color-mix(in oklab,var(--accent) 16%, rgba(255,255,255,.03));
  color:rgba(255,255,255,.96);
  font-weight:900;
}

.rules{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.68)}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.thumb{position:relative;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#000;aspect-ratio:1/1}
.img{width:100%;height:100%;object-fit:cover;display:block}
.rm{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff}
.progress{display:grid;gap:6px}
.bar{height:10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);overflow:hidden}
.barFill{height:100%;background:linear-gradient(90deg,var(--accent),var(--success));border-radius:999px}
.progressText{font-size:12px;color:rgba(255,255,255,.68)}
.err{font-size:12.5px;color:color-mix(in oklab,var(--danger) 80%,white);display:flex;align-items:center;justify-content:space-between;gap:10px}
.retry{height:34px;padding:0 10px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:transparent;color:var(--text);font-weight:900}
.footNote{margin-top:2px;font-size:11.5px;color:rgba(255,255,255,.60);line-height:1.45}

.actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  padding: 14px 18px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255,255,255,.06);
  background:
    linear-gradient(180deg, rgba(8, 14, 34, .18), rgba(8, 14, 34, .96) 26%),
    color-mix(in oklab, var(--surface) 94%, rgba(6, 10, 26, .96));
}

.btn{height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.96);font-weight:950}
.btn.ghost{background:rgba(255,255,255,.025)}
.btn.primary{border-color:color-mix(in oklab,var(--accent) 45%, rgba(255,255,255,.12));background:color-mix(in oklab,var(--accent) 19%, rgba(255,255,255,.03))}
.btn:disabled{opacity:.55}

@media (max-width: 900px){
  .backdrop{
    place-items: end center;
    padding: 12px;
  }

  .sheet{
    width: min(100%, 720px);
    max-height: calc(100dvh - 12px);
    border-radius: 28px 28px 0 0;
  }

  .title{font-size:24px}
}

@media (max-width: 640px){
  .backdrop{
    padding: 0;
    background: rgba(2, 6, 18, .70);
  }

  .sheet{
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 24px 24px 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
  }

  .top{
    padding: 16px 14px 12px;
  }

  .title{font-size:20px}
  .sub{font-size:13px}
  .x{width:44px;height:44px;border-radius:15px}

  .bodyScroll{
    padding: 14px 14px 12px;
    gap: 14px;
  }

  .row{grid-template-columns:1fr}
  .input{height:46px;border-radius:15px}

  .visibilityPicker{
    grid-template-columns:1fr;
  }

  .visibilityBtn{
    min-height:58px;
    border-radius:16px;
    padding:11px 12px 10px;
  }

  .textarea{
    min-height: 132px;
    max-height: 240px;
    border-radius: 16px;
    padding: 12px 14px;
  }

  .drop{padding:14px;border-radius:18px}
  .grid{grid-template-columns:repeat(3,1fr)}

  .actions{
    position: sticky;
    bottom: 0;
    padding: 12px 14px calc(14px + env(safe-area-inset-bottom) + 8px);
    gap: 8px;
  }

  .btn{
    height: 48px;
    border-radius: 16px;
  }
}

@media (max-width: 360px){
  .bodyScroll{padding: 12px 12px 10px;}
  .top{padding: 14px 12px 10px;}
  .actions{padding: 10px 12px calc(12px + env(safe-area-inset-bottom) + 8px);}
  .btn{font-size:14px;}
}
</style>
