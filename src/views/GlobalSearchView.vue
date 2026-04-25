<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";
import { searchUsers, followUser, unfollowUser } from "@/api/users";
import { createDirectConversation } from "@/api/conversations";
import { fetchFeed } from "@/api/posts";

const router = useRouter();
const auth = useAuthStore();

const q = ref("");
const activeTab = ref("top");
const loadingUsers = ref(false);
const loadingExplore = ref(false);
const error = ref("");
const users = ref([]);
const nextCursor = ref(null);
const hasNextUsers = ref(false);
const exploreItems = ref([]);
const recentTerms = ref([]);
const brokenMediaKeys = ref(new Set());
let debounceTimer = null;

const tabs = [
  { key: "top", label: "전체", icon: "⌁" },
  { key: "people", label: "계정", icon: "◎" },
  { key: "posts", label: "게시글", icon: "▦" },
  { key: "videos", label: "영상", icon: "▶" },
];

const quickTerms = ["약속", "카페", "주말", "운동", "영화", "여행"];

const hasQuery = computed(() => !!q.value.trim());
const isLoading = computed(() => loadingUsers.value || loadingExplore.value);

const normalizedPosts = computed(() =>
  (exploreItems.value || []).map((post, idx) => ({
    ...post,
    _key: post?.postId || post?.id || `post-${idx}`,
    _media: normalizeMedia(post),
    _authorName: post?.authorName || post?.userName || post?.writerName || "User",
    _authorHandle: post?.authorHandle || post?.authorUsername || post?.handle || "user",
    _content: String(post?.content || post?.text || "").trim(),
  }))
);

const mediaPosts = computed(() =>
  normalizedPosts.value.filter((post) => post._media.length || post._content)
);

const videoPosts = computed(() =>
  normalizedPosts.value.filter((post) => post._media.some((m) => m.kind === "video"))
);

const filteredPosts = computed(() => {
  const query = q.value.trim().toLowerCase();
  let base = activeTab.value === "videos" ? videoPosts.value : mediaPosts.value;
  if (!query) return base;
  return base.filter((post) => {
    const haystack = [post._content, post._authorName, post._authorHandle]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

const visibleExplorePosts = computed(() => filteredPosts.value.slice(0, hasQuery.value ? 24 : 18));

const peopleSuggestions = computed(() => {
  const map = new Map();
  normalizedPosts.value.forEach((post) => {
    const handle = post._authorHandle;
    if (!handle || map.has(handle)) return;
    map.set(handle, {
      userId: post.authorId || post.userId || post.memberId || null,
      name: post._authorName,
      handle,
      followerCount: post.followerCount ?? post.authorFollowerCount ?? 0,
      isFollowing: !!post.isFollowingAuthor,
    });
  });
  return Array.from(map.values()).slice(0, 8);
});

const visiblePeople = computed(() => {
  if (hasQuery.value) return users.value;
  return peopleSuggestions.value;
});

const showPeople = computed(() => activeTab.value === "top" || activeTab.value === "people");
const showPosts = computed(() => activeTab.value === "top" || activeTab.value === "posts" || activeTab.value === "videos");

function normalizeMedia(post) {
  const raw = [];
  const pushArray = (items) => {
    if (Array.isArray(items)) raw.push(...items);
  };

  pushArray(post?.mediaItems);
  pushArray(post?.media);
  pushArray(post?.attachments);
  pushArray(post?.files);
  pushArray(post?.imageUrls?.map((url) => ({ mediaType: "IMAGE", url, thumbnailUrl: url })));
  pushArray(post?.images?.map((url) => ({ mediaType: "IMAGE", url, thumbnailUrl: url })));
  pushArray(post?.videoUrls?.map((url) => ({ mediaType: "VIDEO", url })));
  pushArray(post?.videos?.map((url) => ({ mediaType: "VIDEO", url })));

  return raw
    .map((item) => {
      const directUrl = typeof item === "string" ? item : item?.url || item?.imageUrl || item?.videoUrl || item?.fileUrl || item?.src;
      const thumb = typeof item === "string" ? null : item?.thumbnailUrl || item?.thumbUrl || item?.posterUrl || item?.videoThumbnailUrl || item?.previewUrl || item?.imageUrl;
      const type = String(item?.mediaType || item?.type || item?.mimeType || "").toUpperCase();
      const url = directUrl || thumb;
      if (!url) return null;
      const looksVideo = type.includes("VIDEO") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
      const looksImage = type.includes("IMAGE") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
      const kind = looksVideo && !looksImage ? "video" : "image";
      return {
        url,
        thumbnailUrl: thumb || (kind === "image" ? url : ""),
        kind,
      };
    })
    .filter(Boolean);
}

function primaryMedia(post) {
  const first = post?._media?.[0];
  if (!first || brokenMediaKeys.value.has(post?._key)) return null;
  return first;
}

function markMediaBroken(post) {
  if (!post?._key) return;
  const next = new Set(brokenMediaKeys.value);
  next.add(post._key);
  brokenMediaKeys.value = next;
}

function primeVideoPreview(event) {
  const video = event?.target;
  if (!video) return;
  try {
    video.muted = true;
    video.playsInline = true;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(0.2, video.duration / 4);
    }
  } catch {}
}

function pickInitial(u) {
  const raw = String((u?.name || u?.handle || "").trim());
  if (!raw) return "";
  const ch = raw[0];
  if (ch === "." || ch === "-" || ch === "_") return "";
  return ch.toUpperCase();
}

function saveRecent(term) {
  const clean = String(term || "").trim();
  if (!clean) return;
  const next = [clean, ...recentTerms.value.filter((v) => v !== clean)].slice(0, 8);
  recentTerms.value = next;
  localStorage.setItem("rl_recent_search_terms", JSON.stringify(next));
}

function loadRecentTerms() {
  try {
    const parsed = JSON.parse(localStorage.getItem("rl_recent_search_terms") || "[]");
    recentTerms.value = Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
  } catch {
    recentTerms.value = [];
  }
}

function resetUsers() {
  users.value = [];
  nextCursor.value = null;
  hasNextUsers.value = false;
}

async function loadExplore() {
  loadingExplore.value = true;
  try {
    const data = await fetchFeed({ size: 30 });
    exploreItems.value = data.items || [];
  } catch (e) {
    if (!hasQuery.value) error.value = e?.response?.data?.message || "탐색 피드를 불러오지 못했어요.";
  } finally {
    loadingExplore.value = false;
  }
}

async function runSearch({ reset = true } = {}) {
  const query = q.value.trim();
  if (!query) {
    resetUsers();
    error.value = "";
    return;
  }

  loadingUsers.value = true;
  error.value = "";

  try {
    const data = await searchUsers({
      q: query,
      cursor: !reset ? nextCursor.value : null,
      size: 20,
    });

    if (reset) users.value = data.items || [];
    else users.value = [...users.value, ...(data.items || [])];

    nextCursor.value = data.nextCursor ?? null;
    hasNextUsers.value = !!data.hasNext;
    saveRecent(query);
  } catch (e) {
    error.value = e?.response?.data?.message || "검색에 실패했어요.";
  } finally {
    loadingUsers.value = false;
  }
}

async function openDirectChat(user) {
  const targetUserId = user?.userId;
  if (!targetUserId) {
    if (user?.handle) router.push(`/u/${user.handle}`);
    return;
  }
  try {
    const res = await createDirectConversation(targetUserId);
    const conversationId = res?.conversationId;
    if (conversationId) {
      router.push(`/inbox/conversations/${conversationId}`);
      return;
    }
  } catch {}
  error.value = "대화를 열 수 없어요. 잠시 후 다시 시도해 주세요.";
}

function openProfile(user) {
  if (user?.handle) router.push(`/u/${user.handle}`);
}

function openPost(post) {
  const id = post?.postId || post?.id;
  if (id) router.push(`/posts/${id}`);
}

async function toggleFollow(user) {
  if (!user?.userId) {
    openProfile(user);
    return;
  }
  const prev = !!user.isFollowing;
  const prevCount = Number(user.followerCount ?? 0);
  user.isFollowing = !prev;
  user.followerCount = prev ? Math.max(0, prevCount - 1) : prevCount + 1;

  try {
    if (prev) await unfollowUser(user.userId);
    else await followUser(user.userId);
  } catch (e) {
    user.isFollowing = prev;
    user.followerCount = prevCount;
    error.value = e?.response?.data?.message || "팔로우 상태를 바꾸지 못했어요.";
  }
}

function clearSearch() {
  q.value = "";
  error.value = "";
  resetUsers();
}

function useTerm(term) {
  q.value = term;
  runSearch({ reset: true });
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch({ reset: true }), 280);
}

watch(q, () => onInput());

onMounted(async () => {
  loadRecentTerms();
  await auth.ensureSession();
  await loadExplore();
});

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
});
</script>

<template>
  <div class="rl-page searchPage">
    <section class="searchShell" aria-label="검색">
      <div class="searchTop">
        <form class="searchBar" @submit.prevent="runSearch({ reset: true })">
          <span class="searchIcon" aria-hidden="true">⌕</span>
          <input
            class="searchInput"
            v-model="q"
            placeholder="검색"
            autocomplete="off"
            inputmode="search"
          />
          <button v-if="q" class="clearBtn" type="button" aria-label="검색어 지우기" @click="clearSearch">✕</button>
        </form>

        <nav class="searchTabs" aria-label="검색 범위">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tabBtn"
            :class="{ active: activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            <span>{{ tab.icon }}</span>
            <b>{{ tab.label }}</b>
          </button>
        </nav>
      </div>

      <div v-if="error" class="stateCard stateError">{{ error }}</div>

      <section v-if="hasQuery" class="resultsLayout" aria-label="검색 결과">
        <section v-if="showPeople && visiblePeople.length" class="peopleRail" aria-label="계정">
          <div class="sectionHead">
            <strong>계정</strong>
            <button v-if="hasNextUsers" type="button" class="textBtn" @click="runSearch({ reset: false })">
              더 보기
            </button>
          </div>
          <div class="peopleScroller resultPeople">
            <article v-for="u in visiblePeople" :key="u.userId || u.handle" class="personCard compactPerson">
              <button class="personAvatar" type="button" @click="openProfile(u)" aria-label="프로필 열기">
                <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                <span v-else>◎</span>
              </button>
              <button class="personText" type="button" @click="openProfile(u)">
                <strong>{{ u.name || 'User' }}</strong>
                <small>@{{ u.handle || '-' }}</small>
              </button>
              <div class="personActions">
                <button class="miniBtn primary" type="button" @click="openDirectChat(u)">대화</button>
                <button class="miniBtn" type="button" @click="toggleFollow(u)">
                  {{ u.isFollowing ? '언팔' : '팔로우' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <div v-if="isLoading && !users.length && !filteredPosts.length" class="stateCard">검색 중…</div>

        <section v-if="showPosts" class="gridBlock" aria-label="관련 콘텐츠">
          <div class="sectionHead">
            <strong>관련 콘텐츠</strong>
          </div>
          <div v-if="visibleExplorePosts.length" class="exploreGrid">
            <button
              v-for="post in visibleExplorePosts"
              :key="post._key"
              class="mediaTile"
              :class="{ video: primaryMedia(post)?.kind === 'video', textOnly: !primaryMedia(post) }"
              type="button"
              @click="openPost(post)"
            >
              <video
                v-if="primaryMedia(post)?.kind === 'video'"
                class="tileMedia"
                :src="primaryMedia(post).url"
                :poster="primaryMedia(post).thumbnailUrl || undefined"
                muted
                playsinline
                preload="auto"
                @loadedmetadata="primeVideoPreview"
                @loadeddata="primeVideoPreview"
                @error="markMediaBroken(post)"
              ></video>
              <img
                v-else-if="primaryMedia(post)?.thumbnailUrl || primaryMedia(post)?.url"
                class="tileMedia"
                :src="primaryMedia(post).thumbnailUrl || primaryMedia(post).url"
                alt=""
                loading="lazy"
                @error="markMediaBroken(post)"
              />
              <div v-else class="textTile">
                <strong>{{ post._content || 'RealLife' }}</strong>
              </div>
              <span v-if="primaryMedia(post)?.kind === 'video'" class="tileBadge">▶</span>
              <span v-else-if="post._media.length > 1" class="tileBadge">▣</span>
              <span class="tileMeta">@{{ post._authorHandle }}</span>
            </button>
          </div>
          <div v-else-if="!isLoading" class="stateCard mutedState">관련 콘텐츠가 아직 없어요.</div>
        </section>
      </section>

      <section v-else class="discoverLayout" aria-label="탐색">
        <aside class="discoverSide">
          <section v-if="recentTerms.length" class="railBlock">
            <div class="sectionHead"><strong>최근 검색</strong></div>
            <div class="chipRail">
              <button v-for="term in recentTerms" :key="term" type="button" class="termChip" @click="useTerm(term)">
                {{ term }}
              </button>
            </div>
          </section>

          <section class="railBlock">
            <div class="sectionHead"><strong>추천 검색</strong></div>
            <div class="chipRail">
              <button v-for="term in quickTerms" :key="term" type="button" class="termChip" @click="useTerm(term)">
                # {{ term }}
              </button>
            </div>
          </section>

          <section v-if="visiblePeople.length" class="peopleRail" aria-label="추천 계정">
            <div class="sectionHead"><strong>추천 계정</strong></div>
            <div class="peopleScroller">
              <article v-for="u in visiblePeople" :key="u.userId || u.handle" class="personCard">
                <button class="personAvatar" type="button" @click="openProfile(u)" aria-label="프로필 열기">
                  <span v-if="pickInitial(u)">{{ pickInitial(u) }}</span>
                  <span v-else>◎</span>
                </button>
                <button class="personText" type="button" @click="openProfile(u)">
                  <strong>{{ u.name || 'User' }}</strong>
                  <small>@{{ u.handle || '-' }}</small>
                </button>
                <div class="personActions">
                  <button class="miniBtn primary" type="button" @click="openDirectChat(u)">대화</button>
                  <button class="miniBtn" type="button" @click="toggleFollow(u)">
                    {{ u.isFollowing ? '언팔' : '팔로우' }}
                  </button>
                </div>
              </article>
            </div>
          </section>
        </aside>

        <section class="gridBlock explorePanel" aria-label="탐색 피드">
          <div class="sectionHead exploreHead">
            <strong>Pulse Explore</strong>
            <small>지금 올라온 순간들</small>
          </div>
          <div v-if="visibleExplorePosts.length" class="exploreGrid pulseGrid">
            <button
              v-for="post in visibleExplorePosts"
              :key="post._key"
              class="mediaTile"
              :class="{ video: primaryMedia(post)?.kind === 'video', textOnly: !primaryMedia(post) }"
              type="button"
              @click="openPost(post)"
            >
              <video
                v-if="primaryMedia(post)?.kind === 'video'"
                class="tileMedia"
                :src="primaryMedia(post).url"
                :poster="primaryMedia(post).thumbnailUrl || undefined"
                muted
                playsinline
                preload="auto"
                @loadedmetadata="primeVideoPreview"
                @loadeddata="primeVideoPreview"
                @error="markMediaBroken(post)"
              ></video>
              <img
                v-else-if="primaryMedia(post)?.thumbnailUrl || primaryMedia(post)?.url"
                class="tileMedia"
                :src="primaryMedia(post).thumbnailUrl || primaryMedia(post).url"
                alt=""
                loading="lazy"
                @error="markMediaBroken(post)"
              />
              <div v-else class="textTile">
                <strong>{{ post._content || 'RealLife' }}</strong>
              </div>
              <span v-if="primaryMedia(post)?.kind === 'video'" class="tileBadge">▶</span>
              <span v-else-if="post._media.length > 1" class="tileBadge">▣</span>
              <span class="tileMeta">@{{ post._authorHandle }}</span>
            </button>
          </div>
          <div v-else-if="!isLoading" class="stateCard mutedState">탐색할 게시글이 아직 없어요.</div>
        </section>
      </section>
    </section>
  </div>
</template>

<style scoped>
.searchPage {
  min-height: calc(100dvh - var(--app-header-h, 68px) - var(--app-bottombar-h, 76px));
  padding: clamp(18px, 5vw, 56px) 16px calc(108px + var(--app-safe-bottom));
}

.searchShell {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.searchTop {
  display: grid;
  gap: 10px;
}

.searchBar {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 26px;
  border: 1px solid rgba(255,255,255,.11);
  background: rgba(14,18,28,.86);
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 60px rgba(0,0,0,.22);
}

.searchIcon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: rgba(255,255,255,.68);
  background: rgba(255,255,255,.06);
  font-weight: 950;
}

.searchInput {
  min-width: 0;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--text);
  padding: 0 2px;
  font-size: 18px;
  font-weight: 850;
  outline: none;
}

.searchInput::placeholder {
  color: rgba(255,255,255,.42);
}

.clearBtn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.72);
  cursor: pointer;
  font-weight: 950;
}

.searchTabs,
.chipRail,
.peopleScroller {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.searchTabs::-webkit-scrollbar,
.chipRail::-webkit-scrollbar,
.peopleScroller::-webkit-scrollbar {
  display: none;
}

.searchTabs {
  padding: 0 2px;
}

.tabBtn,
.termChip,
.textBtn,
.miniBtn {
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.045);
  color: var(--text);
  cursor: pointer;
}

.tabBtn {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 900;
  color: rgba(255,255,255,.68);
}

.tabBtn.active {
  color: #fff;
  background: color-mix(in oklab, var(--accent) 22%, rgba(255,255,255,.08));
  border-color: color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.16));
}

.discoverLayout {
  display: grid;
  grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
  gap: clamp(20px, 3vw, 38px);
  align-items: start;
}

.resultsLayout {
  display: grid;
  gap: 18px;
}

.discoverSide,
.railBlock,
.peopleRail,
.gridBlock {
  display: grid;
  gap: 12px;
}

.discoverSide {
  position: sticky;
  top: calc(var(--app-header-h, 68px) + 18px);
  align-self: start;
}

.sectionHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
}

.sectionHead strong {
  font-size: 14px;
  font-weight: 950;
}

.sectionHead small {
  color: var(--muted);
  font-size: 12px;
}

.termChip {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-weight: 850;
  color: rgba(255,255,255,.76);
}

.peopleScroller {
  flex-wrap: wrap;
  overflow: visible;
}

.personCard {
  flex: 0 0 142px;
  min-height: 168px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
  padding: 13px 11px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.09);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
}

.compactPerson {
  flex-basis: 140px;
  min-height: 158px;
}

.personAvatar {
  width: 64px;
  height: 64px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: radial-gradient(circle at 30% 15%, rgba(255,255,255,.26), transparent 30%), color-mix(in oklab, var(--accent) 34%, rgba(255,255,255,.06));
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 950;
  font-size: 20px;
  cursor: pointer;
}

.personText {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
  display: grid;
  gap: 2px;
  cursor: pointer;
}

.personText strong,
.personText small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.personText strong {
  font-size: 13px;
  font-weight: 950;
}

.personText small {
  color: var(--muted);
  font-size: 11px;
}

.personActions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.miniBtn {
  min-height: 30px;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
}

.miniBtn.primary {
  background: color-mix(in oklab, var(--accent) 24%, rgba(255,255,255,.08));
  border-color: color-mix(in oklab, var(--accent) 44%, rgba(255,255,255,.14));
}

.textBtn {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  color: rgba(255,255,255,.72);
  font-weight: 900;
}

.stateCard {
  min-height: 86px;
  display: grid;
  place-items: center;
  padding: 20px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.035);
}

.stateError {
  color: #ffb1b1;
  background: rgba(255,72,92,.08);
}

.explorePanel {
  min-width: 0;
}

.exploreHead {
  margin-bottom: 2px;
}

.exploreGrid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, 168px);
  gap: 10px;
  align-items: start;
  justify-content: start;
}

.mediaTile {
  position: relative;
  min-width: 0;
  aspect-ratio: 1 / 1;
  border: 0;
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 0%, rgba(255,255,255,.10), transparent 34%),
    rgba(255,255,255,.045);
  cursor: pointer;
  color: var(--text);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
}

.mediaTile.video,
.mediaTile.textOnly {
  aspect-ratio: 1 / 1;
}

.pulseGrid .mediaTile:nth-child(n) {
  grid-column: auto;
  grid-row: auto;
  aspect-ratio: 1 / 1;
}

.tileMedia {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  background: rgba(255,255,255,.04);
  transition: transform .22s ease;
}

video.tileMedia {
  background:
    radial-gradient(circle at 30% 15%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 32%),
    linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
}

.mediaTile:hover .tileMedia {
  transform: scale(1.035);
}

.textTile {
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 12px;
  text-align: left;
  background:
    radial-gradient(circle at 20% 5%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
}

.textTile strong {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.35;
}

.tileBadge,
.tileMeta {
  position: absolute;
  z-index: 2;
  border-radius: 999px;
  background: rgba(0,0,0,.42);
  backdrop-filter: blur(10px);
  color: #fff;
  font-weight: 950;
}

.tileBadge {
  top: 8px;
  right: 8px;
  min-width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  font-size: 12px;
}

.tileMeta {
  left: 8px;
  right: 8px;
  bottom: 8px;
  padding: 6px 8px;
  font-size: 11px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .discoverLayout {
    grid-template-columns: 1fr;
  }

  .discoverSide {
    position: static;
  }

  .peopleScroller {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .exploreGrid {
    grid-template-columns: repeat(auto-fill, 156px);
  }
}

@media (max-width: 860px) {
  .searchPage {
    padding: 10px 10px calc(96px + var(--app-safe-bottom));
  }

  .searchShell {
    gap: 12px;
  }

  .searchTop {
    gap: 8px;
  }

  .searchBar {
    border-radius: 20px;
    padding: 8px 10px;
  }

  .searchInput {
    height: 38px;
    font-size: 14px;
  }

  .searchIcon {
    width: 34px;
    height: 34px;
  }

  .searchTabs {
    padding-bottom: 2px;
  }

  .discoverLayout,
  .resultsLayout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .peopleScroller {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .personCard {
    flex-basis: 138px;
    min-height: 158px;
  }

  .exploreHead small {
    display: none;
  }

  .exploreGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .pulseGrid .mediaTile:nth-child(n) {
    grid-column: auto;
    grid-row: auto;
    aspect-ratio: 1 / 1;
  }

  .mediaTile,
  .mediaTile.video,
  .mediaTile.textOnly {
    aspect-ratio: 1 / 1;
    border-radius: 13px;
  }

  .tileMeta {
    left: 6px;
    right: 6px;
    bottom: 6px;
    padding: 5px 7px;
    font-size: 10px;
  }

  .tileBadge {
    top: 6px;
    right: 6px;
    min-width: 24px;
    height: 24px;
  }
}
</style>
