<!-- src/components/media/Lightbox.vue (v3.3: swipe slider + keyboard) -->
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  images: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
});
const emit = defineEmits(["close"]);

const idx = ref(Math.max(0, Math.min(props.startIndex || 0, (props.images?.length || 1) - 1)));

watch(() => props.startIndex, (v) => {
  idx.value = Math.max(0, Math.min(v || 0, (props.images?.length || 1) - 1));
});

function close() { emit("close"); }
function prev() { idx.value = (idx.value - 1 + props.images.length) % props.images.length; }
function next() { idx.value = (idx.value + 1) % props.images.length; }

function onKey(e) {
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowRight") next();
}

// swipe
let startX = 0;
let startY = 0;
let dragging = false;

function onPointerDown(e) {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
}
function onPointerUp(e) {
  if (!dragging) return;
  dragging = false;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) prev();
    else next();
  }
}

onMounted(() => document.addEventListener("keydown", onKey));
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" @click.self="close">
    <div class="topbar">
      <button class="btn" type="button" @click="close">닫기</button>
      <div class="count">{{ idx + 1 }} / {{ images.length }}</div>
      <div class="spacer"></div>
    </div>

    <div class="stage" @pointerdown="onPointerDown" @pointerup="onPointerUp">
      <button class="nav left" type="button" @click.stop="prev" aria-label="이전">‹</button>
      <img class="img" :src="images[idx]" alt="image" draggable="false" />
      <button class="nav right" type="button" @click.stop="next" aria-label="다음">›</button>
    </div>

    <div class="hint">스와이프/←→ · ESC로 닫기</div>
  </div>
</template>

<style scoped>
.overlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,.82);
  backdrop-filter: blur(8px);
  display:flex;
  flex-direction: column;
}
.topbar{
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
.btn{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor: pointer;
}
.count{ font-weight: 900; opacity: .85; }
.spacer{ flex: 1; }

.stage{
  flex: 1;
  display:flex;
  align-items:center;
  justify-content:center;
  position: relative;
  padding: 16px;
  touch-action: pan-y;
}
.img{
  max-width: min(980px, 92vw);
  max-height: 78vh;
  object-fit: contain;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
}
.nav{
  position:absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 24px;
  font-weight: 900;
  cursor:pointer;
}
.left{ left: 12px; }
.right{ right: 12px; }

.hint{
  padding: 10px 0 18px;
  text-align:center;
  font-size: 12px;
  opacity: .7;
}
</style>
