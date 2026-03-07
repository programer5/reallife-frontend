<!-- src/components/media/Lightbox.vue -->
<script setup>
import { Teleport, computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  images: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
});
const emit = defineEmits(["close"]);

const safeLen = computed(() => Math.max(1, props.images?.length || 1));
const idx = ref(Math.max(0, Math.min(props.startIndex || 0, safeLen.value - 1)));
watch(() => props.startIndex, (v) => {
  idx.value = Math.max(0, Math.min(v || 0, safeLen.value - 1));
});
watch(() => props.images, () => {
  idx.value = Math.max(0, Math.min(idx.value, safeLen.value - 1));
});

function close() { emit('close'); }
function prev() { idx.value = (idx.value - 1 + safeLen.value) % safeLen.value; }
function next() { idx.value = (idx.value + 1) % safeLen.value; }
function onKey(e) {
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
}
let startX = 0; let startY = 0; let dragging = false;
function onPointerDown(e){ dragging = true; startX = e.clientX; startY = e.clientY; }
function onPointerUp(e){
  if (!dragging) return;
  dragging = false;
  const dx = e.clientX - startX; const dy = e.clientY - startY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) dx > 0 ? prev() : next();
}
onMounted(() => { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; });
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; });
</script>

<template>
  <Teleport to="body">
    <div class="overlay" role="dialog" aria-modal="true" @click.self="close">
      <div class="topbar">
        <div class="count">{{ idx + 1 }} / {{ images.length }}</div>
        <button class="btn" type="button" @click="close">닫기</button>
      </div>

      <div class="stage" @pointerdown="onPointerDown" @pointerup="onPointerUp">
        <button v-if="images.length > 1" class="nav left" type="button" @click.stop="prev" aria-label="이전">‹</button>
        <img class="img" :src="images[idx]" alt="image" draggable="false" />
        <button v-if="images.length > 1" class="nav right" type="button" @click.stop="next" aria-label="다음">›</button>
      </div>

      <div class="hint">마우스 휠 · ←/→ · ESC</div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(2,4,10,.88);
  backdrop-filter: blur(12px);
  display:grid;
  grid-template-rows: auto 1fr auto;
}
.topbar{
  display:flex;
  justify-content: space-between;
  align-items:center;
  padding: 14px 18px;
}
.count{ font-size: 12px; font-weight: 900; color: rgba(255,255,255,.82); }
.btn{
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.94);
  font-weight: 900;
  cursor:pointer;
}
.stage{
  position: relative;
  display:grid;
  place-items:center;
  padding: 20px;
  touch-action: pan-y;
}
.img{
  max-width: min(1120px, 92vw);
  max-height: 80vh;
  object-fit: contain;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
}
.nav{
  position:absolute;
  top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.94);
  font-size: 24px;
  font-weight: 900;
  cursor:pointer;
}
.left{ left: 16px; }
.right{ right: 16px; }
.hint{ padding: 10px 0 18px; text-align:center; font-size: 12px; color: rgba(255,255,255,.64); }
@media (max-width: 640px){ .stage{ padding: 14px; } .img{ max-width: 94vw; max-height: 72vh; } }
</style>
