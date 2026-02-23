<!-- src/components/PostComposer.vue -->
<template>
  <div class="backdrop" @click.self="close">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Create post">
      <div class="top">
        <div>
          <div class="title">새 게시글</div>
          <div class="sub">누가 볼 수 있을지도 선택할 수 있어요</div>
        </div>
        <button class="x" type="button" @click="close" aria-label="Close">✕</button>
      </div>

      <form class="form" @submit.prevent="submit">
        <div class="row">
          <label class="label">
            공개 범위
            <select v-model="visibility" class="select">
              <option value="ALL">전체 공개</option>
              <option value="FOLLOWERS">팔로워만</option>
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
              rows="5"
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

        <div class="actions">
          <button type="button" class="btn ghost" @click="close" :disabled="busy">취소</button>
          <button type="submit" class="btn primary" :disabled="!canSubmit || busy">
            {{ busy ? "게시 중..." : "게시하기" }}
          </button>
        </div>

        <div class="footNote">
          • 피드 목록은 <b>/api/feed</b>, 게시글 생성은 <b>/api/posts</b>로 맞춰져 있어요.
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

const content = ref("");
const contentEl = ref(null);
const visibility = ref("ALL");
const legacyUrl = ref("");

const fileInput = ref(null);
const dragOver = ref(false);

const selectedFiles = ref([]);
const previews = ref([]);
const uploadedIds = ref([]); // UUID strings

const uploading = ref(false);
const progress = ref(0);
const uploadError = ref("");
const busy = ref(false);

// 모달 열렸을 때 배경 스크롤 방지 + ESC 닫기 + 첫 포커스
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
  if (busy.value) return; // 게시 중에는 닫기 방지
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

    // 이미지 선택했는데 아직 업로드 안했으면 자동 업로드
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
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:end center;z-index:1000}
.sheet{width:min(720px,100%);border-radius:22px 22px 0 0;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent);backdrop-filter:blur(16px);padding:16px;box-shadow:0 22px 80px rgba(0,0,0,.55);padding-bottom: calc(16px + env(safe-area-inset-bottom));}
.top{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:12px}
.title{font-weight:950;font-size:16px}
.sub{margin-top:4px;font-size:12.5px;color:var(--muted)}
.x{width:40px;height:40px;border-radius:14px;border:1px solid var(--border);background:transparent;color:var(--text);opacity:.9}
.form{display:grid;gap:14px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:640px){.row{grid-template-columns:1fr}}
.label{display:grid;gap:8px;font-size:13px;color:var(--muted)}
.select,.input{height:44px;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);padding:0 12px;color:var(--text)}
.textarea{resize:vertical;min-height:110px;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);padding:12px;color:var(--text);line-height:1.4}
.hint{display:flex;justify-content:end;gap:2px;font-size:12px;color:var(--muted)}
.uploader{display:grid;gap:12px}
.drop{border-radius:18px;border:1px dashed color-mix(in oklab,var(--border) 80%,transparent);background:color-mix(in oklab,var(--surface) 88%,transparent);padding:14px;display:grid;gap:8px}
.drop[data-drag="true"]{border-color:color-mix(in oklab,var(--accent) 55%,var(--border));background:color-mix(in oklab,var(--accent) 12%,var(--surface))}
.dropTitle{font-weight:900;color:var(--text)}
.dropSub{font-size:12.5px;color:var(--muted)}
.hiddenInput{display:none}
.pickBtn{justify-self:start;height:40px;padding:0 12px;border-radius:14px;border:1px solid color-mix(in oklab,var(--accent) 40%,var(--border));background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--text);font-weight:900}
.rules{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
@media (max-width:560px){.grid{grid-template-columns:repeat(3,1fr)}}
.thumb{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--border);background:#000;aspect-ratio:1/1}
.img{width:100%;height:100%;object-fit:cover;display:block}
.rm{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff}
.progress{display:grid;gap:6px}
.bar{height:10px;border-radius:999px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 80%,transparent);overflow:hidden}
.barFill{height:100%;background:linear-gradient(90deg,var(--accent),var(--success));border-radius:999px}
.progressText{font-size:12px;color:var(--muted)}
.err{font-size:12.5px;color:color-mix(in oklab,var(--danger) 80%,white);display:flex;align-items:center;justify-content:space-between;gap:10px}
.retry{height:34px;padding:0 10px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px}
.btn{height:46px;border-radius:16px;border:1px solid var(--border);color:var(--text);font-weight:950}
.btn.ghost{background:transparent}
.btn.primary{border-color:color-mix(in oklab,var(--accent) 45%,var(--border));background:color-mix(in oklab,var(--accent) 18%,transparent)}
.btn:disabled{opacity:.55}
.footNote{margin-top:2px;font-size:11.5px;color:var(--muted);line-height:1.35}
</style>