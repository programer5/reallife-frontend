<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { normalizeMediaItems } from "@/lib/mediaModel";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

const props = defineProps({
  items: { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
});
const emit = defineEmits(["close"]);

const normalizedItems = computed(() => normalizeMediaItems(props.items).filter((item) => !!item.url && item.kind !== "file"));

const safeLen = computed(() => Math.max(1, normalizedItems.value.length || 1));
const idx = ref(0);

function clampIndex(v) {
  return Math.max(0, Math.min(Number(v || 0), safeLen.value - 1));
}

watch(
  () => props.startIndex,
  (v) => {
    idx.value = clampIndex(v);
  },
  { immediate: true }
);
watch(normalizedItems, () => {
  idx.value = clampIndex(idx.value);
});

const current = computed(() => normalizedItems.value[idx.value] || null);
const multiple = computed(() => normalizedItems.value.length > 1);

function close() {
  emit("close");
}
function prev() {
  if (!multiple.value) return;
  idx.value = (idx.value - 1 + safeLen.value) % safeLen.value;
}
function next() {
  if (!multiple.value) return;
  idx.value = (idx.value + 1) % safeLen.value;
}
function onKey(e) {
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowRight") next();
}
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
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) dx > 0 ? prev() : next();
}

const { setLocked: setBodyLocked } = useBodyScrollLock();

onMounted(() => {
  document.addEventListener("keydown", onKey);
  setBodyLocked(true);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  setBodyLocked(false);
});
</script>

<template>
  <Teleport to="body">
    <div class="overlay lightbox" role="dialog" aria-modal="true" @click.self="close">
      <div class="topbar">
        <div class="meta">
          <div class="count">{{ normalizedItems.length ? idx + 1 : 0 }} / {{ normalizedItems.length }}</div>
          <div v-if="current?.name" class="name">{{ current.name }}</div>
        </div>
        <div class="topActions">
          <a
            v-if="current?.url"
            class="btn btn--link"
            :href="current.downloadUrl || current.url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >다운로드</a>
          <button class="btn" type="button" @click="close">닫기</button>
        </div>
      </div>

      <div class="stage" @pointerdown="onPointerDown" @pointerup="onPointerUp">
        <button v-if="multiple" class="nav left" type="button" @click.stop="prev" aria-label="이전">‹</button>

        <img
          v-if="current?.kind === 'image'"
          class="media media--image"
          :src="current.url"
          :alt="current.name || 'image'"
          draggable="false"
        />

        <video
          v-else-if="current?.kind === 'video'"
          class="media media--video"
          :src="current.url"
          :poster="current.thumbnailUrl || ''"
          controls
          autoplay
          playsinline
          preload="metadata"
          @click.stop
        ></video>

        <button v-if="multiple" class="nav right" type="button" @click.stop="next" aria-label="다음">›</button>
      </div>

      <div v-if="multiple" class="thumbRail">
        <button
          v-for="(item, index) in normalizedItems"
          :key="item.url || index"
          class="thumb"
          :class="{ on: index === idx }"
          type="button"
          @click="idx = index"
        >
          <img v-if="item.kind === 'image'" :src="item.thumbnailUrl || item.url" alt="" />
          <div v-else class="thumbVideo">
            <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" alt="" />
            <div v-else class="thumbVideo__fallback">VIDEO</div>
            <span class="thumbVideo__play">▶</span>
          </div>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay{position:fixed;inset:0;z-index:var(--z-lightbox);background:rgba(2,4,10,.88);backdrop-filter:blur(12px);display:grid;grid-template-rows:auto 1fr auto}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px}
.meta{min-width:0;display:grid;gap:4px}
.count{font-size:12px;font-weight:900;color:rgba(255,255,255,.82)}
.name{font-size:13px;font-weight:800;color:rgba(255,255,255,.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.topActions{display:flex;align-items:center;gap:8px}
.btn{height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:rgba(255,255,255,.94);font-weight:900;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.stage{position:relative;display:grid;place-items:center;padding:20px;touch-action:pan-y}
.media{max-width:min(1120px,92vw);max-height:76vh;object-fit:contain;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
.media--video{width:min(1120px,92vw);background:#000}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:rgba(255,255,255,.94);font-size:24px;font-weight:900;cursor:pointer}
.left{left:16px}.right{right:16px}
.thumbRail{display:flex;gap:8px;align-items:center;justify-content:center;padding:8px 14px 18px;overflow:auto}
.thumb{width:58px;height:58px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);padding:0;cursor:pointer;flex:0 0 auto}
.thumb.on{outline:2px solid rgba(126,182,255,.8)}
.thumb img{width:100%;height:100%;display:block;object-fit:cover}
.thumbVideo{position:relative;width:100%;height:100%;display:grid;place-items:center;background:rgba(255,255,255,.05)}
.thumbVideo__fallback{font-size:10px;font-weight:900;color:rgba(255,255,255,.8)}
.thumbVideo__play{position:absolute;left:6px;bottom:6px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:900}
@media (max-width:640px){.topbar{padding:12px}.stage{padding:12px}.media{max-width:94vw;max-height:66vh;border-radius:18px}.media--video{width:94vw}.nav{width:40px;height:40px}.left{left:10px}.right{right:10px}.thumbRail{justify-content:flex-start;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}.name{max-width:44vw}}
</style>
