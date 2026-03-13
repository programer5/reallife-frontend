
<!-- src/components/chat/MessageAttachmentPreview.vue -->
<script setup>
defineProps({ items: { type: Array, default: () => [] }, removable: { type: Boolean, default: false } });
const emit = defineEmits(["remove"]);
function itemKey(item, idx) { return item?.attachmentId || item?.id || item?.fileId || item?.url || `${idx}`; }
function kindOf(item) { const type = String(item?.type || item?.contentType || "").toLowerCase(); if (item?.kind) return item.kind; if (type.startsWith("image/")) return "image"; if (type.startsWith("video/")) return "video"; return "file"; }
function urlOf(item) { return item?.previewUrl || item?.thumbnailUrl || item?.url || ""; }
function nameOf(item) { return item?.name || item?.originalFilename || "첨부파일"; }
</script>
<template>
  <div class="list">
    <article v-for="(item, idx) in items" :key="itemKey(item, idx)" class="card">
      <div v-if="kindOf(item)==='image' && urlOf(item)" class="thumbWrap"><img :src="urlOf(item)" class="thumb" alt="" /></div>
      <div v-else-if="kindOf(item)==='video' && urlOf(item)" class="thumbWrap"><video class="thumb" :src="urlOf(item)" muted playsinline preload="metadata" /></div>
      <div v-else class="fileIcon">📎</div>
      <div class="meta"><div class="name">{{ nameOf(item) }}</div><div class="sub">{{ kindOf(item)==='video' ? '비디오' : kindOf(item)==='image' ? '이미지' : '파일' }}</div></div>
      <button v-if="removable" class="remove" type="button" @click="emit('remove', idx)">×</button>
      <a v-else-if="item?.url" class="open" :href="item.url" target="_blank" rel="noreferrer">열기</a>
    </article>
  </div>
</template>
<style scoped>
.list{display:grid;gap:8px}.card{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;border:1px solid color-mix(in oklab,var(--border) 84%, transparent);background:color-mix(in oklab,var(--surface) 84%, transparent)}.thumbWrap{width:44px;height:44px;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.06)}.thumb{width:100%;height:100%;object-fit:cover;display:block}.fileIcon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:color-mix(in oklab,var(--accent) 12%, transparent);font-size:20px}.meta{min-width:0}.name{font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:var(--muted)}.remove,.open{width:28px;height:28px;border-radius:999px;border:none;display:grid;place-items:center;background:rgba(255,255,255,.08);color:var(--text);text-decoration:none}
</style>
