<!-- src/views/PostDetailView.vue (v3.4+: reply(1-depth) UI + @mention autocomplete + sort + realtime new badge + composer overlap fix)
     NOTE: Backend currently supports flat comments only.
     - Replies are represented client-side (session-only) by grouping comments you create as replies under a parent.
     - Mentions are pure UX (insert @handle), no backend parsing required.
     - Sort "인기" falls back to server order (or local heuristic) because backend doesn't expose comment-like counts yet.
-->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchPostDetail, deletePost } from "../api/posts";
import { fetchComments, createComment, deleteComment } from "../api/comments";
import { likePost, unlikePost } from "../api/likes";
import { useToastStore } from "../stores/toast";
import { useAuthStore } from "../stores/auth";
import RlButton from "../components/ui/RlButton.vue";
import Lightbox from "../components/media/Lightbox.vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();

const postId = computed(() => route.params.postId);

const loading = ref(false);
const error = ref("");
const post = ref(null);

/** ===== Like ===== */
const likeBusy = ref(false);
async function toggleLike() {
  if (!post.value?.postId || likeBusy.value) return;

  likeBusy.value = true;
  const prevLiked = !!post.value.likedByMe;
  const prevCount = Number(post.value.likeCount ?? 0);

  post.value.likedByMe = !prevLiked;
  post.value.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

  try {
    if (!prevLiked) await likePost(post.value.postId);
    else await unlikePost(post.value.postId);
  } catch {
    post.value.likedByMe = prevLiked;
    post.value.likeCount = prevCount;
    toast.error?.("좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeBusy.value = false;
  }
}

/** ===== Delete post ===== */
const isMinePost = computed(() => {
  const myId = auth.me?.userId || auth.me?.id;
  return !!myId && post.value?.authorId === myId;
});
async function onDeletePost() {
  if (!isMinePost.value) return;
  if (!confirm("정말 삭제할까요?")) return;

  try {
    await deletePost(postId.value);
    toast.success?.("삭제 완료", "게시글이 삭제되었습니다.");
    router.back();
  } catch (e) {
    toast.error?.("삭제 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}

/** ===== Images ===== */
const lbOpen = ref(false);
const lbIndex = ref(0);
function openLightbox(i) {
  lbIndex.value = i;
  lbOpen.value = true;
}

function fmtVisibility(v) {
  if (v === "FOLLOWERS") return "팔로워";
  if (v === "PRIVATE") return "나만";
  return "전체";
}

/** ===== Comments (backend: flat) ===== */
const commentsLoading = ref(false);
const commentsError = ref("");
const comments = ref([]);
const commentsNextCursor = ref(null);
const commentsHasNext = ref(false);
const commentsMoreLoading = ref(false);

const sentinelRef = ref(null);
let io = null;

/** realtime badge */
const newCommentsCount = ref(0);
let latestSeenCommentId = null;
let pollTimer = null;

/** sort */
const sortMode = ref("LATEST"); // LATEST | POPULAR

/** composer (bottom) */
const newComment = ref("");
const commentBusy = ref(false);

/** mention autocomplete */
const mentionOpen = ref(false);
const mentionQuery = ref("");
const mentionAnchor = ref({ top: 0, left: 0 });
const mentionActiveIndex = ref(0);
const mentionCandidates = computed(() => {
  const set = new Map(); // handle -> {handle, name}
  const add = (h, n) => {
    if (!h) return;
    const key = String(h).replace(/^@/, "");
    if (!key) return;
    if (!set.has(key)) set.set(key, { handle: key, name: n || key });
  };

  // post author
  add(post.value?.authorHandle, post.value?.authorName);
  // commenters (loaded)
  for (const c of comments.value) add(c.handle, c.name);

  const q = (mentionQuery.value || "").toLowerCase();
  let arr = Array.from(set.values());
  if (q) arr = arr.filter((x) => x.handle.toLowerCase().includes(q) || (x.name || "").toLowerCase().includes(q));
  return arr.slice(0, 8);
});

/** replies (session-only grouping) */
const replyTo = ref(null); // { parentId, handle, name }
const replyDraft = ref(""); // when using inline reply composer
const replyBusy = ref(false);
const localParentByChild = ref(new Map()); // childCommentId -> parentCommentId (session-only)

/** derived: can delete comment */
function myId() {
  return auth.me?.userId || auth.me?.id;
}
function canDeleteComment(c) {
  const id = myId();
  return !!id && c.userId === id;
}

/** parse time for sort */
function parseTime(t) {
  if (!t) return 0;
  // backend seems to send ISO, sometimes with nanos
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** build a 1-depth tree for rendering:
    - server comments are flat
    - replies exist only for comments created as replies in this session (localParentByChild)
*/
const commentTree = computed(() => {
  const list = comments.value.slice();

  // sort
  if (sortMode.value === "LATEST") {
    list.sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt));
  } else {
    // "인기": backend doesn't provide like counts, so:
    // 1) keep server order; 2) as fallback, sort by reply count (local) then time.
    const replyCount = new Map();
    for (const [child, parent] of localParentByChild.value.entries()) {
      replyCount.set(parent, (replyCount.get(parent) || 0) + 1);
    }
    list.sort((a, b) => (replyCount.get(b.commentId) || 0) - (replyCount.get(a.commentId) || 0) || parseTime(b.createdAt) - parseTime(a.createdAt));
  }

  // split into roots + children (only local replies)
  const roots = [];
  const childrenByParent = new Map();
  for (const c of list) {
    const pid = localParentByChild.value.get(String(c.commentId));
    if (pid) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(c);
    } else {
      roots.push(c);
    }
  }

  const out = [];
  for (const r of roots) {
    out.push({ type: "comment", item: r, depth: 0 });
    const kids = childrenByParent.get(String(r.commentId)) || [];
    for (const k of kids) out.push({ type: "comment", item: k, depth: 1, parentId: String(r.commentId) });
  }
  return out;
});

/** ===== Loaders ===== */
async function loadCommentsFirst() {
  commentsLoading.value = true;
  commentsError.value = "";
  try {
    const res = await fetchComments({ postId: postId.value, size: 20 });
    comments.value = res.items || [];
    commentsNextCursor.value = res.nextCursor ?? null;
    commentsHasNext.value = !!res.hasNext;

    latestSeenCommentId = comments.value?.[0]?.commentId ?? latestSeenCommentId;
    newCommentsCount.value = 0;

    await nextTick();
    if (io && sentinelRef.value) io.observe(sentinelRef.value);
  } catch (e) {
    commentsError.value = e?.response?.data?.message || "댓글을 불러오지 못했습니다.";
  } finally {
    commentsLoading.value = false;
  }
}

async function loadCommentsMore() {
  if (!commentsHasNext.value || !commentsNextCursor.value) return;
  if (commentsMoreLoading.value) return;

  commentsMoreLoading.value = true;
  try {
    const res = await fetchComments({ postId: postId.value, size: 20, cursor: commentsNextCursor.value });
    comments.value.push(...(res.items || []));
    commentsNextCursor.value = res.nextCursor ?? null;
    commentsHasNext.value = !!res.hasNext;
  } finally {
    commentsMoreLoading.value = false;
  }
}

function attachObserver() {
  if (io) io.disconnect();
  io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (!e?.isIntersecting) return;
      if (!commentsHasNext.value) return;
      loadCommentsMore();
    },
    { root: null, threshold: 0.01, rootMargin: "800px 0px" }
  );
  if (sentinelRef.value) io.observe(sentinelRef.value);
}

async function pollNewComments() {
  if (document?.hidden) return;
  try {
    const res = await fetchComments({ postId: postId.value, size: 1 });
    const top = res?.items?.[0];
    const topId = top?.commentId;
    if (!topId) return;

    if (!latestSeenCommentId) {
      latestSeenCommentId = topId;
      return;
    }
    if (String(topId) !== String(latestSeenCommentId)) {
      newCommentsCount.value = Math.min(99, Number(newCommentsCount.value) + 1);
    }
  } catch {
    // silent
  }
}
function startPoll() {
  stopPoll();
  pollTimer = setInterval(pollNewComments, 12000);
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** ===== Main load ===== */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    post.value = await fetchPostDetail(postId.value);
    await loadCommentsFirst();
  } catch (e) {
    error.value = e?.response?.data?.message || "게시글을 불러오지 못했습니다.";
    toast.error?.("상세 로딩 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    loading.value = false;
  }
}

/** ===== Delete comment ===== */
const deleteBusy = ref(new Set());
async function onDeleteComment(c) {
  const id = c.commentId;
  if (!id) return;
  if (deleteBusy.value.has(id)) return;
  if (!confirm("댓글을 삭제할까요?")) return;

  deleteBusy.value.add(id);
  try {
    await deleteComment(id);
    comments.value = comments.value.filter((x) => String(x.commentId) !== String(id));
    localParentByChild.value.delete(String(id));
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
  } catch {
    toast.error?.("삭제 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    deleteBusy.value.delete(id);
  }
}

/** ===== Composer helpers ===== */
function focusComposer() {
  const el = document.getElementById("commentComposerInput");
  el?.focus?.();
}

function insertAtCursor(el, text) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const v = el.value;
  el.value = v.slice(0, start) + text + v.slice(end);
  const pos = start + text.length;
  el.setSelectionRange?.(pos, pos);
  el.dispatchEvent?.(new Event("input", { bubbles: true }));
}

function findMentionContext(value, cursorPos) {
  const before = value.slice(0, cursorPos);
  const m = before.match(/(^|\s)@([\w\d_\.\-]{0,20})$/);
  if (!m) return null;
  const q = m[2] || "";
  const atIndex = before.lastIndexOf("@");
  return { q, atIndex };
}

function openMention(el, q) {
  mentionOpen.value = true;
  mentionQuery.value = q || "";
  mentionActiveIndex.value = 0;

  // approximate anchor: place near bottom composer (good enough on mobile)
  const rect = el.getBoundingClientRect();
  mentionAnchor.value = { top: rect.top - 10, left: rect.left + 12 };
}

function closeMention() {
  mentionOpen.value = false;
  mentionQuery.value = "";
}

/** bottom comment submit */
async function submitComment() {
  const content = newComment.value.trim();
  if (!content) {
    toast.error?.("댓글 내용", "댓글을 입력해주세요.");
    return;
  }
  if (commentBusy.value) return;

  commentBusy.value = true;

  const tmpId = "tmp-" + Date.now();
  const optimistic = {
    commentId: tmpId,
    userId: myId(),
    handle: auth.me?.handle || auth.me?.username || "me",
    name: auth.me?.name || auth.me?.displayName || "나",
    content,
    createdAt: new Date().toISOString(),
    _optimistic: true,
  };

  comments.value.unshift(optimistic);
  if (post.value) post.value.commentCount = Number(post.value.commentCount ?? 0) + 1;

  newComment.value = "";
  closeMention();

  try {
    const created = await createComment({ postId: postId.value, content });
    const idx = comments.value.findIndex((x) => x.commentId === tmpId);
    if (idx >= 0) {
      comments.value[idx] = { ...comments.value[idx], ...created, _optimistic: false };
    }
  } catch (e) {
    comments.value = comments.value.filter((x) => x.commentId !== tmpId);
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
    const msg = e?.response?.data?.fieldErrors?.[0]?.reason || e?.response?.data?.message;
    toast.error?.("댓글 등록 실패", msg || "잠시 후 다시 시도해주세요.");
  } finally {
    commentBusy.value = false;
  }
}

function onComposerKeydown(e) {
  if (mentionOpen.value) {
    if (e.key === "ArrowDown") { e.preventDefault(); mentionActiveIndex.value = Math.min(mentionCandidates.value.length - 1, mentionActiveIndex.value + 1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mentionActiveIndex.value = Math.max(0, mentionActiveIndex.value - 1); return; }
    if (e.key === "Escape") { e.preventDefault(); closeMention(); return; }
    if (e.key === "Enter" && !e.shiftKey) {
      const c = mentionCandidates.value[mentionActiveIndex.value];
      if (c) { e.preventDefault(); applyMention(c); return; }
    }
  }

  if (e.key !== "Enter") return;
  if (e.shiftKey) return;
  e.preventDefault();
  submitComment();
}

function onComposerInput(e) {
  const el = e.target;
  const pos = el.selectionStart ?? el.value.length;
  const ctx = findMentionContext(el.value, pos);
  if (!ctx) { closeMention(); return; }
  openMention(el, ctx.q);
}

function applyMention(candidate) {
  const el = document.getElementById("commentComposerInput");
  if (!el) return;

  const pos = el.selectionStart ?? el.value.length;
  const ctx = findMentionContext(el.value, pos);
  if (!ctx) return;

  const handle = String(candidate.handle).replace(/^@/, "");
  const before = el.value.slice(0, ctx.atIndex);
  const after = el.value.slice(pos);
  const insert = "@" + handle + " ";
  el.value = before + insert + after;
  const newPos = (before + insert).length;
  el.setSelectionRange?.(newPos, newPos);
  el.dispatchEvent?.(new Event("input", { bubbles: true }));
  closeMention();
  el.focus?.();
}

/** ===== Reply UX (session-only grouping) ===== */
function startReply(parentComment) {
  replyTo.value = {
    parentId: String(parentComment.commentId),
    handle: parentComment.handle || "user",
    name: parentComment.name || "User",
  };
  replyDraft.value = "@" + String(parentComment.handle || "user").replace(/^@/, "") + " ";
  nextTick(() => {
    const el = document.getElementById("replyInput");
    el?.focus?.();
  });
}

function cancelReply() {
  replyTo.value = null;
  replyDraft.value = "";
}

async function submitReply() {
  const rt = replyTo.value;
  if (!rt) return;

  const content = replyDraft.value.trim();
  if (!content) {
    toast.error?.("답글", "답글 내용을 입력해주세요.");
    return;
  }
  if (replyBusy.value) return;
  replyBusy.value = true;

  const tmpId = "tmp-r-" + Date.now();
  const optimistic = {
    commentId: tmpId,
    userId: myId(),
    handle: auth.me?.handle || auth.me?.username || "me",
    name: auth.me?.name || auth.me?.displayName || "나",
    content,
    createdAt: new Date().toISOString(),
    _optimistic: true,
  };

  // mark as reply (session-only)
  localParentByChild.value.set(String(tmpId), String(rt.parentId));
  comments.value.unshift(optimistic);
  if (post.value) post.value.commentCount = Number(post.value.commentCount ?? 0) + 1;

  try {
    const created = await createComment({ postId: postId.value, content });
    const idx = comments.value.findIndex((x) => x.commentId === tmpId);
    if (idx >= 0) {
      comments.value[idx] = { ...comments.value[idx], ...created, _optimistic: false };
      localParentByChild.value.delete(String(tmpId));
      localParentByChild.value.set(String(created.commentId), String(rt.parentId));
    }
    cancelReply();
  } catch (e) {
    comments.value = comments.value.filter((x) => x.commentId !== tmpId);
    localParentByChild.value.delete(String(tmpId));
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
    const msg = e?.response?.data?.fieldErrors?.[0]?.reason || e?.response?.data?.message;
    toast.error?.("답글 등록 실패", msg || "잠시 후 다시 시도해주세요.");
  } finally {
    replyBusy.value = false;
  }
}

function onReplyKeydown(e) {
  if (e.key !== "Enter") return;
  if (e.shiftKey) return;
  e.preventDefault();
  submitReply();
}

/** badge action */
async function refreshNewComments() {
  await loadCommentsFirst();
  // keep on comments area
  nextTick(() => {
    const el = document.getElementById("commentsTop");
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
}

/** lifecycle */
onMounted(() => {
  attachObserver();
  load();
  startPoll();
});
onBeforeUnmount(() => {
  if (io) io.disconnect();
  io = null;
  stopPoll();
});
watch(
  () => route.params.postId,
  () => load()
);
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="topTitle">게시글</div>
      <div class="topRight">
        <RlButton v-if="isMinePost" size="sm" variant="soft" @click="onDeletePost">삭제</RlButton>
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
            <span class="badge">{{ fmtVisibility(post.visibility) }}</span>
            <span class="dot">·</span>
            <span class="time">{{ post.createdAt || "" }}</span>
          </div>
        </div>
      </div>

      <div v-if="post.content" class="content">{{ post.content }}</div>

      <div v-if="post.imageUrls?.length" class="media">
        <div class="carousel">
          <button
            v-if="post.imageUrls.length > 1"
            class="nav left"
            type="button"
            @click="$refs.carousel?.scrollBy({ left: -320, behavior: 'smooth' })"
            aria-label="이전"
          >‹</button>

          <div ref="carousel" class="track">
            <button
              v-for="(url, i) in post.imageUrls"
              :key="url"
              class="shot"
              type="button"
              @click="openLightbox(i)"
            >
              <img :src="url" alt="" />
            </button>
          </div>

          <button
            v-if="post.imageUrls.length > 1"
            class="nav right"
            type="button"
            @click="$refs.carousel?.scrollBy({ left: 320, behavior: 'smooth' })"
            aria-label="다음"
          >›</button>
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

        <button class="pill btn" type="button" @click="focusComposer">
          💬 {{ post.commentCount ?? 0 }}
        </button>
      </div>

      <!-- ===== Comments ===== -->
      <div class="comments" id="commentsTop">
        <div class="cHead">
          <div>
            <div class="cTitle">댓글</div>
            <div class="cSub">총 {{ post?.commentCount ?? 0 }}개</div>
          </div>

          <div class="cControls">
            <button class="seg" :class="{ on: sortMode==='LATEST' }" type="button" @click="sortMode='LATEST'">최신</button>
            <button class="seg" :class="{ on: sortMode==='POPULAR' }" type="button" @click="sortMode='POPULAR'">인기</button>
          </div>
        </div>

        <button v-if="newCommentsCount>0" class="newBadge" type="button" @click="refreshNewComments">
          새 댓글 {{ newCommentsCount }}개
        </button>

        <div v-if="commentsLoading" class="cState">댓글 불러오는 중…</div>
        <div v-else-if="commentsError" class="cState err">{{ commentsError }}</div>
        <div v-else-if="comments.length === 0" class="cState">첫 댓글을 남겨보세요 ✨</div>

        <TransitionGroup v-else name="c" tag="div" class="cList">
          <div
            v-for="node in commentTree"
            :key="node.item.commentId"
            class="cItem"
            :class="[{ optimistic: node.item._optimistic }, node.depth===1 ? 'depth1' : 'depth0']"
          >
            <div class="cMeta">
              <div class="cName">{{ node.item.name || "User" }}</div>
              <div class="cHandle">@{{ node.item.handle || "handle" }}</div>
              <div class="cTime">{{ node.item.createdAt || "" }}</div>

              <div class="cActions">
                <button class="cAct" type="button" @click="startReply(node.item)">답글</button>
                <button
                  v-if="canDeleteComment(node.item)"
                  class="cAct danger"
                  type="button"
                  @click="onDeleteComment(node.item)"
                  :disabled="deleteBusy.has(node.item.commentId)"
                >
                  삭제
                </button>
              </div>
            </div>

            <div class="cContent">{{ node.item.content }}</div>

            <!-- inline reply composer (only when replying to this comment) -->
            <div v-if="replyTo && String(replyTo.parentId)===String(node.item.commentId)" class="replyBox">
              <div class="replyTop">
                <span class="replyTo">@{{ replyTo.handle }}에게 답글</span>
                <button class="replyCancel" type="button" @click="cancelReply">취소</button>
              </div>
              <div class="replyRow">
                <textarea
                  id="replyInput"
                  v-model="replyDraft"
                  class="replyInput"
                  rows="1"
                  maxlength="300"
                  placeholder="답글 입력… (Enter 전송 / Shift+Enter 줄바꿈)"
                  @keydown="onReplyKeydown"
                />
                <button class="replyBtn" type="button" @click="submitReply" :disabled="replyBusy">
                  {{ replyBusy ? "…" : "등록" }}
                </button>
              </div>
            </div>
          </div>
        </TransitionGroup>

        <div ref="sentinelRef" class="cSentinel">
          <div v-if="commentsMoreLoading" class="cMoreHint">불러오는 중…</div>
          <div v-else-if="!commentsHasNext && comments.length > 0" class="cEnd">끝 ✨</div>
        </div>
      </div>
    </div>

    <!-- ✅ Bottom fixed composer -->
    <div class="composerBar">
      <div v-if="mentionOpen && mentionCandidates.length" class="mentionPopup" :style="{ left: mentionAnchor.left+'px', top: (mentionAnchor.top-140)+'px' }">
        <button
          v-for="(m, i) in mentionCandidates"
          :key="m.handle"
          class="mentionItem"
          :class="{ on: i===mentionActiveIndex }"
          type="button"
          @mousedown.prevent="applyMention(m)"
        >
          <span class="mh">@{{ m.handle }}</span>
          <span class="mn">{{ m.name }}</span>
        </button>
      </div>

      <div class="composerInner">
        <textarea
          id="commentComposerInput"
          v-model="newComment"
          class="cInput"
          placeholder="댓글을 입력하세요… (Enter 전송 / Shift+Enter 줄바꿈)"
          maxlength="300"
          rows="1"
          @keydown="onComposerKeydown"
          @input="onComposerInput"
        />
        <button class="cBtn" type="button" @click="submitComment" :disabled="commentBusy">
          {{ commentBusy ? "…" : "등록" }}
        </button>
      </div>
    </div>

    <Lightbox
      v-if="lbOpen"
      :images="post?.imageUrls || []"
      :start-index="lbIndex"
      @close="lbOpen=false"
    />
  </div>
</template>

<style scoped>
.page{
  padding: 14px 14px calc(118px + env(safe-area-inset-bottom));
  max-width: 720px;
  margin: 0 auto;
}

/* top */
.topbar{
  position: sticky;
  top: 0;
  z-index: 60;
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  padding: 10px 0 12px;
  background: color-mix(in oklab, var(--bg) 82%, transparent);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.topTitle{ font-weight:950; text-align:center; }
.topRight{ display:flex; justify-content:end; }

.state{text-align:center;padding:40px 10px}
.state-title{font-size:16px;font-weight:900}
.state-sub{margin-top:8px;font-size:13px;color:var(--muted)}

.card{
  padding:14px;
  border-radius:18px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  backdrop-filter:blur(10px)
}
.card-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--success));opacity:.6}
.meta{display:grid;gap:2px}
.author{font-weight:900;font-size:14px}
.submeta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
.badge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-weight: 900;
  font-size: 11px;
}
.dot{opacity:.6}
.content{font-size:14px;line-height:1.5;white-space:pre-wrap}

/* media */
.media{ margin-top: 12px; }
.carousel{ position: relative; }
.track{
  display:flex;
  gap:10px;
  overflow:auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 2px;
}
.track::-webkit-scrollbar{ height: 6px; }
.track::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.12); border-radius: 999px; }
.shot{
  border: 0;
  background: transparent;
  padding: 0;
  width: min(520px, 86vw);
  aspect-ratio: 4 / 3;
  border-radius: 18px;
  overflow:hidden;
  border: 1px solid var(--border);
  scroll-snap-align: start;
}
.shot img{ width:100%; height:100%; object-fit: cover; display:block; }
.nav{
  position:absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.35);
  backdrop-filter: blur(10px);
  color: rgba(255,255,255,.9);
  font-size: 22px;
  cursor:pointer;
}
.nav.left{ left: 8px; }
.nav.right{ right: 8px; }

/* footer actions */
.footer{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--border);padding:6px 10px;border-radius:999px;background:color-mix(in oklab,var(--surface-2) 85%,transparent)}
.pill.btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pill.btn:disabled{opacity:.6;cursor:not-allowed}
.pill.btn.on{border-color:color-mix(in oklab,var(--danger) 45%,var(--border));color:var(--text)}
.pill.btn.busy{filter:saturate(.9)}
.heart{transform:translateY(.5px)}

/* comments */
.comments{
  margin-top:14px;
  border-top:1px solid var(--border);
  padding-top:14px;

  /* ✅ FIX: bottom fixed composer overlaps “끝/마지막 댓글” → reserve space */
  padding-bottom: 92px;
  display:grid;
  gap:12px
}
.cHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cTitle{font-weight:950}
.cSub{font-size:12px;color:var(--muted);margin-top:2px}
.cControls{display:flex;gap:6px;align-items:center}
.seg{
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.9);
  font-weight: 900;
  cursor:pointer;
}
.seg.on{ background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.18); }

.newBadge{
  height: 34px;
  width: fit-content;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.92);
  font-weight: 950;
  cursor: pointer;
}

.cState{font-size:13px;color:var(--muted);text-align:center;padding:10px 0}
.cState.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.cList{display:grid;gap:10px}
.cItem{border:1px solid var(--border);border-radius:16px;padding:10px;background:color-mix(in oklab,var(--surface) 92%,transparent)}
.cItem.optimistic{ opacity: .75; }
.cItem.depth1{
  margin-left: 14px;
  border-left: 2px solid rgba(255,255,255,.10);
  padding-left: 12px;
}
.cMeta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cName{font-weight:900;font-size:13px}
.cHandle,.cTime{font-size:12px;color:var(--muted)}
.cActions{ margin-left: auto; display:flex; gap:6px; align-items:center; }
.cAct{
  height: 30px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.9);
  font-weight: 900;
  cursor:pointer;
}
.cAct.danger{ border-color: color-mix(in oklab,var(--danger) 45%,rgba(255,255,255,.12)); }
.cAct:disabled{ opacity:.6; cursor:not-allowed; }

.cContent{margin-top:6px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}

.replyBox{
  margin-top: 10px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 14px;
  padding: 10px;
  background: rgba(255,255,255,.04);
}
.replyTop{ display:flex; justify-content:space-between; align-items:center; gap: 10px; }
.replyTo{ font-size: 12px; font-weight: 900; opacity: .85; }
.replyCancel{ border: 0; background: transparent; color: rgba(255,255,255,.8); font-weight: 900; cursor: pointer; }
.replyRow{ margin-top: 8px; display:grid; grid-template-columns: 1fr auto; gap: 8px; align-items:end; }
.replyInput{
  min-height: 40px;
  max-height: 120px;
  resize: none;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  padding: 9px 10px;
  color: var(--text);
  line-height: 1.35;
}
.replyBtn{
  height: 40px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab,var(--accent) 45%,rgba(255,255,255,.12));
  background: color-mix(in oklab,var(--accent) 16%,transparent);
  font-weight: 950;
  color: var(--text);
}
.replyBtn:disabled{ opacity:.6; }

.cSentinel{ display:grid; place-items:center; padding: 10px 0 2px; }
.cMoreHint{ opacity:.75; font-size:12px; }
.cEnd{font-size:12px;color:var(--muted)}

/* bottom composer */
.composerBar{
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(
    to bottom,
    color-mix(in oklab, var(--bg) 0%, transparent),
    color-mix(in oklab, var(--bg) 92%, transparent)
  );
  backdrop-filter: blur(18px);
  border-top: 1px solid rgba(255,255,255,.06);
}
.composerInner{
  max-width: 720px;
  margin: 0 auto;
  display:grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items:end;
}
.cInput{
  min-height: 44px;
  max-height: 120px;
  resize: none;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding: 10px 12px;
  color: var(--text);
  line-height: 1.35;
}
.cBtn{
  height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab,var(--accent) 45%,var(--border));
  background: color-mix(in oklab,var(--accent) 16%,transparent);
  font-weight: 950;
  color: var(--text);
}
.cBtn:disabled{ opacity:.6; }

/* mention popup */
.mentionPopup{
  position: fixed;
  z-index: 90;
  width: min(360px, calc(100vw - 28px));
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(10,14,22,.92);
  backdrop-filter: blur(16px);
  padding: 6px;
  box-shadow: 0 16px 40px rgba(0,0,0,.35);
}
.mentionItem{
  width: 100%;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 0;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor:pointer;
}
.mentionItem.on{ background: rgba(255,255,255,.10); }
.mh{ font-weight: 950; }
.mn{ opacity: .7; font-size: 12px; }

/* TransitionGroup */
.c-enter-active,.c-leave-active{ transition: all .22s ease; }
.c-enter-from{ opacity: 0; transform: translateY(6px) scale(.98); }
.c-leave-to{ opacity: 0; transform: translateY(-6px) scale(.98); }

@media (max-width: 520px){
  .shot{ width: 86vw; }
}
</style>
