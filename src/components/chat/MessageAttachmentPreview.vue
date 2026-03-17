<script setup>
import { computed, ref } from "vue";
import MediaLightbox from "@/components/media/MediaLightbox.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
});
const emit = defineEmits(["remove"]);

function normalizeKind(item) {
  const kind = String(item?.kind || item?.mediaType || "").toLowerCase();
  const ct = String(item?.contentType || "").toLowerCase();
  const name = String(item?.originalName || item?.name || "").toLowerCase();
  if (kind === "image" || ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "image";
  if (kind === "video" || ct.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi)$/.test(name)) return "video";
  return "file";
}
function prettyBytes(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num < 1024) return `${num}B`;
  if (num < 1024 * 1024) return `${Math.round(num / 1024)}KB`;
  return `${(num / (1024 * 1024)).toFixed(1)}MB`;
}
const itemsNormalized = computed(() => (Array.isArray(props.items) ? props.items : []).map((raw, idx) => {
  const src = raw?.url || raw?.downloadUrl || raw?.src || "";
  const thumb = raw?.thumbnailUrl || raw?.thumb || src || "";
  const name = raw?.originalName || raw?.name || `첨부 ${idx + 1}`;
  const kind = normalizeKind(raw);
  return {
    idx,
    raw,
    src,
    thumb,
    kind,
    name,
    sub: [prettyBytes(raw?.size), raw?.contentType].filter(Boolean).join(" · "),
  };
}));
const normalizedViewerItems = computed(() => itemsNormalized.value.filter((i) => i.kind !== 'file').map((i) => ({
  type: i.kind,
  url: i.src,
  thumbnailUrl: i.thumb,
  name: i.name,
}))); 
const viewerOpen = ref(false);
const viewerIndex = ref(0);
function openViewer(raw) {
  const kind = normalizeKind(raw);
  if (kind === 'file') return;
  const src = raw?.url || raw?.downloadUrl || raw?.src || '';
  const idx = normalizedViewerItems.value.findIndex((i) => i.url === src);
  viewerIndex.value = idx >= 0 ? idx : 0;
  viewerOpen.value = true;
}
function closeViewer() { viewerOpen.value = false; }
</script>

<template>
  <div class="messageAttachmentPreview">
    <div class="previewList">
      <article v-for="item in itemsNormalized" :key="item.idx" class="previewCard">
        <button class="thumb" :data-kind="item.kind" type="button" @click="openViewer(item.raw)">
          <img v-if="item.kind === 'image' && item.thumb" :src="item.thumb" alt="" />
          <div v-else-if="item.kind === 'video'" class="thumbVideoWrap">
            <img v-if="item.thumb" :src="item.thumb" alt="" />
            <div v-else class="thumbVideoFallback">VIDEO</div>
            <span class="playBadge">▶</span>
          </div>
          <span v-else>FILE</span>
        </button>
        <div class="meta">
          <div class="name">{{ item.name }}</div>
          <div class="sub">{{ item.sub }}</div>
        </div>
        <div class="actionsCol">
          <button v-if="item.kind !== 'file'" class="ghostBtn" type="button" @click="openViewer(item.raw)">보기</button>
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
.thumbVideoWrap{position:relative;width:100%;height:100%;display:grid;place-items:center;background:rgba(255,255,255,.04)}
.thumbVideoFallback{font-size:10px;font-weight:900;color:rgba(255,255,255,.85)}
.playBadge{position:absolute;inset:auto auto 6px 6px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:900}
.meta{min-width:0}
.name{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sub{margin-top:4px;font-size:11px;color:rgba(255,255,255,.62)}
.actionsCol{display:flex;align-items:center;gap:8px}
.ghostBtn,.removeBtn,.ghostLink{height:34px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
@media (max-width:640px){.previewCard{grid-template-columns:auto 1fr}.actionsCol{grid-column:1 / -1;justify-content:flex-end}}
</style>
