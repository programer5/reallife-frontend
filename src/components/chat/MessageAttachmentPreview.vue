
<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
});
defineEmits(["remove"]);
function fmtSize(v){
  const n=Number(v||0);
  if (!n) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024*1024) return `${Math.round(n/102.4)/10}KB`;
  return `${Math.round(n/1024/102.4)/10}MB`;
}
</script>

<template>
  <div class="previewList">
    <article v-for="(item, idx) in items" :key="item.previewUrl || item.url || item.name || idx" class="previewCard">
      <div class="thumb" :data-kind="item.kind || 'file'">
        <img v-if="(item.kind==='image' || item.kind==='video') && (item.previewUrl || item.url)" :src="item.previewUrl || item.url" alt="" />
        <span v-else>FILE</span>
      </div>
      <div class="meta">
        <div class="name">{{ item.name || item.originalFilename || '첨부파일' }}</div>
        <div class="sub">{{ fmtSize(item.size) || item.contentType || '' }}</div>
      </div>
      <button v-if="removable" class="removeBtn" type="button" @click="$emit('remove', idx)">제거</button>
    </article>
  </div>
</template>

<style scoped>
.previewList{display:grid;gap:8px}
.previewCard{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.thumb{width:48px;height:48px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;background:rgba(255,255,255,.04);font-size:10px;font-weight:900}
.thumb img{width:100%;height:100%;object-fit:cover}
.meta{min-width:0}
.name{font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sub{margin-top:4px;font-size:11px;color:rgba(255,255,255,.62)}
.removeBtn{height:34px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-weight:900}
</style>
