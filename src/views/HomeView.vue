<!-- src/views/HomeView.vue -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
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
const viewMode = ref("FOLLOWING");
const sentinelRef = ref(null);
const newPostCount = ref(0);
const lastSyncedAt = ref(0);
let io = null;
let sseOff = null;
let focusReloadTimer = null;

const modeMeta = computed(() => {
  if (viewMode.value === "FOLLOWING") return "연결된 사람들의 최근 순간";
  if (viewMode.value === "FOR_YOU") return "지금 반응 좋은 순간 추천";
  return "가까운 곳의 생활 흐름을 준비 중이에요";
});

const feedSummary = computed(() => ({
  total: items.value.length,
  liked: items.value.filter((p) => p?.likedByMe).length,
  commented: items.value.filter((p) => Number(p?.commentCount || 0) > 0).length,
}));

const syncLabel = computed(() => {
  if (!lastSyncedAt.value) return "방금 동기화됨";
  const diffSec = Math.max(0, Math.floor((Date.now() - lastSyncedAt.value) / 1000));
  if (diffSec < 15) return "방금 동기화됨";
  if (diffSec < 60) return `${diffSec}초 전 동기화`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전 동기화`;
  return "조금 전 동기화";
});

const heroCopy = computed(() => {
  if (viewMode.value === "FOR_YOU") return "사람 반응이 빠른 순간을 한눈에 모아봤어요.";
  if (viewMode.value === "NEARBY") return "근처 흐름은 준비 중이에요. 위치 기반 액션으로 곧 연결할게요.";
  return "댓글이 약속·할일·장소 액션으로 이어지는 흐름을 바로 살펴보세요.";
});

async function loadFirst(opts = {}) {
  const { silent = false } = opts;
  if (!silent) loading.value = true;
  error.value = "";
  try {
    const res = await fetchFeed({ size: 12 });
    items.value = res.items || [];
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;
    lastSyncedAt.value = Date.now();

    await nextTick();
    if (io && sentinelRef.value) io.observe(sentinelRef.value);
  } catch {
    error.value = "피드를 불러오지 못했습니다.";
    if (!silent) toast.error?.("피드 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    if (!silent) loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  if (loading.value || loadingMore.value) return;

  loadingMore.value = true;
  try {
    const res = await fetchFeed({ size: 12, cursor: nextCursor.value });
    items.value.push(...(res.items || []));
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;
    lastSyncedAt.value = Date.now();
  } catch {
    toast.error?.("추가 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loadingMore.value = false;
  }
}

function consumeShareDraft(opts = {}) {
  const { silent = false } = opts;
  try {
    const raw = sessionStorage.getItem("reallife:feedShareDraft");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    composerDraft.value = {
      content: String(parsed?.content || "").trim(),
      visibility: String(parsed?.visibility || "ALL").toUpperCase(),
      sourceMeta: parsed?.sourceMeta || parsed?.meta || null,
    };
    sessionStorage.removeItem("reallife:feedShareDraft");
    composerOpen.value = true;
    if (!silent) toast.success?.("공유 준비됨", "피드에 올릴 문장을 미리 채워뒀어요.");
    if (route.query?.compose === "1") {
      router.replace({ path: route.path, query: { ...route.query, compose: undefined } });
    }
    return true;
  } catch {
    sessionStorage.removeItem("reallife:feedShareDraft");
    return false;
  }
}

async function onCreated() {
  composerOpen.value = false;
  newPostCount.value = 0;
  await loadFirst();
}

async function reloadWithNewPosts() {
  newPostCount.value = 0;
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
  composerDraft.value = null;
  composerOpen.value = true;
}

function onSwitchMode(m) {
  viewMode.value = m;
  loadFirst();
}

function onNearbyClick() {
  toast.info?.("근처 · 준비중", "위치 기반 추천과 액션 연결은 다음 단계에서 열릴 예정이에요.");
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

let offVisibility = null;

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
    <section class="desktopHero cardSurface">
      <div class="heroCopyBlock">
        <div class="heroEyebrow">REALIFE WEB</div>
        <h1 class="heroTitle">게시글이 대화가 되고, 대화가 행동으로 이어지는 피드</h1>
        <p class="heroBody">{{ heroCopy }}</p>
      </div>
      <div class="heroActionBlock">
        <div class="overviewTitle">오늘 피드 흐름</div>
        <div class="overviewSub">{{ syncLabel }}</div>
        <div class="overviewStats">
          <div class="statPill">
            <span class="statValue">{{ feedSummary.total }}</span>
            <span class="statLabel">게시글</span>
          </div>
          <div class="statPill">
            <span class="statValue">{{ feedSummary.commented }}</span>
            <span class="statLabel">댓글 있는 글</span>
          </div>
          <div class="statPill">
            <span class="statValue">{{ newPostCount }}</span>
            <span class="statLabel">새 글 대기</span>
          </div>
        </div>
        <div class="heroActions">
          <RlButton class="toolbarBtn" size="sm" variant="soft" @click="loadFirst" :loading="loading">새로고침</RlButton>
          <RlButton class="toolbarBtn toolbarBtn--primary" size="sm" variant="primary" @click="openComposer">작성</RlButton>
          <button class="composerShortcut composerShortcut--desktop" type="button" @click="openComposer">
            <span class="composerShortcut__plus">+</span>
            <span>오늘의 순간 공유하기</span>
          </button>
        </div>
      </div>
    </section>

    <div class="desktopToolbar cardSurface">
      <div class="modeRailWrap">
        <div class="modeRail" role="tablist" aria-label="피드 필터">
          <button class="modePill" :class="{ on: viewMode === 'FOLLOWING' }" type="button" @click="onSwitchMode('FOLLOWING')">팔로잉</button>
          <button class="modePill" :class="{ on: viewMode === 'FOR_YOU' }" type="button" @click="onSwitchMode('FOR_YOU')">추천</button>
          <button class="modePill modePill--muted" type="button" @click="onNearbyClick">근처 · 준비중</button>
        </div>
        <div class="modeMeta">{{ modeMeta }}</div>
      </div>
      <div class="desktopToolbarHint">댓글이 약속·할일·장소 액션으로 이어지는 흐름을 한눈에 볼 수 있게 정리했어요.</div>
    </div>

    <div class="mobileToolbar">
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
            <button class="modePill modePill--muted" type="button" @click="onNearbyClick">근처 · 준비중</button>
          </div>
          <div class="modeMeta">{{ modeMeta }}</div>
        </div>
        <button class="composerShortcut" type="button" @click="openComposer">
          <span class="composerShortcut__plus">+</span>
          <span>오늘의 순간 공유하기</span>
        </button>
      </div>
    </div>

    <button v-if="newPostCount > 0" class="newPostBanner" type="button" @click="reloadWithNewPosts">
      새 글 {{ newPostCount }}개 · 지금 보기
    </button>

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
          <div class="sk-head">
            <div class="sk-avatar"></div>
            <div class="sk-meta">
              <div class="sk-line sk-title"></div>
              <div class="sk-line sk-sub"></div>
            </div>
          </div>
          <div class="sk-line"></div>
          <div class="sk-line short"></div>
          <div class="sk-media"></div>
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
      v-else-if="items.length === 0"
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
        <FeedPostCard v-for="p in items" :key="p.postId" :post="p" @like="toggleLike" />
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
.page{padding:24px 24px calc(96px + env(safe-area-inset-bottom));max-width:1640px;margin:0 auto;display:grid;gap:18px}
.cardSurface{border:1px solid rgba(255,255,255,.10);border-radius:24px;background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));box-shadow:0 18px 46px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)}
.desktopHero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(380px,.85fr);gap:18px;align-items:stretch;padding:22px}

.heroEyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.58)}
.heroTitle{margin:0;font-size:40px;line-height:1.03;font-weight:950;letter-spacing:-.05em;max-width:13ch}
.heroBody{margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,.74);max-width:56ch}
.heroActions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}


.overviewTitle{font-size:13px;font-weight:900}
.overviewSub{margin-top:4px;font-size:12px;color:rgba(255,255,255,.62)}
.heroCopyBlock{display:grid;gap:14px;align-content:center}.heroActionBlock{display:grid;gap:14px;align-content:start}.overviewStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.statPill{padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:grid;gap:6px}
.statValue{font-size:20px;font-weight:950}
.statLabel{font-size:11px;color:rgba(255,255,255,.64)}
.desktopToolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:16px 18px}
.desktopToolbarHint{font-size:13px;color:rgba(255,255,255,.68);text-align:right;max-width:42ch;justify-self:end}
.mobileToolbar{display:none}
.feedGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:start}
.feedGrid :deep(.card){height:auto}
.modeRailWrap{min-width:0;display:grid;gap:8px}
.modeRail{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.modePill{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:rgba(255,255,255,.92);font-weight:800;font-size:13px;cursor:pointer;transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease}
.modePill:hover{transform:translateY(-1px);background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16)}
.modePill.on{background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.08));border-color:color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.16));box-shadow:0 8px 24px rgba(27,44,95,.2)}
.modePill--muted{opacity:.78}
.modeMeta{min-height:18px;font-size:12px;color:rgba(255,255,255,.62);padding-left:2px}
.composerShortcut{height:44px;padding:0 15px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(8,14,34,.42);color:rgba(255,255,255,.90);font-weight:800;font-size:13px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:transform .18s ease,border-color .18s ease,background .18s ease}
.composerShortcut:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.14);background:rgba(10,18,44,.52)}
.composerShortcut--desktop{justify-content:center}
.composerShortcut__plus{display:inline-flex;width:16px;justify-content:center;opacity:.82;font-weight:900}
.list{display:flex;flex-direction:column;gap:12px}
.list--loading{gap:14px}
.newPostBanner{align-self:center;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid color-mix(in oklab,var(--accent) 40%, rgba(255,255,255,.14));background:color-mix(in oklab,var(--accent) 20%, rgba(255,255,255,.05));color:rgba(255,255,255,.96);font-weight:900;box-shadow:0 10px 30px rgba(25,48,110,.22)}
.sentinel{padding:18px 0 10px;display:flex;justify-content:center}.loadingMoreHint,.endHint{font-size:12px}.loadingMoreHint{opacity:.75}.endHint{opacity:.65}
.skeleton-card{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);border-radius:20px;padding:14px;overflow:hidden}.sk-head{display:flex;gap:10px;align-items:center}.sk-avatar{width:38px;height:38px;border-radius:14px;background:rgba(255,255,255,.08)}.sk-meta{flex:1}.sk-line{height:10px;border-radius:999px;background:linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.14), rgba(255,255,255,.08));background-size:180% 100%;animation:shimmer 1.2s linear infinite;margin-top:10px}.sk-title{height:14px;width:55%;margin-top:0}.sk-sub{width:32%}.short{width:72%}.sk-media{margin-top:12px;border-radius:16px;aspect-ratio:4 / 5;background:linear-gradient(90deg, rgba(255,255,255,.07), rgba(255,255,255,.12), rgba(255,255,255,.07));background-size:180% 100%;animation:shimmer 1.2s linear infinite}@keyframes shimmer{0%{background-position:180% 0}100%{background-position:-20% 0}}
@media (min-width:1500px){.feedGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:1460px){.feedGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:1180px){.feedGrid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr));justify-content:stretch}}
@media (max-width:1180px){.desktopHero,.desktopToolbar{display:none}.mobileToolbar{display:grid;gap:14px;position:sticky;top:0;z-index:20;padding:14px 0 12px;background:linear-gradient(180deg, rgba(4,8,22,.92), rgba(4,8,22,.68) 78%, rgba(4,8,22,0));backdrop-filter: blur(12px)}.toolbarTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.brandTitle{font-size:22px;font-weight:950;letter-spacing:-.02em;line-height:1.05}.brandSub{margin-top:4px;font-size:12px;color:rgba(255,255,255,.68)}.actionCluster{display:flex;align-items:center;gap:8px;flex-shrink:0}.toolbarBottom{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end}.page{padding-top:14px;max-width:960px}.feedGrid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr));justify-content:stretch}}
@media (max-width:860px){.page{padding:14px 12px calc(106px + env(safe-area-inset-bottom));max-width:840px}.feedGrid{grid-template-columns:1fr}.toolbarBottom{grid-template-columns:1fr;gap:12px;align-items:stretch}.composerShortcut{width:100%;justify-content:center;height:42px}}
@media (max-width:480px){.page{padding:12px 10px calc(100px + env(safe-area-inset-bottom))}.toolbarTop{align-items:flex-start;gap:8px}.actionCluster{display:grid;grid-template-columns:1fr 1fr;gap:6px}.modeRail{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.modePill{width:100%;justify-content:center;padding:0 10px}.modeMeta{font-size:11.5px}.brandTitle{font-size:20px}}
</style>
