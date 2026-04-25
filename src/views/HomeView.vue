<!-- src/views/HomeView.vue -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import sse from "../lib/sse";
import { fetchFeed } from "../api/posts";
import { likePost, unlikePost } from "../api/likes";
import { useToastStore } from "../stores/toast";
import RlButton from "../components/ui/RlButton.vue";
import PostComposer from "../components/PostComposer.vue";
import FeedPostCard from "../components/feed/FeedPostCard.vue";
import AsyncStatePanel from "../components/ui/AsyncStatePanel.vue";

const toast = useToastStore();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const composerOpen = ref(false);
const composerDraft = ref(null);
const relayNotice = ref(null);
const viewMode = ref("FOLLOWING");
const sentinelRef = ref(null);
const newPostCount = ref(0);
const lastSyncedAt = ref(0);

let io = null;
let sseOff = null;
let focusReloadTimer = null;
let offVisibility = null;

const modeMeta = computed(() => {
  if (viewMode.value === "FOLLOWING") return "연결된 사람들의 최근 순간을 시간순으로 보여줘요.";
  if (viewMode.value === "FOR_YOU") return "댓글·좋아요 반응이 빠른 글을 앞쪽에 배치해 보여줘요.";
  return "근처 흐름은 준비 중이에요.";
});

const heroCopy = computed(() => {
  if (viewMode.value === "FOR_YOU") {
    return "반응이 빠른 순간부터 보고, 댓글에서 약속·할일·장소 액션으로 이어질 수 있는 흐름을 먼저 잡아보세요.";
  }
  return "오늘의 순간을 보고, 댓글에서 약속·할일·장소 액션으로 바로 이어가 보세요.";
});

const syncLabel = computed(() => {
  if (!lastSyncedAt.value) return "방금 동기화됨";
  const diffSec = Math.max(0, Math.floor((Date.now() - lastSyncedAt.value) / 1000));
  if (diffSec < 15) return "방금 동기화됨";
  if (diffSec < 60) return `${diffSec}초 전 동기화`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전 동기화`;
  return "조금 전 동기화";
});

function engagementScore(post) {
  const like = Number(post?.likeCount || 0);
  const comment = Number(post?.commentCount || 0);
  const hasActionShare = !!post?.sourceMeta || String(post?.content || "").includes("#RealLife");
  return like + comment * 2 + (hasActionShare ? 3 : 0);
}

const displayedItems = computed(() => {
  const arr = [...items.value];
  if (viewMode.value === "FOR_YOU") {
    return arr.sort((a, b) => {
      const scoreDiff = engagementScore(b) - engagementScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      const bt = Date.parse(b?.createdAt || b?.createdDateTime || 0) || 0;
      const at = Date.parse(a?.createdAt || a?.createdDateTime || 0) || 0;
      return bt - at;
    });
  }
  return arr;
});

const feedSummary = computed(() => {
  const list = displayedItems.value;
  return {
    total: list.length,
    liked: list.filter((p) => p?.likedByMe).length,
    commented: list.filter((p) => Number(p?.commentCount || 0) > 0).length,
    actionReady: list.filter((p) => Number(p?.commentCount || 0) > 0 || p?.sourceMeta || String(p?.content || "").includes("#RealLife")).length,
    sharedAction: list.filter((p) => p?.sourceMeta || String(p?.content || "").includes("#RealLife")).length,
    withImage: list.filter((p) => (Array.isArray(p?.imageUrls) && p.imageUrls.length > 0) || (Array.isArray(p?.images) && p.images.length > 0)).length,
  };
});

const topActionPost = computed(() => {
  const list = displayedItems.value
    .filter((p) => Number(p?.commentCount || 0) > 0 || p?.sourceMeta || String(p?.content || "").includes("#RealLife"))
    .sort((a, b) => engagementScore(b) - engagementScore(a));
  return list[0] || null;
});

const freshestPost = computed(() => {
  const list = [...displayedItems.value].sort((a, b) => {
    const bt = Date.parse(b?.createdAt || b?.createdDateTime || 0) || 0;
    const at = Date.parse(a?.createdAt || a?.createdDateTime || 0) || 0;
    return bt - at;
  });
  return list[0] || null;
});

const likedHotPost = computed(() => {
  const list = [...displayedItems.value].sort((a, b) => Number(b?.likeCount || 0) - Number(a?.likeCount || 0));
  return list[0] || null;
});

const homeFlowCards = computed(() => {
  const cards = [];
  if (topActionPost.value) {
    cards.push({
      key: `action-${topActionPost.value.postId}`,
      tone: "accent",
      eyebrow: "지금 먼저 볼 흐름",
      title: "액션 공유 글이 올라와 있어요",
      body: String(topActionPost.value.content || "공유된 액션에서 바로 대화와 행동으로 이어가 보세요."),
      meta: `댓글 ${Number(topActionPost.value.commentCount || 0)} · 좋아요 ${Number(topActionPost.value.likeCount || 0)}`,
      action: () => router.push(`/posts/${topActionPost.value.postId}`),
    });
  }
  if (freshestPost.value) {
    cards.push({
      key: `fresh-${freshestPost.value.postId}`,
      tone: "soft",
      eyebrow: "가장 최근 순간",
      title: "방금 올라온 흐름부터 보기",
      body: String(freshestPost.value.content || "새로 올라온 순간을 먼저 확인해 보세요."),
      meta: `${String(freshestPost.value.createdAt || freshestPost.value.createdDateTime || "")}`,
      action: () => router.push(`/posts/${freshestPost.value.postId}`),
    });
  }
  if (likedHotPost.value) {
    cards.push({
      key: `hot-${likedHotPost.value.postId}`,
      tone: "soft",
      eyebrow: "반응이 빠른 글",
      title: "지금 반응이 모이는 흐름",
      body: String(likedHotPost.value.content || "반응이 모이는 글에서 바로 대화로 이어가 보세요."),
      meta: `좋아요 ${Number(likedHotPost.value.likeCount || 0)} · 댓글 ${Number(likedHotPost.value.commentCount || 0)}`,
      action: () => router.push(`/posts/${likedHotPost.value.postId}`),
    });
  }
  return cards.slice(0, 3);
});

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

function normalizeFeedPayload(result) {
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    nextCursor: result?.nextCursor ?? null,
    hasNext: !!result?.hasNext,
  };
}

async function loadFirst({ silent = false } = {}) {
  if (!silent) loading.value = true;
  error.value = "";
  try {
    const result = normalizeFeedPayload(await fetchFeed({ size: 12 }));
    items.value = result.items;
    nextCursor.value = result.nextCursor;
    hasNext.value = result.hasNext;
    lastSyncedAt.value = Date.now();
    newPostCount.value = 0;
    await nextTick();
    attachObserver();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "피드를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value || !nextCursor.value) return;
  loadingMore.value = true;
  try {
    const result = normalizeFeedPayload(await fetchFeed({ size: 12, cursor: nextCursor.value }));
    const merged = [...items.value, ...result.items];
    const seen = new Set();
    items.value = merged.filter((it) => {
      const key = String(it?.postId || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    nextCursor.value = result.nextCursor;
    hasNext.value = result.hasNext;
    lastSyncedAt.value = Date.now();
  } catch {
    toast.error?.("추가 불러오기 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loadingMore.value = false;
  }
}

function openComposer() {
  composerOpen.value = true;
}

function buildRelayNotice(draft) {
  const sourceMeta = draft?.sourceMeta || {};
  return {
    source: sourceMeta?.sourceLabel || draft?.source || "대화",
    title: sourceMeta?.title || draft?.content || "새 액션",
  };
}

function consumeShareDraft({ silent = false } = {}) {
  let raw = null;
  try {
    raw = sessionStorage.getItem("reallife:feedShareDraft");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    composerDraft.value = parsed;
    relayNotice.value = buildRelayNotice(parsed);
    sessionStorage.removeItem("reallife:feedShareDraft");
    if (route.query.compose === "1") {
      composerOpen.value = true;
      router.replace({ query: { ...route.query, compose: undefined } });
    }
    if (!silent) {
      toast.success?.("공유 초안 불러옴", "방금 준비한 액션 공유 초안을 이어서 작성할 수 있어요.");
    }
    return true;
  } catch {
    if (raw) sessionStorage.removeItem("reallife:feedShareDraft");
    return false;
  }
}

function onCreated() {
  composerOpen.value = false;
  composerDraft.value = null;
  relayNotice.value = null;
  loadFirst({ silent: true });
}

function onSwitchMode(mode) {
  if (mode === viewMode.value) return;
  viewMode.value = mode;
}

function onNearbyClick() {
  toast.info?.("근처 흐름 준비 중", "근처 기반 흐름은 다음 단계에서 연결할 예정이에요.");
}

function reloadWithNewPosts() {
  loadFirst();
}

function bindFeedSse() {
  if (!sse?.onEvent) return;
  sseOff = sse.onEvent((evt) => {
    const type = String(evt?.type || "");
    const data = evt?.data || {};

    if (type === "post-created" || type === "feed-post-created") {
      newPostCount.value += 1;
      return;
    }

    if (type === "notification-created" && String(data?.kind || data?.subType || "").toUpperCase() === "POST_CREATED") {
      newPostCount.value += 1;
    }
  });
}

function bindVisibilitySoftSync() {
  const onFocus = () => {
    if (document.visibilityState === "hidden") return;
    if (focusReloadTimer) window.clearTimeout(focusReloadTimer);
    focusReloadTimer = window.setTimeout(() => {
      consumeShareDraft({ silent: true });
      if (!loading.value && !loadingMore.value) loadFirst({ silent: true });
    }, 250);
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    if (focusReloadTimer) window.clearTimeout(focusReloadTimer);
    focusReloadTimer = null;
  };
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

watch(() => route.query.compose, (value) => {
  if (value === "1") {
    consumeShareDraft({ silent: true });
    composerOpen.value = true;
  }
});

onMounted(async () => {
  attachObserver();
  bindFeedSse();
  offVisibility = bindVisibilitySoftSync();
  consumeShareDraft({ silent: true });
  await loadFirst();
});

onBeforeUnmount(() => {
  if (io) io.disconnect();
  io = null;
  if (sseOff) sseOff();
  sseOff = null;
  if (offVisibility) offVisibility();
  offVisibility = null;
});
</script>

<template>
  <div class="page">
    <div v-if="relayNotice" class="relayNotice cardSurface">🔔 {{ relayNotice.source || "대화" }}에서 이어진 액션이 피드에 반영됐어요 · {{ relayNotice.title || "새 액션" }}</div>

    <section class="homeControl cardSurface">
      <div class="modeRail" role="tablist" aria-label="피드 필터">
        <button class="modePill" :class="{ on: viewMode === 'FOLLOWING' }" type="button" @click="onSwitchMode('FOLLOWING')">팔로잉</button>
        <button class="modePill" :class="{ on: viewMode === 'FOR_YOU' }" type="button" @click="onSwitchMode('FOR_YOU')">추천</button>
        <button class="modePill modePill--muted" type="button" @click="onNearbyClick">근처</button>
      </div>
      <div class="homeControl__actions">
        <RlButton class="toolbarBtn" size="sm" variant="soft" @click="loadFirst" :loading="loading">↻</RlButton>
        <button class="composerShortcut composerShortcut--desktop" type="button" @click="openComposer">
          <span class="composerShortcut__plus">+</span>
          <span>공유</span>
        </button>
      </div>
    </section>



    <button v-if="newPostCount > 0" class="newPostBanner" type="button" @click="reloadWithNewPosts">새 글 {{ newPostCount }}개 · 지금 보기</button>

    <AsyncStatePanel
      v-if="loading"
      icon="⏳"
      title="새 순간을 불러오는 중이에요"
      description="방금 올라온 순간과 연결된 액션 흐름을 준비하고 있어요."
      tone="loading"
      :show-actions="false"
    >
      <div class="list list--loading stateSkeletonWrap">
        <div v-for="i in 4" :key="i" class="skeleton-card">
          <div class="sk-head"><div class="sk-avatar"></div><div class="sk-meta"><div class="sk-line sk-title"></div><div class="sk-line sk-sub"></div></div></div>
          <div class="sk-line"></div><div class="sk-line short"></div><div class="sk-media"></div>
        </div>
      </div>
    </AsyncStatePanel>

    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="피드를 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 불러오기"
      secondary-label="직접 작성하기"
      @primary="loadFirst"
      @secondary="openComposer"
    />

    <AsyncStatePanel
      v-else-if="displayedItems.length === 0"
      icon="✨"
      title="아직 피드가 비어 있어요"
      description="첫 순간을 공유하면 댓글과 액션 흐름이 여기서 시작돼요."
      primary-label="게시글 작성"
      secondary-label="새로고침"
      @primary="openComposer"
      @secondary="loadFirst"
    />

    <div v-else class="list">
      <div class="feedGrid">
        <FeedPostCard v-for="p in displayedItems" :key="p.postId" :post="p" @like="toggleLike" />
      </div>
      <div ref="sentinelRef" class="sentinel">
        <div v-if="loadingMore" class="loadingMoreHint">더 많은 순간을 불러오는 중…</div>
        <div v-else-if="!hasNext" class="endHint">끝까지 다 봤어요 👀</div>
      </div>
    </div>

    <PostComposer v-if="composerOpen" :initial-draft="composerDraft" @close="composerOpen = false" @created="onCreated" />
  </div>
</template>

<style scoped>
.page{padding:20px 20px calc(96px + env(safe-area-inset-bottom));max-width:1320px;margin:0 auto;display:grid;gap:14px}
.cardSurface{border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));box-shadow:0 18px 46px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)}
.relayNotice{padding:12px 16px;font-size:13px;font-weight:800;color:rgba(255,255,255,.92)}
.desktopHero{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:stretch;padding:18px 20px}
.heroCopyBlock{display:grid;gap:14px;align-content:center}.heroActionBlock{display:grid;gap:14px;align-content:start}
.heroEyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.58)}
.heroTitle{margin:0;font-size:32px;line-height:1.06;font-weight:950;letter-spacing:-.04em;max-width:16ch}
.heroBody{margin:0;font-size:14px;line-height:1.65;color:rgba(255,255,255,.74);max-width:60ch}
.heroGuideChips{display:flex;gap:8px;flex-wrap:wrap}.guideChip{height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:inline-flex;align-items:center;font-size:12px;font-weight:800;color:rgba(255,255,255,.86)}
.overviewTitle{font-size:13px;font-weight:900}.overviewSub{margin-top:4px;font-size:12px;color:rgba(255,255,255,.62)}.overviewStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.statPill{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:grid;gap:6px}.statValue{font-size:20px;font-weight:950}.statLabel{font-size:11px;color:rgba(255,255,255,.64)}.heroActions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.homeControl{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px}.homeControl__actions{display:flex;align-items:center;gap:8px;margin-left:auto}.homeControl .modeRail{flex:1;min-width:0}.homeControl .modePill{min-height:34px;padding:0 13px;font-size:12px}.homeControl .composerShortcut{height:36px;padding:0 13px;font-size:12px}
.desktopToolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 18px}.desktopToolbarHint{font-size:13px;color:rgba(255,255,255,.68);text-align:right;max-width:32ch;justify-self:end}
.mobileToolbar{display:none}.modeRailWrap{min-width:0;display:grid;gap:8px}.modeRail{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.modePill{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:rgba(255,255,255,.92);font-weight:800;font-size:13px;cursor:pointer;transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease}.modePill:hover{transform:translateY(-1px);background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16)}.modePill.on{background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.08));border-color:color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.16));box-shadow:0 8px 24px rgba(27,44,95,.2)}.modePill--muted{opacity:.78}.modeMeta{min-height:18px;font-size:12px;color:rgba(255,255,255,.62);padding-left:2px}
.composerShortcut{height:44px;padding:0 15px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(8,14,34,.42);color:rgba(255,255,255,.90);font-weight:800;font-size:13px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:transform .18s ease,border-color .18s ease,background .18s ease}.composerShortcut:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.14);background:rgba(10,18,44,.52)}.composerShortcut--desktop{justify-content:center}.composerShortcut__plus{display:inline-flex;width:16px;justify-content:center;opacity:.82;font-weight:900}
.flowInsightGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:stretch;isolation:isolate}.flowInsightCard{padding:16px 16px 14px;text-align:left;cursor:pointer;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:8px;min-height:182px;align-content:start;transition:transform .16s ease,border-color .18s ease,background .18s ease;overflow:hidden;position:relative}.flowInsightCard:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 34%,rgba(255,255,255,.14))}.flowInsightCard--accent{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,rgba(255,255,255,.04)),rgba(255,255,255,.02))}.flowInsightCard--soft{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))}.flowInsightCard__eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.62)}.flowInsightCard__title{font-size:18px;font-weight:950;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;overflow-wrap:anywhere}.flowInsightCard__body{font-size:13px;line-height:1.58;color:rgba(255,255,255,.74);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.58em * 3);word-break:break-word;overflow-wrap:anywhere}.flowInsightCard__meta{margin-top:auto;font-size:12px;color:rgba(255,255,255,.58);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.newPostBanner{position:sticky;top:88px;z-index:8;justify-self:center;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(9,16,38,.78);backdrop-filter:blur(12px);color:#fff;font-weight:900}
.list{display:grid;gap:14px}.feedTopSummary{padding:16px 18px;border-radius:24px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));display:grid;gap:10px}.feedTopSummary__title{font-size:18px;font-weight:950}.feedTopSummary__sub{font-size:13px;line-height:1.6;color:rgba(255,255,255,.68)}.feedFocusRow{display:flex;gap:10px;flex-wrap:wrap}.feedFocusPill{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:inline-flex;align-items:center;gap:8px}.feedFocusPill__label{font-size:12px;color:rgba(255,255,255,.66)}.feedFocusPill__value{font-size:13px;font-weight:900}
.feedGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.feedGrid > *{align-self:start}
.sentinel{display:grid;place-items:center;min-height:68px}.loadingMoreHint,.endHint{font-size:13px;color:rgba(255,255,255,.58)}
.stateSkeletonWrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.skeleton-card{padding:16px;border-radius:24px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);display:grid;gap:12px}.sk-head{display:flex;gap:10px;align-items:center}.sk-avatar{width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.08)}.sk-meta{display:grid;gap:6px;flex:1}.sk-line{height:12px;border-radius:999px;background:rgba(255,255,255,.08)}.sk-title{width:55%}.sk-sub{width:36%}.sk-media{height:180px;border-radius:18px;background:rgba(255,255,255,.08)}.short{width:60%}
@media (max-width:1180px){.feedGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.flowInsightGrid{grid-template-columns:1fr 1fr}.stateSkeletonWrap{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.page{padding:12px 12px calc(96px + env(safe-area-inset-bottom))}.homeControl{padding:10px;gap:8px;align-items:flex-start;flex-direction:column}.homeControl__actions{width:100%;margin-left:0}.homeControl__actions .toolbarBtn,.homeControl__actions .composerShortcut{flex:1;justify-content:center}.feedGrid{grid-template-columns:1fr}.flowInsightGrid{grid-template-columns:1fr}.stateSkeletonWrap{grid-template-columns:1fr}.newPostBanner{top:72px}}
</style>
