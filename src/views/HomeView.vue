<!-- src/views/HomeView.vue (v3.1 Feed MVP: Infinite scroll + polish) -->
<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from "vue";
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
const viewMode = ref("FOLLOWING"); // UI only in v3.1

// infinite scroll
const sentinelRef = ref(null);
let io = null;

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
  } catch (e) {
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
  if (!id) return;
  if (likeBusy.value.has(id)) return;
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

function attachObserver() {
  if (io) io.disconnect();

  io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e?.isIntersecting) return;
      if (!hasNext.value) return;
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
    <div class="top">
      <div class="brand">
        <div class="title">RealLife</div>
        <div class="sub">Life Stream</div>
      </div>

      <div class="topActions">
        <RlButton size="sm" variant="soft" @click="loadFirst" :loading="loading">새로고침</RlButton>
        <RlButton size="sm" variant="primary" @click="openComposer">작성</RlButton>
      </div>
    </div>

    <div class="modes">
      <button class="pill" :class="{ on: viewMode==='FOLLOWING' }" type="button" @click="onSwitchMode('FOLLOWING')">
        팔로잉
      </button>
      <button class="pill" :class="{ on: viewMode==='FOR_YOU' }" type="button" @click="onSwitchMode('FOR_YOU')">
        추천
      </button>
      <button
        class="pill"
        :class="{ on: viewMode==='NEARBY' }"
        type="button"
        @click="toast.info?.('근처', 'v3.2에서 위치 권한과 함께 연결할게요.'); onSwitchMode('NEARBY')"
      >
        근처
      </button>

      <div class="spacer"></div>

      <button class="pill pill--ghost" type="button" @click="openComposer">
        + 오늘의 순간 공유하기
      </button>
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
      <FeedPostCard
        v-for="p in items"
        :key="p.postId"
        :post="p"
        @like="toggleLike"
      />

      <div ref="sentinelRef" class="sentinel">
        <div v-if="loadingMore" class="loadingMoreHint">불러오는 중…</div>
        <div v-else-if="!hasNext" class="endHint">끝까지 다 봤어요 👀</div>
      </div>
    </div>

    <PostComposer v-if="composerOpen" @close="composerOpen=false" @created="onCreated" />
  </div>
</template>

<style scoped>
.page{
  padding: 18px 16px calc(110px + env(safe-area-inset-bottom));
  max-width: 820px;
  margin: 0 auto;
}

.page::after{
  content:"";
  position: fixed;
  left: 0; right: 0;
  bottom: calc(60px + env(safe-area-inset-bottom));
  height: 160px;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.55));
  z-index: 9;
}

.top{
  position: sticky;
  top: 0;
  z-index: 20;
  display:flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0 12px;
  background: transparent;
  backdrop-filter: blur(10px);
}

.brand .title{
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.brand .sub{
  margin-top: 2px;
  font-size: 12px;
  opacity: .7;
}

.topActions{
  display:flex;
  gap: 8px;
  align-items:center;
}

.modes{
  margin-top: 10px;
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
}

.pill{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-weight: 800;
  font-size: 13px;
  cursor:pointer;
}

.pill.on{
  background: rgba(255,255,255,.14);
  border-color: rgba(255,255,255,.18);
}

.pill--ghost{
  background: transparent;
  opacity: .85;
}

.spacer{ flex: 1; }

.list{
  margin-top: 14px;
  display:flex;
  flex-direction: column;
  gap: 12px;
}

.sentinel{
  padding: 16px 0 6px;
  display:flex;
  justify-content:center;
}

.loadingMoreHint{
  opacity: .75;
  font-size: 12px;
}

.endHint{
  opacity: .65;
  font-size: 12px;
}

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
</style>
