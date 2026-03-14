
<template>
  <article class="cardItem">
    <div class="rowTop">
      <div class="title">{{ title }}</div>
      <div v-if="badge" class="badge">{{ badge }}</div>
    </div>
    <div v-if="meta" class="meta">{{ meta }}</div>
    <div v-if="sub" class="sub">{{ sub }}</div>
    <button v-if="actionLabel" class="detailBtn" @click="$emit('open')">{{ actionLabel }}</button>
  </article>
</template>

<script setup>
defineProps({
  title: { type: String, default: "제목 없음" },
  meta: { type: String, default: "" },
  sub: { type: String, default: "" },
  badge: { type: String, default: "" },
  actionLabel: { type: String, default: "상세 보기" },
});
defineEmits(["open"]);
</script>

<style scoped>
.cardItem{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:grid;gap:8px}.rowTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.title{font-size:14px;font-weight:950;line-height:1.35}.badge{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);font-size:11px;font-weight:900;white-space:nowrap}.meta{font-size:12px;color:rgba(255,255,255,.72)}.sub{font-size:12px;color:rgba(255,255,255,.62);line-height:1.5}.detailBtn{justify-self:flex-start;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(84,126,255,.16);color:#fff;font-weight:900}
</style>
