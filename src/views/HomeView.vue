<!-- src/views/HomeView.vue -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchFeed } from "../api/posts";
import { likePost, unlikePost } from "../api/likes";
import { useToastStore } from "../stores/toast";
import RlButton from "../components/ui/RlButton.vue";
import PostComposer from "../components/PostComposer.vue";
import FeedPostCard from "../components/feed/FeedPostCard.vue";

const toast = useToastStore();

const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const composerOpen = ref(false);
const viewMode = ref("FOLLOWING");
const sentinelRef = ref(null);
let io = null;

const modeMeta = computed(() => {
  if (viewMode.value === "FOLLOWING") return "연결된 사람들의 최근 순간";
  if (viewMode.value === "FOR_YOU") return "지금 반응 좋은 순간 추천";
  return "가까운 곳의 생활 흐름을 준비 중이에요";
});

async function loadFirst() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetchFeed({ size: 10 });
    items.value = res.items || [];
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    await nextTick();
    if (io && sentinelRef.value) io.observe(sentinelRef.value);
  } catch {
    error.value = "피드를 불러오지 못했습니다.";
    toast.error?.("피드 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  if (loading.value || loadingMore.value) return;

  loadingMore.value = true;
  try {
    const res = await fetchFeed({ size: 10, cursor: nextCursor.value });
    items.value.push(...(res.items || []));
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;
  } catch {
    toast.error?.("추가 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loadingMore.value = false;
  }
}

async function onCreated() {
  composerOpen.value = false;
  await loadFirst();
}

const likeBusy = ref(new Set());

async function toggleLike(p) {
  const id = p?.postId;
  if (!id || likeBusy.value.has(id)) return;
  likeBusy.value.add(id);

  const prevLiked = !!p.likedByMe;
  const prevCount = Number(p.likeCount ?? 0);

  p.likedByMe = !prevLiked;
  p.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

  try {
    if (!prevLiked) await likePost(id);
    else await unlikePost(id);
  } catch {
    p.likedByMe = prevLiked;
    p.likeCount = prevCount;
    toast.error?.("좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeBusy.value.delete(id);
  }
}

function openComposer() {
  composerOpen.value = true;
}

function onSwitchMode(m) {
  viewMode.value = m;
  loadFirst();
}

function onNearbyClick() {
  toast.info?.("근처", "v3.2에서 위치 권한과 함께 연결할게요.");
  onSwitchMode("NEARBY");
}

function attachObserver() {
  if (io) io.disconnect();

  io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e?.isIntersecting || !hasNext.value) return;
      loadMore();
    },
    { root: null, threshold: 0.01, rootMargin: "800px 0px" }
  );

  if (sentinelRef.value) io.observe(sentinelRef.value);
}

onMounted(async () => {
  attachObserver();
  await loadFirst();
});

onBeforeUnmount(() => {
  if (io) io.disconnect();
  io = null;
});
</script>

<template>
  <div class="page">
    <div class="toolbarCard">
      <div class="toolbarTop">
        <div class="brandBlock">
          <div class="brandTitle">RealLife</div>
          <div class="brandSub">Life Stream</div>
        </div>

        <div class="actionCluster">
          <RlButton class="toolbarBtn" size="sm" variant="soft" @click="loadFirst" :loading="loading">새로고침</RlButton>
          <RlButton class="toolbarBtn toolbarBtn--primary" size="sm" variant="primary" @click="openComposer">작성</RlButton>
        </div>
      </div>

      <div class="toolbarBottom">
        <div class="modeRailWrap">
          <div class="modeRail" role="tablist" aria-label="피드 필터">
            <button class="modePill" :class="{ on: viewMode === 'FOLLOWING' }" type="button" @click="onSwitchMode('FOLLOWING')">팔로잉</button>
            <button class="modePill" :class="{ on: viewMode === 'FOR_YOU' }" type="button" @click="onSwitchMode('FOR_YOU')">추천</button>
            <button class="modePill" :class="{ on: viewMode === 'NEARBY' }" type="button" @click="onNearbyClick">근처</button>
          </div>
          <div class="modeMeta">{{ modeMeta }}</div>
        </div>

        <button class="composerShortcut" type="button" @click="openComposer">
          <span class="composerShortcut__plus">+</span>
          <span>오늘의 순간 공유하기</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="list">
      <div v-for="i in 4" :key="i" class="skeleton-card">
        <div class="sk-line sk-title"></div>
        <div class="sk-line"></div>
        <div class="sk-line short"></div>
      </div>
    </div>

    <div v-else-if="error" class="state">
      <div class="state-title">오류 발생</div>
      <div class="state-sub">{{ error }}</div>
      <RlButton @click="loadFirst">다시 시도</RlButton>
    </div>

    <div v-else-if="items.length === 0" class="state">
      <div class="state-title">아직 피드가 비어 있어요</div>
      <div class="state-sub">첫 순간을 공유해보세요 ✨</div>
      <RlButton variant="primary" @click="openComposer">게시글 작성</RlButton>
    </div>

    <div v-else class="list">
      <FeedPostCard v-for="p in items" :key="p.postId" :post="p" @like="toggleLike" />

      <div ref="sentinelRef" class="sentinel">
        <div v-if="loadingMore" class="loadingMoreHint">불러오는 중…</div>
        <div v-else-if="!hasNext" class="endHint">끝까지 다 봤어요 👀</div>
      </div>
    </div>

    <PostComposer v-if="composerOpen" @close="composerOpen = false" @created="onCreated" />
  </div>
</template>

<style scoped>
.page{
  padding: 18px 16px calc(112px + env(safe-area-inset-bottom));
  max-width: 840px;
  margin: 0 auto;
}

.page::after{
  content:"";
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(60px + env(safe-area-inset-bottom));
  height: 160px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.55));
  z-index: 9;
}

.toolbarCard{
  position: sticky;
  top: 0;
  z-index: 20;
  margin-bottom: 16px;
  padding: 14px 0 14px;
  background:
    linear-gradient(180deg, rgba(4, 8, 22, .90), rgba(4, 8, 22, .62) 78%, rgba(4, 8, 22, 0));
  backdrop-filter: blur(12px);
}

.toolbarTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
}

.brandBlock{min-width:0}
.brandTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.brandSub{
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255,255,255,.68);
}

.actionCluster{
  display:flex;
  align-items:center;
  gap:8px;
  flex-shrink:0;
}

.toolbarBtn{
  min-width: 0;
}

.toolbarBottom{
  margin-top: 14px;
  display:grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items:end;
}

.modeRailWrap{
  min-width: 0;
  display:grid;
  gap:8px;
}

.modeRail{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}

.modePill{
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.92);
  font-weight: 800;
  font-size: 13px;
  cursor:pointer;
  transition: transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.modePill:hover{
  transform: translateY(-1px);
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.16);
}

.modePill.on{
  background: color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.08));
  border-color: color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.16));
  box-shadow: 0 8px 24px rgba(27, 44, 95, .20);
}

.modeMeta{
  min-height: 18px;
  font-size: 12px;
  color: rgba(255,255,255,.62);
  padding-left: 2px;
}

.composerShortcut{
  height: 40px;
  padding: 0 15px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(8, 14, 34, .42);
  color: rgba(255,255,255,.90);
  font-weight: 800;
  font-size: 13px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: transform .18s ease, border-color .18s ease, background .18s ease;
}

.composerShortcut:hover{
  transform: translateY(-1px);
  border-color: rgba(255,255,255,.14);
  background: rgba(10, 18, 44, .52);
}

.composerShortcut__plus{
  display:inline-flex;
  width:16px;
  justify-content:center;
  opacity:.82;
  font-weight:900;
}

.list{
  display:flex;
  flex-direction: column;
  gap: 12px;
}

.sentinel{
  padding: 16px 0 6px;
  display:flex;
  justify-content:center;
}

.loadingMoreHint,
.endHint{
  font-size: 12px;
}

.loadingMoreHint{ opacity: .75; }
.endHint{ opacity: .65; }

.state{
  margin-top: 24px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  border-radius: 18px;
  padding: 16px;
  text-align: center;
}

.state-title{
  font-weight: 900;
  font-size: 14px;
}

.state-sub{
  margin-top: 6px;
  opacity: .75;
  font-size: 13px;
  margin-bottom: 12px;
}

.skeleton-card{
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  border-radius: 18px;
  padding: 14px;
}

.sk-line{
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  margin-top: 10px;
}

.sk-title{ height: 14px; width: 55%; margin-top: 0; }
.short{ width: 72%; }

@media (max-width: 720px){
  .page{
    padding: 14px 12px calc(106px + env(safe-area-inset-bottom));
  }

  .toolbarCard{
    padding: 10px 0 12px;
    margin-bottom: 14px;
  }

  .toolbarTop{
    align-items:center;
    gap:10px;
  }

  .brandTitle{
    font-size: 20px;
  }

  .actionCluster{
    gap:6px;
  }

  .toolbarBottom{
    grid-template-columns:1fr;
    gap:12px;
    align-items:stretch;
  }

  .modeRailWrap{
    gap:7px;
  }

  .modeRail{
    gap:7px;
  }

  .modePill{
    min-height: 34px;
    padding: 0 13px;
    font-size: 12px;
  }

  .composerShortcut{
    width: 100%;
    justify-content: center;
    height: 42px;
  }
}

@media (max-width: 480px){
  .page{
    padding: 12px 10px calc(100px + env(safe-area-inset-bottom));
  }

  .toolbarTop{
    align-items:flex-start;
    gap:8px;
  }

  .actionCluster{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:6px;
  }

  .modeRail{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap:7px;
  }

  .modePill{
    width:100%;
    justify-content:center;
    padding: 0 10px;
  }

  .modeMeta{
    font-size: 11.5px;
  }

  .composerShortcut{
    font-size: 12px;
    gap: 6px;
  }
}

@media (max-width: 360px){
  .page{
    padding: 10px 8px calc(96px + env(safe-area-inset-bottom));
  }

  .toolbarCard{
    margin-bottom: 12px;
  }

  .brandTitle{
    font-size: 18px;
  }

  .brandSub,
  .modeMeta{
    font-size: 11px;
  }

  .actionCluster{
    width: 100%;
  }

  .toolbarTop{
    display:grid;
    grid-template-columns:1fr;
  }
}
</style>
