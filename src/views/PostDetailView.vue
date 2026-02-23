<!-- src/views/PostDetailView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchPostDetail, deletePost } from "../api/posts";
import { fetchComments, createComment, deleteComment } from "../api/comments";
import { likePost, unlikePost } from "../api/likes";
import { useToastStore } from "../stores/toast";
import RlButton from "../components/ui/RlButton.vue";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();

const postId = computed(() => route.params.postId);

const loading = ref(false);
const error = ref("");
const post = ref(null);

const likeBusy = ref(false);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    post.value = await fetchPostDetail(postId.value);
    await loadCommentsFirst();
  } catch (e) {
    error.value = e?.response?.data?.message || "게시글을 불러오지 못했습니다.";
    toast.error("상세 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loading.value = false;
  }
}

const isMine = computed(() => {
  const myId = auth.me?.userId || auth.me?.id;
  return !!myId && post.value?.authorId === myId;
});

async function onDelete() {
  if (!isMine.value) return;

  const ok = confirm("정말 삭제할까요? 되돌릴 수 없어요.");
  if (!ok) return;

  try {
    await deletePost(postId.value);
    toast.success("삭제 완료", "게시글이 삭제되었습니다.");
    router.back();
  } catch (e) {
    toast.error("삭제 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}

async function toggleLike() {
  if (!post.value?.postId) return;
  if (likeBusy.value) return;

  likeBusy.value = true;

  const prevLiked = !!post.value.likedByMe;
  const prevCount = Number(post.value.likeCount ?? 0);

  // ✅ 낙관적 업데이트
  post.value.likedByMe = !prevLiked;
  post.value.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

  try {
    if (!prevLiked) await likePost(post.value.postId);
    else await unlikePost(post.value.postId);
  } catch {
    // ❌ 실패 시 원복
    post.value.likedByMe = prevLiked;
    post.value.likeCount = prevCount;
    toast.error("좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeBusy.value = false;
  }
}

const commentsLoading = ref(false);
const commentsError = ref("");
const comments = ref([]);
const commentsNextCursor = ref(null);
const commentsHasNext = ref(false);
const commentsMoreLoading = ref(false);

const newComment = ref("");
const commentBusy = ref(false);
const deleteBusy = ref(new Set()); // commentId set

async function loadCommentsFirst() {
  commentsLoading.value = true;
  commentsError.value = "";
  try {
    const res = await fetchComments({ postId: postId.value, size: 10 });
    comments.value = res.items;
    commentsNextCursor.value = res.nextCursor;
    commentsHasNext.value = res.hasNext;
  } catch (e) {
    commentsError.value = e?.response?.data?.message || "댓글을 불러오지 못했습니다.";
  } finally {
    commentsLoading.value = false;
  }
}

async function loadCommentsMore() {
  if (!commentsHasNext.value || !commentsNextCursor.value) return;
  commentsMoreLoading.value = true;
  try {
    const res = await fetchComments({
      postId: postId.value,
      size: 10,
      cursor: commentsNextCursor.value,
    });
    comments.value.push(...res.items);
    commentsNextCursor.value = res.nextCursor;
    commentsHasNext.value = res.hasNext;
  } finally {
    commentsMoreLoading.value = false;
  }
}

async function submitComment() {
  const content = newComment.value.trim();
  if (!content) {
    toast.error("댓글 내용", "댓글을 입력해주세요.");
    return;
  }
  if (commentBusy.value) return;

  commentBusy.value = true;
  try {
    const created = await createComment({ postId: postId.value, content });

    // ✅ 낙관적으로 목록에 추가 (API 응답이 이미 comment 형태)
    comments.value.unshift({
      commentId: created.commentId,
      userId: created.userId,
      handle: auth.me?.handle || auth.me?.username || "me",
      name: auth.me?.name || auth.me?.displayName || "나",
      content: created.content,
      createdAt: created.createdAt,
    });

    // 상세의 commentCount도 +1 (있으면)
    if (post.value) {
      const prev = Number(post.value.commentCount ?? 0);
      post.value.commentCount = prev + 1;
    }

    newComment.value = "";
  } catch (e) {
    const msg = e?.response?.data?.fieldErrors?.[0]?.reason || e?.response?.data?.message;
    toast.error("댓글 등록 실패", msg || "잠시 후 다시 시도해주세요.");
  } finally {
    commentBusy.value = false;
  }
}

function canDeleteComment(c) {
  const myId = auth.me?.userId || auth.me?.id;
  return !!myId && c.userId === myId;
}

async function onDeleteComment(c) {
  const id = c.commentId;
  if (!id) return;
  if (deleteBusy.value.has(id)) return;

  const ok = confirm("댓글을 삭제할까요?");
  if (!ok) return;

  deleteBusy.value.add(id);
  try {
    await deleteComment(id);
    comments.value = comments.value.filter((x) => x.commentId !== id);

    if (post.value) {
      const prev = Number(post.value.commentCount ?? 0);
      post.value.commentCount = Math.max(0, prev - 1);
    }
  } catch {
    toast.error("삭제 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    deleteBusy.value.delete(id);
  }
}

function fmtVisibility(v) {
  if (v === "FOLLOWERS") return "팔로워만";
  if (v === "PRIVATE") return "나만";
  return "전체 공개";
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">← 뒤로</RlButton>
      <div class="topTitle">게시글</div>
      <div class="topRight">
        <RlButton v-if="isMine" size="sm" variant="soft" @click="onDelete">삭제</RlButton>
      </div>
    </div>

    <div v-if="loading" class="state">
      <div class="state-title">불러오는 중…</div>
      <div class="state-sub">잠시만 기다려주세요</div>
    </div>

    <div v-else-if="error" class="state">
      <div class="state-title">오류</div>
      <div class="state-sub">{{ error }}</div>
      <RlButton @click="load">다시 시도</RlButton>
    </div>

    <div v-else-if="!post" class="state">
      <div class="state-title">게시글이 없어요</div>
      <div class="state-sub">삭제되었거나 접근 권한이 없을 수 있어요.</div>
    </div>

    <div v-else class="card">
      <div class="card-head">
        <div class="avatar"></div>
        <div class="meta">
          <div class="author">{{ post.authorName || "User" }}</div>
          <div class="submeta">
            <span class="vis">{{ fmtVisibility(post.visibility) }}</span>
            <span class="dot">·</span>
            <span class="time">{{ post.createdAt || "" }}</span>
          </div>
        </div>
      </div>

      <div v-if="post.content" class="content">{{ post.content }}</div>

      <div v-if="post.imageUrls?.length" class="imgGrid">
        <div v-for="url in post.imageUrls" :key="url" class="imgCell">
          <img :src="url" alt="" />
        </div>
      </div>

      <div class="footer">
        <button
            class="pill btn"
            :class="{ on: post.likedByMe, busy: likeBusy }"
            type="button"
            @click="toggleLike"
            :disabled="likeBusy"
            aria-label="Toggle like"
        >
          <span class="heart">{{ post.likedByMe ? "❤️" : "🤍" }}</span>
          <span>{{ post.likeCount ?? 0 }}</span>
        </button>

        <span class="pill">💬 {{ post.commentCount ?? 0 }}</span>
      </div>
      <div class="comments">
        <div class="cHead">
          <div class="cTitle">댓글</div>
          <div class="cSub">총 {{ post?.commentCount ?? 0 }}개</div>
        </div>

        <div class="composer">
          <input
              v-model="newComment"
              class="cInput"
              placeholder="댓글을 입력하세요…"
              maxlength="300"
              @keydown.enter.prevent="submitComment"
          />
          <button class="cBtn" type="button" @click="submitComment" :disabled="commentBusy">
            {{ commentBusy ? "등록중" : "등록" }}
          </button>
        </div>

        <div v-if="commentsLoading" class="cState">댓글 불러오는 중…</div>
        <div v-else-if="commentsError" class="cState err">{{ commentsError }}</div>
        <div v-else-if="comments.length === 0" class="cState">첫 댓글을 남겨보세요 ✨</div>

        <div v-else class="cList">
          <div v-for="c in comments" :key="c.commentId" class="cItem">
            <div class="cMeta">
              <div class="cName">{{ c.name || "User" }}</div>
              <div class="cHandle">@{{ c.handle || "handle" }}</div>
              <div class="cTime">{{ c.createdAt || "" }}</div>

              <button
                  v-if="canDeleteComment(c)"
                  class="cDel"
                  type="button"
                  @click="onDeleteComment(c)"
                  :disabled="deleteBusy.has(c.commentId)"
              >
                삭제
              </button>
            </div>
            <div class="cContent">{{ c.content }}</div>
          </div>

          <div class="cMore">
            <button v-if="commentsHasNext" class="cMoreBtn" type="button" @click="loadCommentsMore" :disabled="commentsMoreLoading">
              {{ commentsMoreLoading ? "불러오는 중…" : "더 보기" }}
            </button>
            <div v-else class="cEnd">끝 ✨</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:720px;margin:0 auto}
.topbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:14px}
.topTitle{font-weight:950;text-align:center}
.topRight{display:flex;justify-content:end}

.state{text-align:center;padding:40px 10px}
.state-title{font-size:16px;font-weight:900}
.state-sub{margin-top:8px;font-size:13px;color:var(--muted)}

.card{padding:14px;border-radius:18px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface) 92%,transparent);backdrop-filter:blur(10px)}
.card-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--success));opacity:.6}
.meta{display:grid;gap:2px}
.author{font-weight:900;font-size:14px}
.submeta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.dot{opacity:.6}
.content{font-size:14px;line-height:1.5;white-space:pre-wrap}

.imgGrid{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.imgCell{border-radius:14px;overflow:hidden;border:1px solid var(--border);background:#000;aspect-ratio:1/1}
.imgCell img{width:100%;height:100%;object-fit:cover;display:block}

.footer{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--border);padding:6px 10px;border-radius:999px;background:color-mix(in oklab,var(--surface-2) 85%,transparent)}
.pill.btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pill.btn:disabled{opacity:.6;cursor:not-allowed}
.pill.btn.on{border-color:color-mix(in oklab,var(--danger) 45%,var(--border));color:var(--text)}
.pill.btn.busy{filter:saturate(.9)}
.heart{transform:translateY(.5px)}
.comments{margin-top:14px;border-top:1px solid var(--border);padding-top:14px;display:grid;gap:12px}
.cHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.cTitle{font-weight:950}
.cSub{font-size:12px;color:var(--muted)}
.composer{display:grid;grid-template-columns:1fr auto;gap:8px}
.cInput{height:44px;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);padding:0 12px;color:var(--text)}
.cBtn{height:44px;padding:0 14px;border-radius:16px;border:1px solid color-mix(in oklab,var(--accent) 45%,var(--border));background:color-mix(in oklab,var(--accent) 16%,transparent);font-weight:950;color:var(--text)}
.cBtn:disabled{opacity:.6}
.cState{font-size:13px;color:var(--muted);text-align:center;padding:10px 0}
.cState.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.cList{display:grid;gap:10px}
.cItem{border:1px solid var(--border);border-radius:16px;padding:10px;background:color-mix(in oklab,var(--surface) 92%,transparent)}
.cMeta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cName{font-weight:900;font-size:13px}
.cHandle,.cTime{font-size:12px;color:var(--muted)}
.cDel{margin-left:auto;height:30px;padding:0 10px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.cDel:disabled{opacity:.6}
.cContent{margin-top:6px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}
.cMore{display:grid;place-items:center;padding:6px 0}
.cMoreBtn{height:40px;padding:0 12px;border-radius:14px;border:1px solid var(--border);background:transparent;color:var(--text);font-weight:900}
.cEnd{font-size:12px;color:var(--muted)}
</style>