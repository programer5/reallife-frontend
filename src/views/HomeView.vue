<!-- src/views/HomeView.vue -->
<script setup>
import { onMounted, ref } from "vue";
import { fetchFeed } from "../api/posts";
import { useToastStore } from "../stores/toast";
import RlButton from "../components/ui/RlButton.vue";
import PostComposer from "../components/PostComposer.vue";
import { likePost, unlikePost } from "../api/likes";

const toast = useToastStore();

const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");

const items = ref([]);
const nextCursor = ref(null);
const hasNext = ref(false);

const composerOpen = ref(false);

async function loadFirst() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetchFeed({ size: 10 });
    items.value = res.items;
    nextCursor.value = res.nextCursor;
    hasNext.value = res.hasNext;
  } catch (e) {
    error.value = "피드를 불러오지 못했습니다.";
    toast.error("피드 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  loadingMore.value = true;
  try {
    const res = await fetchFeed({ size: 10, cursor: nextCursor.value });
    items.value.push(...res.items);
    nextCursor.value = res.nextCursor;
    hasNext.value = res.hasNext;
  } catch {
    toast.error("추가 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loadingMore.value = false;
  }
}

/**
 * ✅ 중요: 작성 성공 후에는 생성 응답 형태가 제각각이므로
 * 피드를 다시 불러오는게 가장 안전하고, UX도 확실함.
 */
async function onCreated() {
  composerOpen.value = false;
  await loadFirst();
}

function fmtVisibility(v) {
  if (v === "FOLLOWERS") return "팔로워만";
  if (v === "PRIVATE") return "나만";
  return "전체 공개";
}

const likeBusy = ref(new Set()); // postId set

async function toggleLike(p) {
  const id = p.postId;
  if (!id) return;
  if (likeBusy.value.has(id)) return;

  likeBusy.value.add(id);

  // ✅ 낙관적 업데이트
  const prevLiked = !!p.likedByMe;
  const prevCount = Number(p.likeCount ?? 0);

  p.likedByMe = !prevLiked;
  p.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

  try {
    if (!prevLiked) {
      await likePost(id);
    } else {
      await unlikePost(id);
    }
  } catch (e) {
    // ❌ 실패 시 원복
    p.likedByMe = prevLiked;
    p.likeCount = prevCount;
    toast.error("좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeBusy.value.delete(id);
  }
}

onMounted(loadFirst);
</script>

<template>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">Home</div>
        <div class="sub">팔로잉 피드</div>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="soft" @click="loadFirst" :loading="loading">새로고침</RlButton>
        <RlButton size="sm" variant="primary" @click="composerOpen = true">작성</RlButton>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="list">
      <div v-for="i in 3" :key="i" class="skeleton-card">
        <div class="sk-line sk-title"></div>
        <div class="sk-line"></div>
        <div class="sk-line short"></div>
      </div>
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="state">
      <div class="state-title">오류 발생</div>
      <div class="state-sub">{{ error }}</div>
      <RlButton @click="loadFirst">다시 시도</RlButton>
    </div>

    <!-- 빈 상태 -->
    <div v-else-if="items.length === 0" class="state">
      <div class="state-title">피드가 비어 있어요</div>
      <div class="state-sub">첫 게시글을 작성해보세요 ✨</div>
      <RlButton variant="primary" @click="composerOpen = true">게시글 작성</RlButton>
    </div>

    <!-- 리스트 -->
    <div v-else class="list">
      <div v-for="p in items" :key="p.postId" class="card" @click="$router.push(`/posts/${p.postId}`)">
        <div class="card-head">
          <div class="avatar"></div>
          <div class="meta">
            <div class="author">{{ p.authorName || "User" }}</div>
            <div class="submeta">
              <span class="handle">@{{ p.authorHandle || "handle" }}</span>
              <span class="dot">·</span>
              <span class="vis">{{ fmtVisibility(p.visibility) }}</span>
            </div>
          </div>
          <div class="time">{{ p.createdAt || "" }}</div>
        </div>

        <div v-if="p.content" class="content">{{ p.content }}</div>

        <div v-if="p.imageUrls?.length" class="imgGrid">
          <div v-for="url in p.imageUrls" :key="url" class="imgCell">
            <img :src="url" alt="" />
          </div>
        </div>

        <div class="footer">
          <button
              class="pill btn"
              :class="{ on: p.likedByMe, busy: likeBusy.has(p.postId) }"
              type="button"
              @click.stop="toggleLike(p)"
              :disabled="likeBusy.has(p.postId)"
              aria-label="Toggle like"
          >
            <span class="heart">{{ p.likedByMe ? "❤️" : "🤍" }}</span>
            <span>{{ p.likeCount ?? 0 }}</span>
          </button>

          <span class="pill">💬 {{ p.commentCount ?? 0 }}</span>
        </div>
      </div>

      <div class="more">
        <RlButton v-if="hasNext" variant="soft" @click="loadMore" :loading="loadingMore">
          더 보기
        </RlButton>
        <div v-else class="end">끝 ✨</div>
      </div>
    </div>

    <PostComposer
        v-if="composerOpen"
        @close="composerOpen = false"
        @created="onCreated"
    />
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:720px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:10px}
.title{font-size:20px;font-weight:900}
.sub{font-size:13px;color:var(--muted);margin-top:4px}
.actions{display:flex;gap:8px;align-items:center}

.state{text-align:center;padding:40px 10px}
.state-title{font-size:16px;font-weight:800}
.state-sub{margin-top:8px;font-size:13px;color:var(--muted)}

.list{display:grid;gap:14px}
.card{padding:14px;border-radius:18px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent);backdrop-filter:blur(10px);transition:transform .18s ease}
.card:hover{transform:translateY(-2px)}
.card-head{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-bottom:10px}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--success));opacity:.6}
.meta{display:grid;gap:2px}
.author{font-weight:900;font-size:14px}
.submeta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.dot{opacity:.6}
.time{font-size:12px;color:var(--muted);white-space:nowrap}
.content{font-size:14px;line-height:1.5;white-space:pre-wrap}

.imgGrid{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.imgCell{border-radius:14px;overflow:hidden;border:1px solid var(--border);background:#000;aspect-ratio:1/1}
.imgCell img{width:100%;height:100%;object-fit:cover;display:block}

.footer{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--border);padding:6px 10px;border-radius:999px;background:color-mix(in oklab,var(--surface-2) 85%,transparent)}
.pill.on{border-color:color-mix(in oklab,var(--success) 45%,var(--border));color:var(--text)}

.more{display:grid;place-items:center;padding:10px 0}
.end{font-size:12px;color:var(--muted)}

/* skeleton */
.skeleton-card{padding:14px;border-radius:18px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent)}
.sk-line{height:12px;border-radius:6px;background:linear-gradient(90deg,rgba(255,255,255,.06) 25%,rgba(255,255,255,.12) 37%,rgba(255,255,255,.06) 63%);background-size:400% 100%;animation:shimmer 1.2s infinite;margin-bottom:10px}
.sk-title{width:40%}
.short{width:60%}
@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}

.pill.btn{
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  gap:6px;
}
.pill.btn:disabled{
  opacity:.6;
  cursor:not-allowed;
}
.pill.btn.on{
  border-color: color-mix(in oklab, var(--danger) 45%, var(--border));
  color: var(--text);
}
.pill.btn.busy{
  filter:saturate(.9);
}
.heart{
  transform: translateY(0.5px);
}
</style>