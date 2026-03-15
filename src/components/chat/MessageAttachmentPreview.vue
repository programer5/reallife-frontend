<script setup>
import { computed, ref } from "vue";
import MediaLightbox from "../media/MediaLightbox.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
});
defineEmits(["remove"]);

const viewerOpen = ref(false);
const viewerIndex = ref(0);

function fmtSize(v){
  const n=Number(v||0);
  if (!n) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024*1024) return `${Math.round(n/102.4)/10}KB`;
  return `${Math.round(n/1024/102.4)/10}MB`;
}
function detectKind(item){
  const explicit = String(item?.kind || item?.mediaType || "").toLowerCase();
  if (explicit === "image" || explicit === "video" || explicit === "file") return explicit;
  const type = String(item?.type || item?.contentType || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  const url = String(item?.url || item?.previewUrl || item?.thumbnailUrl || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(url)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/.test(url)) return "video";
  return "file";
}
function thumbSrc(item){
  const kind = detectKind(item);
  if (kind === "image") return item?.previewUrl || item?.url || item?.thumbnailUrl || "";
  if (kind === "video") return item?.thumbnailUrl || item?.previewUrl || "";
  return "";
}
function mainSrc(item){
  return item?.previewUrl || item?.url || item?.thumbnailUrl || "";
}
function openViewer(item){
  const kind = detectKind(item);
  if (kind === "file") {
    const url = mainSrc(item);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const src = mainSrc(item);
  if (!src) return;
  const matchIndex = normalizedViewerItems.value.findIndex((x) => x.url === src || x.src === src);
  viewerIndex.value = matchIndex >= 0 ? matchIndex : 0;
  viewerOpen.value = true;
}
function closeViewer(){
  viewerOpen.value = false;
}

const normalizedItems = computed(() =>
  (props.items || []).map((item, idx) => ({
    raw: item,
    idx,
    kind: detectKind(item),
    thumb: thumbSrc(item),
    src: mainSrc(item),
    name: item?.name || item?.originalFilename || '첨부파일',
    sub: fmtSize(item?.size) || item?.contentType || '',
  }))
);

const normalizedViewerItems = computed(() =>
  normalizedItems.value
    .filter((item) => item.kind !== 'file' && item.src)
    .map((item) => ({
      kind: item.kind,
      url: item.src,
      thumbnailUrl: item.thumb || item.src,
      name: item.name,
    }))
);
</script>

<template>
  <div class="previewList">
    <article v-for="item in normalizedItems" :key="item.src || item.name || item.idx" class="previewCard">
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
        <button v-if="removable" class="removeBtn" type="button" @click="$emit('remove', item.idx)">제거</button>
      </div>
    </article>
  </div>

  <MediaLightbox
    v-if="viewerOpen && normalizedViewerItems.length"
    :items="normalizedViewerItems"
    :start-index="viewerIndex"
    @close="closeViewer"
  />
</template>

<style scoped>
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
