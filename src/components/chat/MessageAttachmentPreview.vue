<script setup>
import { computed, ref } from "vue";
import MediaLightbox from "@/components/media/MediaLightbox.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
});
const emit = defineEmits(["remove"]);

const brokenThumbs = ref(new Set());

function pickUrl(raw) {
  return raw?.previewUrl || raw?.url || raw?.downloadUrl || raw?.src || "";
}

function normalizeKind(item) {
  const kind = String(item?.kind || item?.mediaType || item?.type || "").toLowerCase();
  const ct = String(item?.contentType || item?.type || "").toLowerCase();
  const name = String(item?.originalName || item?.originalFilename || item?.name || "").toLowerCase();
  const url = String(pickUrl(item)).toLowerCase();
  if (
    kind === "image" ||
    ct.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(name) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(url)
  ) return "image";
  if (
    kind === "video" ||
    ct.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v|avi|ogg)(\?|$)/.test(name) ||
    /\.(mp4|webm|mov|m4v|avi|ogg)(\?|$)/.test(url)
  ) return "video";
  return "file";
}

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

const itemsNormalized = computed(() => (Array.isArray(props.items) ? props.items : []).map((raw, idx) => {
  const src = pickUrl(raw);
  const thumb = raw?.thumbnailUrl || raw?.thumb || "";
  const name = raw?.originalName || raw?.originalFilename || raw?.name || `첨부 ${idx + 1}`;
  const kind = normalizeKind(raw);
  const thumbKey = String(thumb || src || `${idx}`);
  const canRenderThumb = kind === "image"
    ? !!src
    : !!thumb && isImageLike(thumb) && !brokenThumbs.value.has(thumbKey);
  return {
    idx,
    raw,
    src,
    thumb,
    kind,
    name,
    thumbKey,
    canRenderThumb,
    sub: [prettyBytes(raw?.size), raw?.contentType || raw?.type].filter(Boolean).join(" · "),
  };
}));

const normalizedViewerItems = computed(() =>
  itemsNormalized.value
    .filter((i) => i.kind !== "file")
    .map((i) => ({
      kind: i.kind,
      type: i.kind,
      mediaType: i.kind,
      url: i.src,
      src: i.src,
      thumbnailUrl: i.thumb || (i.kind === "image" ? i.src : ""),
      contentType:
        i.kind === "video"
          ? (i.raw?.contentType || i.raw?.type || "video/mp4")
          : i.kind === "image"
            ? (i.raw?.contentType || i.raw?.type || "image/*")
            : "",
      name: i.name,
    }))
    .filter((i) => !!i.url)
);

const viewerOpen = ref(false);
const viewerIndex = ref(0);

function openViewer(raw) {
  const kind = normalizeKind(raw);
  if (kind === "file") return;
  const src = pickUrl(raw);
  const idx = normalizedViewerItems.value.findIndex((i) => i.url === src);
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
  <div class="messageAttachmentPreview">
    <div class="previewList">
      <article v-for="item in itemsNormalized" :key="item.idx" class="previewCard">
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
          <div class="name">{{ item.name }}</div>
          <div class="sub">{{ item.sub }}</div>
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
.previewList{display:grid;gap:8px}
.previewCard{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.thumb{width:56px;height:56px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;background:rgba(255,255,255,.04);font-size:10px;font-weight:900;padding:0;cursor:pointer}
.thumb img,.thumb video{width:100%;height:100%;object-fit:cover;display:block}
.thumbVideoWrap{position:relative;width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03))}
.thumbVideoWrap.noThumb{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))}
.thumbVideoFallback{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,.92)}
.thumbVideoGlyph{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:rgba(9,13,22,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.thumbVideoPlay{font-size:11px;line-height:1;margin-left:1px}
.thumbVideoLabel{font-size:8px;font-weight:900;letter-spacing:.12em;opacity:.92}
.playBadge{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:rgba(9,13,22,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);color:#fff;font-size:11px;font-weight:900}
.meta{min-width:0}
.name{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sub{margin-top:4px;font-size:11px;color:rgba(255,255,255,.62)}
.actionsCol{display:flex;align-items:center;gap:8px}
.ghostBtn,.removeBtn,.ghostLink{height:34px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
@media (max-width:640px){.previewCard{grid-template-columns:auto 1fr}.actionsCol{grid-column:1 / -1;justify-content:flex-end}}
</style>
