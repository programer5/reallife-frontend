<script setup>
import { computed, ref } from "vue";
import MediaLightbox from "@/components/media/MediaLightbox.vue";
import { normalizeMessageAttachments } from "@/lib/mediaModel";

const props = defineProps({
  items: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
  mode: { type: String, default: "default" },
  uploading: { type: Boolean, default: false },
  uploadProgress: { type: Number, default: 0 },
});
const emit = defineEmits(["remove"]);

const brokenThumbs = ref(new Set());

function prettyBytes(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num < 1024) return `${num}B`;
  if (num < 1024 * 1024) return `${Math.round(num / 1024)}KB`;
  return `${(num / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageLike(url = "") {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(String(url));
}

function uploadStateLabel(state, progress) {
  if (state === "failed") return "업로드 실패";
  if (state === "uploaded") return "업로드 완료";
  if (state === "uploading") return `업로드 중 ${Math.max(0, Math.min(100, Number(progress || 0)))}%`;
  if (state === "queued") return "업로드 대기";
  return "준비됨";
}

const itemsNormalized = computed(() => normalizeMessageAttachments(props.items).map((item, idx) => {
  const raw = props.items?.[idx] || item.original || item;
  const thumb = item.thumbnailUrl || "";
  const src = item.url || item.previewUrl || item.downloadUrl || "";
  const thumbKey = String(thumb || src || `${idx}`);
  const canRenderThumb = item.kind === "image"
    ? !!src
    : !!thumb && isImageLike(thumb) && !brokenThumbs.value.has(thumbKey);
  const uploadState = String(raw?._uploadState || "").trim() || (props.uploading ? "uploading" : "ready");
  const uploadProgress = Number(raw?._uploadProgress ?? props.uploadProgress ?? 0);
  return {
    idx,
    raw,
    src,
    thumb,
    kind: item.kind,
    name: item.name,
    thumbKey,
    canRenderThumb,
    sub: [prettyBytes(item.size), item.contentType].filter(Boolean).join(" · "),
    uploadState,
    uploadProgress,
    stateLabel: uploadStateLabel(uploadState, uploadProgress),
  };
}));

const normalizedViewerItems = computed(() =>
  normalizeMessageAttachments(props.items).filter((i) => i.kind !== "file" && !!(i.url || i.previewUrl || i.downloadUrl))
);

const summary = computed(() => {
  const total = itemsNormalized.value.length;
  const images = itemsNormalized.value.filter((item) => item.kind === "image").length;
  const videos = itemsNormalized.value.filter((item) => item.kind === "video").length;
  const files = total - images - videos;
  return {
    total,
    text: [
      images ? `이미지 ${images}` : "",
      videos ? `동영상 ${videos}` : "",
      files ? `파일 ${files}` : "",
    ].filter(Boolean).join(" · "),
  };
});

const viewerOpen = ref(false);
const viewerIndex = ref(0);

function openViewer(raw) {
  const normalized = normalizeMessageAttachments([raw])[0];
  if (!normalized || normalized.kind === "file") return;
  const src = normalized.url || normalized.previewUrl || normalized.downloadUrl;
  const idx = normalizedViewerItems.value.findIndex((i) => (i.url || i.previewUrl || i.downloadUrl) === src);
  viewerIndex.value = idx >= 0 ? idx : 0;
  viewerOpen.value = true;
}

function closeViewer() {
  viewerOpen.value = false;
}

function markBrokenThumb(key) {
  brokenThumbs.value.add(String(key));
}
</script>

<template>
  <div class="messageAttachmentPreview" :class="[`messageAttachmentPreview--${mode}`]">
    <div v-if="mode === 'composer' && summary.total" class="previewHeader">
      <div class="previewTitle">첨부 {{ summary.total }}개</div>
      <div class="previewSummary">{{ summary.text }}</div>
    </div>

    <div class="previewList">
      <article v-for="item in itemsNormalized" :key="item.idx" class="previewCard" :data-state="item.uploadState">
        <button class="thumb" :data-kind="item.kind" type="button" @click="openViewer(item.raw)">
          <img v-if="item.kind === 'image' && item.canRenderThumb" :src="item.src" alt="" />

          <div v-else-if="item.kind === 'video'" class="thumbVideoWrap" :class="{ noThumb: !item.canRenderThumb }">
            <img
              v-if="item.canRenderThumb"
              :src="item.thumb"
              alt=""
              @error="markBrokenThumb(item.thumbKey)"
            />
            <div v-else class="thumbVideoFallback" aria-hidden="true">
              <div class="thumbVideoGlyph">
                <span class="thumbVideoPlay">▶</span>
              </div>
              <div class="thumbVideoLabel">VIDEO</div>
            </div>
            <span v-if="item.canRenderThumb" class="playBadge">▶</span>
          </div>

          <span v-else>FILE</span>
        </button>

        <div class="meta">
          <div class="nameRow">
            <div class="name">{{ item.name }}</div>
            <span v-if="item.uploadState !== 'ready'" class="stateBadge" :data-state="item.uploadState">{{ item.stateLabel }}</span>
          </div>
          <div class="sub">{{ item.sub }}</div>
          <div v-if="item.uploadState === 'uploading'" class="stateBar"><span :style="{ width: `${item.uploadProgress}%` }"></span></div>
        </div>

        <div class="actionsCol">
          <button v-if="item.kind !== 'file' && item.src" class="ghostBtn" type="button" @click="openViewer(item.raw)">보기</button>
          <a v-else-if="item.src" class="ghostBtn ghostLink" :href="item.src" target="_blank" rel="noopener noreferrer">열기</a>
          <button v-if="removable" class="removeBtn" type="button" @click="emit('remove', item.idx)">제거</button>
        </div>
      </article>
    </div>

    <MediaLightbox
      v-if="viewerOpen && normalizedViewerItems.length"
      :items="normalizedViewerItems"
      :start-index="viewerIndex"
      @close="closeViewer"
    />
  </div>
</template>

<style scoped>
.messageAttachmentPreview{display:grid;gap:8px}
.previewHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px}
.previewTitle{font-size:12px;font-weight:900;color:rgba(255,255,255,.9)}
.previewSummary{font-size:11px;color:rgba(255,255,255,.62)}
.previewList{display:grid;gap:8px}
.previewCard{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.previewCard[data-state="uploading"]{border-color:rgba(126,182,255,.28);background:rgba(76,124,255,.08)}
.previewCard[data-state="uploaded"]{border-color:rgba(93,215,157,.24);background:rgba(48,165,103,.08)}
.previewCard[data-state="failed"]{border-color:rgba(255,107,129,.28);background:rgba(255,107,129,.08)}
.thumb{width:56px;height:56px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;background:rgba(255,255,255,.04);font-size:10px;font-weight:900;padding:0;cursor:pointer}
.thumb img,.thumb video{width:100%;height:100%;object-fit:cover;display:block}
.thumbVideoWrap{position:relative;width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03))}
.thumbVideoWrap.noThumb{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))}
.thumbVideoFallback{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,.92)}
.thumbVideoGlyph{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:rgba(9,13,22,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.thumbVideoPlay{font-size:11px;line-height:1;margin-left:1px}
.thumbVideoLabel{font-size:8px;font-weight:900;letter-spacing:.12em;opacity:.92}
.playBadge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:rgba(9,13,22,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);color:#fff;font-size:11px;font-weight:900}
.meta{min-width:0;display:grid;gap:4px}
.nameRow{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.name{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.sub{font-size:11px;color:rgba(255,255,255,.62)}
.stateBadge{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06)}
.stateBadge[data-state="uploading"]{border-color:rgba(126,182,255,.28);color:rgba(190,220,255,.94)}
.stateBadge[data-state="uploaded"]{border-color:rgba(93,215,157,.3);color:rgba(183,245,211,.96)}
.stateBadge[data-state="failed"]{border-color:rgba(255,107,129,.34);color:rgba(255,196,204,.96)}
.stateBar{position:relative;height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.stateBar span{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,rgba(126,182,255,.9),rgba(93,215,157,.9))}
.actionsCol{display:flex;align-items:center;gap:8px}
.ghostBtn,.removeBtn,.ghostLink{height:34px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.messageAttachmentPreview--composer .previewCard{box-shadow:0 10px 24px rgba(0,0,0,.14)}
@media (max-width:640px){.previewCard{grid-template-columns:auto 1fr}.actionsCol{grid-column:1 / -1;justify-content:flex-end}.previewHeader{padding:0 2px}.name{max-width:calc(100vw - 180px)}}
</style>
