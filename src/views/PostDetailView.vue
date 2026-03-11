<!-- src/views/PostDetailView.vue (v3.6 polish: premium comment flow + mobile-safe actions) -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchPostDetail, deletePost } from "../api/posts";
import { fetchComments, createComment, deleteComment, likeComment, unlikeComment } from "../api/comments";
import { likePost, unlikePost } from "../api/likes";
import { useToastStore } from "../stores/toast";
import { useAuthStore } from "../stores/auth";
import RlButton from "../components/ui/RlButton.vue";
import Lightbox from "../components/media/Lightbox.vue";
import sse from "../lib/sse";
import AsyncStatePanel from "../components/ui/AsyncStatePanel.vue";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();
const postId = computed(() => route.params.postId);
const loading = ref(false);
const error = ref("");
const post = ref(null);
const likeBusy = ref(false);
const lbOpen = ref(false);
const lbIndex = ref(0);
const commentsLoading = ref(false);
const commentsError = ref("");
const comments = ref([]);
const commentsNextCursor = ref(null);
const commentsHasNext = ref(false);
const commentsMoreLoading = ref(false);
const sentinelRef = ref(null);
let io = null;
const sortMode = ref("LATEST");
const newCommentsCount = ref(0);
let sseOff = null;
const commentBusy = ref(false);
const newComment = ref("");
const replyTo = ref(null);
const replyBusy = ref(false);
const replyDraft = ref("");
const likeCommentBusy = ref(new Set());
const mentionOpen = ref(false);
const mentionQuery = ref("");
const mentionActiveIndex = ref(0);
const actionSheetFor = ref(null);
let longPressTimer = null;

const isMinePost = computed(() => {
  const myId = auth.me?.userId || auth.me?.id;
  return !!myId && post.value?.authorId === myId;
});

const mentionCandidates = computed(() => {
  const seen = new Map();
  const add = (handle, name) => {
    const h = String(handle || "").replace(/^@/, "");
    if (!h) return;
    if (!seen.has(h)) seen.set(h, { handle: h, name: name || h });
  };
  add(post.value?.authorHandle, post.value?.authorName);
  for (const c of comments.value) add(c.handle, c.name);
  const q = mentionQuery.value.toLowerCase();
  let arr = Array.from(seen.values());
  if (q) arr = arr.filter((x) => x.handle.toLowerCase().includes(q) || String(x.name || "").toLowerCase().includes(q));
  return arr.slice(0, 8);
});

const rootCommentCount = computed(() => comments.value.filter((x) => !x.parentCommentId).length);
const imageCount = computed(() => Array.isArray(post.value?.imageUrls) ? post.value.imageUrls.length : 0);
const mediaLayout = computed(() => {
  const n = imageCount.value;
  if (n <= 0) return "none";
  if (n === 1) return "single";
  if (n === 2) return "double";
  return "carousel";
});

const detailShareMeta = computed(() => {
  const meta = post.value?.sourceMeta || null;
  if (meta) {
    const chips = [];
    if (Array.isArray(meta.chips) && meta.chips.length) {
      chips.push(...meta.chips.filter(Boolean).map((v) => String(v).trim()));
    } else {
      if (meta.time) chips.push(`🕒 ${meta.time}`);
      if (meta.place) chips.push(`📍 ${meta.place}`);
      if (meta.remindAt) chips.push(`⏰ ${meta.remindAt}`);
    }
    return {
      badge: meta.badge || "액션 공유",
      title: meta.title || "",
      subtitle: meta.subtitle || meta.description || "",
      state: meta.status || meta.state || "",
      chips: chips.slice(0, 3),
    };
  }
  if (!isActionSharePost(post.value)) return null;
  return buildFallbackShareMeta(post.value);
});

const detailShareComment = computed(() => {
  if (!detailShareMeta.value) return "";
  const lines = normalizedPostLines(post.value);
  if (!lines.length) return "";

  const cleaned = [];
  let skippedTitle = false;

  for (const line of lines) {
    if (line === "#RealLife") continue;
    if (/^[🕒📍⏰]/u.test(line)) continue;

    const normalizedTitle = stripLeadingEmojiTitle(line);
    const title = stripLeadingEmojiTitle(detailShareMeta.value?.title || "");
    if (!skippedTitle && normalizedTitle && title && normalizedTitle === title) {
      skippedTitle = true;
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
});

const detailBodyText = computed(() => {
  if (detailShareMeta.value) return detailShareComment.value;
  return String(post.value?.content || "").trim();
});

const detailBodyLabel = computed(() => {
  if (!detailShareMeta.value) return "";
  return detailShareComment.value ? "이 글에서 덧붙인 코멘트" : "액션 카드만 간단히 공유한 상태";
});

const detailInsightChips = computed(() => {
  const chips = [];
  if (detailShareMeta.value) chips.push("액션 공유");
  if (imageCount.value > 0) chips.push(`사진 ${imageCount.value}장`);
  const commentCount = Number(post.value?.commentCount || 0);
  if (commentCount <= 0) chips.push("첫 댓글 대기");
  else if (commentCount < 4) chips.push(`댓글 ${commentCount}개`);
  else chips.push(`대화 활발 · 댓글 ${commentCount}개`);
  const likeCount = Number(post.value?.likeCount || 0);
  if (likeCount > 0) chips.push(`좋아요 ${likeCount}`);
  return chips.slice(0, 4);
});

const flowHintText = computed(() => {
  if (detailShareMeta.value) {
    return "공유된 액션에 댓글을 남기면 약속, 할일, 장소 흐름으로 다시 이어갈 수 있어요";
  }
  return "댓글에서 액션을 만들고 대화방 Dock으로 이어갈 수 있어요";
});

const commentsSectionTitle = computed(() => detailShareMeta.value ? "이 액션에서 이어진 대화" : "댓글");
const commentsSectionSub = computed(() => {
  const total = Number(post.value?.commentCount ?? 0);
  if (detailShareMeta.value) return `총 ${total}개 · 루트 ${rootCommentCount}개 · 공유된 액션을 중심으로 대화가 이어져요`;
  return `총 ${total}개 · 루트 ${rootCommentCount}개`;
});

const commentTree = computed(() => {
  const list = comments.value.slice();
  if (sortMode.value === "LATEST") {
    list.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  } else {
    list.sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0) || ts(b.createdAt) - ts(a.createdAt));
  }
  const roots = [];
  const childMap = new Map();
  for (const c of list) {
    const pid = c.parentCommentId ? String(c.parentCommentId) : null;
    if (pid) {
      if (!childMap.has(pid)) childMap.set(pid, []);
      childMap.get(pid).push(c);
    } else roots.push(c);
  }
  const out = [];
  for (const r of roots) {
    out.push({ item: r, depth: 0 });
    const kids = childMap.get(String(r.commentId)) || [];
    kids.sort((a, b) => sortMode.value === "LATEST"
      ? ts(a.createdAt) - ts(b.createdAt)
      : Number(b.likeCount || 0) - Number(a.likeCount || 0) || ts(a.createdAt) - ts(b.createdAt));
    for (const k of kids) out.push({ item: k, depth: 1, parent: r });
  }
  return out;
});

function myId() { return auth.me?.userId || auth.me?.id; }
function canDeleteComment(c) { return !!myId() && c.userId === myId(); }
function ts(t) { const d = new Date(t); return Number.isFinite(d.getTime()) ? d.getTime() : 0; }
function fmtVisibility(v) { return v === "FOLLOWERS" ? "팔로워" : v === "PRIVATE" ? "나만" : "전체"; }
function openLightbox(i) { lbIndex.value = i; lbOpen.value = true; }
function closeActionSheet() { actionSheetFor.value = null; }
function openActionSheet(c) { actionSheetFor.value = c; }
function focusComposer() { document.getElementById("commentComposerInput")?.focus?.(); }
function formatCreatedAt(v) { return v ? String(v).replace("T", " ").slice(0, 19) : ""; }

function normalizedPostLines(target) {
  return String(target?.content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}
function stripLeadingEmojiTitle(line) {
  return String(line || "")
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "")
    .trim();
}
function inferActionKindLabel(title) {
  const s = String(title || "");
  if (!s) return "액션";
  if (/(약속|만나|미팅|식사|데이트|모임)/.test(s)) return "약속";
  if (/(할일|해야|작업|업무|정리|구매|체크)/.test(s)) return "할일";
  if (/(장소|가자|방문|역|카페|공원|식당)/.test(s)) return "장소";
  return "액션";
}
function isActionSharePost(target) {
  if (target?.sourceMeta) return true;
  return normalizedPostLines(target).includes("#RealLife");
}
function buildFallbackShareMeta(target) {
  const lines = normalizedPostLines(target).filter((line) => line !== "#RealLife");
  if (!lines.length) return null;

  const title = stripLeadingEmojiTitle(lines[0] || "");
  let time = "";
  let place = "";
  let remindAt = "";

  for (const line of lines.slice(1)) {
    if (line.startsWith("🕒")) time = line.replace(/^🕒\s*/, "").trim();
    else if (line.startsWith("📍")) place = line.replace(/^📍\s*/, "").trim();
    else if (line.startsWith("⏰")) remindAt = line.replace(/^⏰\s*/, "").trim();
  }

  const kind = inferActionKindLabel(title);
  const subtitle = [kind, place].filter(Boolean).join(" · ");
  const chips = [];
  if (time) chips.push(`🕒 ${time}`);
  if (place) chips.push(`📍 ${place}`);
  if (remindAt && remindAt !== "리마인드 없음") chips.push(`⏰ ${remindAt}`);

  return {
    badge: "액션 공유",
    title,
    subtitle: subtitle || "",
    state: remindAt ? "리마인더 설정됨" : kind,
    chips: chips.slice(0, 3),
  };
}

function createPendingAction(kind, c) {
  const payload = {
    kind,
    source: "post-comment",
    sourceLabel: "게시글 댓글",
    sourceRoute: `/posts/${encodeURIComponent(String(postId.value || ""))}`,
    sourcePostPreview: String(post.value?.content || "").trim().slice(0, 96),
    sourcePostAuthorName: post.value?.authorName || null,
    sourcePostAuthorHandle: post.value?.authorHandle || null,
    sourceVisibility: post.value?.visibility || null,
    postId: postId.value,
    commentId: c?.commentId || null,
    text: c?.content || "",
    authorHandle: c?.handle || null,
    createdAt: new Date().toISOString(),
  };
  try { sessionStorage.setItem("reallife:pendingAction", JSON.stringify(payload)); } catch {}
  closeActionSheet();
  toast.success?.("액션 준비됨", "대화방에서 바로 가져올 수 있게 준비했어요.");
  router.push("/inbox/conversations");
}

function onCommentTouchStart(c) {
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    openActionSheet(c);
  }, 420);
}
function onCommentTouchEnd() {
  clearTimeout(longPressTimer);
  longPressTimer = null;
}

async function toggleLike() {
  if (!post.value?.postId || likeBusy.value) return;
  likeBusy.value = true;
  const prevLiked = !!post.value.likedByMe;
  const prevCount = Number(post.value.likeCount ?? 0);
  post.value.likedByMe = !prevLiked;
  post.value.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
  try {
    if (!prevLiked) await likePost(post.value.postId); else await unlikePost(post.value.postId);
  } catch {
    post.value.likedByMe = prevLiked;
    post.value.likeCount = prevCount;
    toast.error?.("좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeBusy.value = false;
  }
}

async function onDeletePost() {
  if (!isMinePost.value || !confirm("정말 삭제할까요?")) return;
  try {
    await deletePost(postId.value);
    toast.success?.("삭제 완료", "게시글이 삭제되었습니다.");
    router.back();
  } catch (e) {
    toast.error?.("삭제 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  }
}

async function loadCommentsFirst() {
  commentsLoading.value = true;
  commentsError.value = "";
  try {
    const res = await fetchComments({ postId: postId.value, size: 20, sort: sortMode.value });
    comments.value = res.items || [];
    commentsNextCursor.value = res.nextCursor ?? null;
    commentsHasNext.value = !!res.hasNext;
    newCommentsCount.value = 0;
  } catch (e) {
    commentsError.value = e?.response?.data?.message || "댓글을 불러오지 못했습니다.";
  } finally {
    commentsLoading.value = false;
  }
}

async function loadCommentsMore() {
  if (!commentsHasNext.value || !commentsNextCursor.value || commentsMoreLoading.value) return;
  commentsMoreLoading.value = true;
  try {
    const res = await fetchComments({ postId: postId.value, size: 20, cursor: commentsNextCursor.value, sort: sortMode.value });
    comments.value.push(...(res.items || []));
    commentsNextCursor.value = res.nextCursor ?? null;
    commentsHasNext.value = !!res.hasNext;
  } finally {
    commentsMoreLoading.value = false;
  }
}

function attachObserver() {
  if (io) io.disconnect();
  io = new IntersectionObserver((entries) => {
    const e = entries[0];
    if (!e?.isIntersecting || !commentsHasNext.value) return;
    loadCommentsMore();
  }, { root: null, threshold: 0.01, rootMargin: "800px 0px" });
  if (sentinelRef.value) io.observe(sentinelRef.value);
}

function bindCommentSse() {
  if (sseOff) sseOff();
  sseOff = sse.onEvent?.((evt) => {
    const data = evt?.data;
    if (evt?.type !== "notification-created") return;
    if (data?.type !== "POST_COMMENT") return;
    if (String(data?.ref2Id || "") !== String(postId.value || "")) return;
    newCommentsCount.value = Math.min(99, Number(newCommentsCount.value) + 1);
  });
}

async function refreshNewComments() {
  await loadCommentsFirst();
  try { document.getElementById("commentsTop")?.scrollIntoView?.({ behavior: "smooth", block: "start" }); } catch {}
}

async function submitComment() {
  const content = newComment.value.trim();
  if (!content) return toast.error?.("댓글 내용", "댓글을 입력해주세요.");
  if (commentBusy.value) return;
  commentBusy.value = true;
  const tmpId = "tmp-" + Date.now();
  comments.value.unshift({
    commentId: tmpId,
    userId: myId(),
    handle: auth.me?.handle || auth.me?.username || "me",
    name: auth.me?.name || auth.me?.displayName || "나",
    content,
    createdAt: new Date().toISOString(),
    parentCommentId: null,
    likeCount: 0,
    likedByMe: false,
    _optimistic: true,
  });
  if (post.value) post.value.commentCount = Number(post.value.commentCount ?? 0) + 1;
  newComment.value = "";
  closeMention();
  try {
    const created = await createComment({ postId: postId.value, content });
    const idx = comments.value.findIndex((x) => x.commentId === tmpId);
    if (idx >= 0) comments.value[idx] = { ...comments.value[idx], ...created, _optimistic: false, likedByMe: false };
  } catch (e) {
    comments.value = comments.value.filter((x) => x.commentId !== tmpId);
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
    toast.error?.("댓글 등록 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    commentBusy.value = false;
  }
}

function startReply(c) {
  replyTo.value = c;
  replyDraft.value = "@" + String(c.handle || "user").replace(/^@/, "") + " ";
  closeMention();
}
function cancelReply() { replyTo.value = null; replyDraft.value = ""; }

async function submitReply() {
  const parent = replyTo.value;
  const content = replyDraft.value.trim();
  if (!parent) return;
  if (!content) return toast.error?.("답글", "답글 내용을 입력해주세요.");
  if (replyBusy.value) return;
  replyBusy.value = true;
  const tmpId = "tmp-r-" + Date.now();
  comments.value.unshift({
    commentId: tmpId,
    userId: myId(),
    handle: auth.me?.handle || auth.me?.username || "me",
    name: auth.me?.name || auth.me?.displayName || "나",
    content,
    createdAt: new Date().toISOString(),
    parentCommentId: parent.commentId,
    likeCount: 0,
    likedByMe: false,
    _optimistic: true,
  });
  if (post.value) post.value.commentCount = Number(post.value.commentCount ?? 0) + 1;
  try {
    const created = await createComment({ postId: postId.value, content, parentCommentId: parent.commentId });
    const idx = comments.value.findIndex((x) => x.commentId === tmpId);
    if (idx >= 0) comments.value[idx] = { ...comments.value[idx], ...created, _optimistic: false, likedByMe: false };
    cancelReply();
  } catch (e) {
    comments.value = comments.value.filter((x) => x.commentId !== tmpId);
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
    toast.error?.("답글 등록 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    replyBusy.value = false;
  }
}

async function onDeleteComment(c) {
  if (!confirm("댓글을 삭제할까요?")) return;
  try {
    await deleteComment(c.commentId);
    comments.value = comments.value.filter((x) => String(x.commentId) !== String(c.commentId));
    if (post.value) post.value.commentCount = Math.max(0, Number(post.value.commentCount ?? 0) - 1);
  } catch {
    toast.error?.("삭제 실패", "잠시 후 다시 시도해주세요.");
  }
}

async function toggleCommentLike(c) {
  const id = String(c.commentId);
  if (likeCommentBusy.value.has(id)) return;
  likeCommentBusy.value.add(id);
  const prevLiked = !!c.likedByMe;
  const prevCount = Number(c.likeCount ?? 0);
  c.likedByMe = !prevLiked;
  c.likeCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
  try {
    if (!prevLiked) await likeComment(c.commentId); else await unlikeComment(c.commentId);
  } catch {
    c.likedByMe = prevLiked;
    c.likeCount = prevCount;
    toast.error?.("댓글 좋아요 실패", "잠시 후 다시 시도해주세요.");
  } finally {
    likeCommentBusy.value.delete(id);
  }
}

function findMentionContext(value, cursorPos) {
  const before = value.slice(0, cursorPos);
  const m = before.match(/(^|\s)@([\w\d_\.\-]{0,20})$/);
  if (!m) return null;
  return { q: m[2] || "", atIndex: before.lastIndexOf("@") };
}
function closeMention() { mentionOpen.value = false; mentionQuery.value = ""; }
function onComposerInput(e) {
  const el = e.target;
  const pos = el.selectionStart ?? el.value.length;
  const ctx = findMentionContext(el.value, pos);
  if (!ctx) return closeMention();
  mentionOpen.value = true;
  mentionQuery.value = ctx.q || "";
  mentionActiveIndex.value = 0;
}
function applyMention(candidate, targetId = "commentComposerInput") {
  const el = document.getElementById(targetId);
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
function onComposerKeydown(e, submitFn, targetId = "commentComposerInput") {
  if (mentionOpen.value) {
    if (e.key === "ArrowDown") { e.preventDefault(); mentionActiveIndex.value = Math.min(mentionCandidates.value.length - 1, mentionActiveIndex.value + 1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mentionActiveIndex.value = Math.max(0, mentionActiveIndex.value - 1); return; }
    if (e.key === "Escape") { e.preventDefault(); closeMention(); return; }
    if (e.key === "Enter" && !e.shiftKey) {
      const c = mentionCandidates.value[mentionActiveIndex.value];
      if (c) { e.preventDefault(); applyMention(c, targetId); return; }
    }
  }
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  submitFn();
}

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

onMounted(() => {
  attachObserver();
  bindCommentSse();
  load();
});
onBeforeUnmount(() => {
  if (io) io.disconnect();
  if (sseOff) sseOff();
  clearTimeout(longPressTimer);
});
watch(() => route.params.postId, () => load());
watch(sortMode, () => loadCommentsFirst());
</script>

<template>
  <div class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>
      <div class="topCenter">
        <div class="topEyebrow">Post</div>
        <div class="topTitle">{{ detailShareMeta ? "액션 공유 상세" : "게시글" }}</div>
      </div>
      <div class="topRight">
        <RlButton v-if="isMinePost" size="sm" variant="soft" @click="onDeletePost">삭제</RlButton>
      </div>
    </div>

    <AsyncStatePanel
      v-if="loading"
      icon="⏳"
      title="게시글을 준비하는 중이에요"
      description="본문, 이미지, 댓글 액션 흐름을 준비하고 있어요."
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="게시글을 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="뒤로 가기"
      @primary="load"
      @secondary="() => router.back()"
    />
    <AsyncStatePanel
      v-else-if="!post"
      icon="🫥"
      title="게시글을 찾지 못했어요"
      description="삭제되었거나 접근 권한이 없을 수 있어요."
      primary-label="뒤로 가기"
      secondary-label="홈으로 이동"
      @primary="() => router.back()"
      @secondary="() => router.push('/home')"
    />

    <div v-else class="stack">
      <section class="card postCard">
        <div class="card-head">
          <div class="avatar"></div>
          <div class="meta">
            <div class="author">{{ post.authorName || "User" }}</div>
            <div class="submeta">
              <span class="badge">{{ fmtVisibility(post.visibility) }}</span>
              <span class="dot">·</span>
              <span class="time">{{ formatCreatedAt(post.createdAt) }}</span>
            </div>
          </div>
        </div>

        <div class="scanRow">
          <span v-for="chip in detailInsightChips" :key="chip" class="scanChip">{{ chip }}</span>
        </div>

        <section v-if="detailShareMeta" class="shareCard">
          <div class="shareCard__top">
            <div class="shareCard__eyebrow">{{ detailShareMeta.badge }}</div>
            <div v-if="detailShareMeta.state" class="shareCard__state">{{ detailShareMeta.state }}</div>
          </div>
          <div v-if="detailShareMeta.title" class="shareCard__title">{{ detailShareMeta.title }}</div>
          <div v-if="detailShareMeta.subtitle" class="shareCard__sub">{{ detailShareMeta.subtitle }}</div>
          <div v-if="detailShareMeta.chips?.length" class="shareChipRow">
            <span v-for="chip in detailShareMeta.chips" :key="chip" class="shareChip">{{ chip }}</span>
          </div>
        </section>

        <div v-if="detailBodyText" class="contentWrap" :class="{ 'contentWrap--share': detailShareMeta }">
          <div v-if="detailBodyLabel" class="contentLabel">{{ detailBodyLabel }}</div>
          <div class="content">{{ detailBodyText }}</div>
        </div>

        <div v-if="post.imageUrls?.length" class="media" :class="`media--${mediaLayout}`">
          <button
            v-if="mediaLayout === 'single'"
            class="heroShot"
            type="button"
            @click="openLightbox(0)"
          >
            <img :src="post.imageUrls[0]" alt="" />
          </button>

          <div v-else-if="mediaLayout === 'double'" class="doubleGrid">
            <button v-for="(url, i) in post.imageUrls" :key="url" class="gridShot" type="button" @click="openLightbox(i)">
              <img :src="url" alt="" />
            </button>
          </div>

          <div v-else class="carousel">
            <button
              v-if="post.imageUrls.length > 1"
              class="nav left"
              type="button"
              @click="$refs.carousel?.scrollBy({ left: -320, behavior: 'smooth' })"
            >‹</button>
            <div ref="carousel" class="track">
              <button v-for="(url, i) in post.imageUrls" :key="url" class="shot" type="button" @click="openLightbox(i)">
                <img :src="url" alt="" />
              </button>
            </div>
            <button
              v-if="post.imageUrls.length > 1"
              class="nav right"
              type="button"
              @click="$refs.carousel?.scrollBy({ left: 320, behavior: 'smooth' })"
            >›</button>
          </div>
        </div>

        <div class="footer">
          <button class="pill btn" :class="{ on: post.likedByMe, busy: likeBusy }" type="button" @click="toggleLike" :disabled="likeBusy">
            <span>{{ post.likedByMe ? "❤️" : "🤍" }}</span>
            <span>{{ post.likeCount ?? 0 }}</span>
          </button>
          <button class="pill btn" type="button" @click="focusComposer">💬 {{ post.commentCount ?? 0 }}</button>
          <div class="flowHint">{{ flowHintText }}</div>
        </div>
      </section>

      <section class="card comments" id="commentsTop">
        <div class="cHead">
          <div>
            <div class="cTitle">{{ commentsSectionTitle }}</div>
            <div class="cSub">{{ commentsSectionSub }}</div>
          </div>
          <div class="cControls">
            <button class="seg" :class="{ on: sortMode==='LATEST' }" @click="sortMode='LATEST'">최신</button>
            <button class="seg" :class="{ on: sortMode==='POPULAR' }" @click="sortMode='POPULAR'">인기</button>
          </div>
        </div>

        <button v-if="newCommentsCount>0" class="newBadge" type="button" @click="refreshNewComments">새 댓글 {{ newCommentsCount }}개</button>

        <AsyncStatePanel v-if="commentsLoading" icon="💬" title="댓글을 불러오는 중이에요" description="여기서 시작된 대화가 액션으로 이어질 수 있어요." tone="loading" :show-actions="false" />
        <div v-else-if="commentsError" class="cState err">{{ commentsError }}</div>
        <AsyncStatePanel v-else-if="commentsError" icon="⚠️" title="댓글을 불러오지 못했어요" :description="commentsError" tone="danger" primary-label="다시 시도" secondary-label="본문만 보기" @primary="() => loadComments({ reset: true })" @secondary="() => {}" />

        <div v-else-if="comments.length === 0" class="emptyCommentCard">
          <div class="emptyTitle">{{ detailShareMeta ? "이 액션의 첫 반응을 남겨보세요 ✨" : "첫 댓글로 흐름을 시작해보세요 ✨" }}</div>
          <div class="emptySub">{{ detailShareMeta ? "공유된 액션에 바로 맥락을 더하면 대화와 실제 행동으로 이어지기 더 쉬워져요." : "여기서 시작된 대화가 약속, 할일, 장소 액션으로 이어질 수 있어요." }}</div>
        </div>

        <TransitionGroup v-else name="c" tag="div" class="cList">
          <article
            v-for="node in commentTree"
            :key="node.item.commentId"
            class="cItem"
            :class="[{ optimistic: node.item._optimistic }, node.depth===1 ? 'depth1' : 'depth0']"
            @contextmenu.prevent="openActionSheet(node.item)"
            @touchstart.passive="onCommentTouchStart(node.item)"
            @touchend="onCommentTouchEnd"
            @touchcancel="onCommentTouchEnd"
          >
            <div class="cMeta">
              <div class="cNameRow">
                <div class="cName">{{ node.item.name || "User" }}</div>
                <div v-if="node.depth===1" class="replyBadge">답글</div>
              </div>
              <div class="cSubMeta">
                <span class="cHandle">@{{ node.item.handle || "handle" }}</span>
                <span class="dot">·</span>
                <span class="cTime">{{ formatCreatedAt(node.item.createdAt) }}</span>
              </div>
            </div>

            <div class="cContent">{{ node.item.content }}</div>

            <div class="cActionRow">
              <button class="cAct like" type="button" @click="toggleCommentLike(node.item)">
                {{ node.item.likedByMe ? "❤️" : "🤍" }} {{ node.item.likeCount ?? 0 }}
              </button>
              <button class="cAct" type="button" @click="startReply(node.item)">답글</button>
              <button class="cAct action" type="button" @click="openActionSheet(node.item)">액션</button>
              <button v-if="canDeleteComment(node.item)" class="cAct danger" type="button" @click="onDeleteComment(node.item)">삭제</button>
            </div>

            <div v-if="replyTo && String(replyTo.commentId)===String(node.item.commentId)" class="replyBox">
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
                  @keydown="onComposerKeydown($event, submitReply, 'replyInput')"
                  @input="onComposerInput"
                />
                <button class="replyBtn" type="button" @click="submitReply" :disabled="replyBusy">{{ replyBusy ? "…" : "등록" }}</button>
              </div>
            </div>
          </article>
        </TransitionGroup>

        <div ref="sentinelRef" class="cSentinel">
          <div v-if="commentsMoreLoading" class="cMoreHint">불러오는 중…</div>
          <div v-else-if="!commentsHasNext && comments.length > 0" class="cEnd">끝 ✨</div>
        </div>
      </section>
    </div>

    <div v-if="actionSheetFor" class="sheetBackdrop" @click="closeActionSheet">
      <div class="sheet" @click.stop>
        <div class="sheetTitle">이 댓글로 액션 만들기</div>
        <div class="sheetSub">대화방으로 가져가서 Dock에서 이어서 관리할 수 있어요.</div>
        <div class="sheetPreview">“{{ actionSheetFor.content }}”</div>
        <div class="sheetActions">
          <button class="sheetBtn" type="button" @click="createPendingAction('PROMISE', actionSheetFor)">📅 약속</button>
          <button class="sheetBtn" type="button" @click="createPendingAction('TODO', actionSheetFor)">✅ 할일</button>
          <button class="sheetBtn" type="button" @click="createPendingAction('PLACE', actionSheetFor)">📍 장소</button>
        </div>
        <button class="sheetClose" type="button" @click="closeActionSheet">닫기</button>
      </div>
    </div>

    <div class="composerBar">
      <div v-if="mentionOpen && mentionCandidates.length" class="mentionPopup">
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
        <div class="composerField">
          <textarea
            id="commentComposerInput"
            v-model="newComment"
            class="cInput"
            placeholder="댓글을 입력하세요… (Enter 전송 / Shift+Enter 줄바꿈)"
            maxlength="300"
            rows="1"
            @keydown="onComposerKeydown($event, submitComment)"
            @input="onComposerInput"
          />
          <div class="composerHint">@멘션 가능 · 댓글 → 액션 → 대화방 Dock 연결</div>
        </div>
        <button class="cBtn" type="button" @click="submitComment" :disabled="commentBusy">{{ commentBusy ? "…" : "등록" }}</button>
      </div>
    </div>

    <Lightbox v-if="lbOpen" :images="post?.imageUrls || []" :start-index="lbIndex" @close="lbOpen=false" />
  </div>
</template>

<style scoped>
.page{
  padding:14px 14px calc(128px + env(safe-area-inset-bottom));
  max-width:980px;
  margin:0 auto;
}
.topbar{
  position:sticky;
  top:0;
  z-index:60;
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
  padding:10px 0 14px;
  background:
    linear-gradient(180deg, color-mix(in oklab,var(--surface) 96%, rgba(9,14,30,.94)), color-mix(in oklab,var(--surface) 82%, transparent));
  backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(255,255,255,.06);
}
.topCenter{text-align:center;display:grid;gap:1px}
.topEyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.56)}
.topTitle{font-weight:950;letter-spacing:-.02em}
.topRight{display:flex;justify-content:end}
.stack{display:grid;gap:14px}
.state{text-align:center;padding:40px 10px}
.state-title{font-size:16px;font-weight:900}
.state-sub{margin-top:8px;font-size:13px;color:var(--muted)}
.card{
  padding:16px;
  border-radius:22px;
  border:1px solid color-mix(in oklab,var(--border) 88%, rgba(255,255,255,.08));
  background:
    linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)),
    color-mix(in oklab,var(--surface) 95%, rgba(8,12,26,.92));
  box-shadow:0 18px 46px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.04);
}
.postCard{padding-bottom:14px;overflow:hidden}
.card-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--success));opacity:.68;box-shadow:0 10px 24px rgba(0,0,0,.24)}
.meta{display:grid;gap:2px}
.author{font-weight:950;font-size:14px;color:rgba(255,255,255,.96)}
.submeta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.92);font-weight:900;font-size:11px}
.dot{opacity:.55}
.content{font-size:14px;line-height:1.58;white-space:pre-wrap;color:rgba(255,255,255,.96)}
.media{margin-top:12px;display:grid;gap:10px}
.media--double{margin-top:14px}
.heroShot,.gridShot,.shot{border:0;background:transparent;padding:0;cursor:pointer}
.heroShot{width:100%;aspect-ratio:16/10;border-radius:22px;overflow:hidden;border:1px solid var(--border);box-shadow:0 14px 30px rgba(0,0,0,.18)}
.heroShot img,.gridShot img{width:100%;height:100%;object-fit:cover;display:block}
.doubleGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.gridShot{width:100%;aspect-ratio:5/6;border-radius:22px;overflow:hidden;border:1px solid color-mix(in oklab,var(--border) 88%, rgba(255,255,255,.08));box-shadow:0 14px 30px rgba(0,0,0,.16)}
.carousel{position:relative}
.track{display:flex;gap:10px;overflow:auto;scroll-snap-type:x mandatory;padding-bottom:2px}
.track::-webkit-scrollbar{height:6px}
.track::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px}
.shot{border:0;background:transparent;padding:0;width:min(540px,86vw);aspect-ratio:4/3;border-radius:20px;overflow:hidden;border:1px solid var(--border);scroll-snap-align:start;box-shadow:0 14px 30px rgba(0,0,0,.18)}
.shot img{width:100%;height:100%;object-fit:cover;display:block}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.35);backdrop-filter:blur(10px);color:rgba(255,255,255,.9);font-size:22px;cursor:pointer}
.nav.left{left:8px}.nav.right{right:8px}

.scanRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:2px 0 14px;
}
.scanChip{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:7px 11px;
  border-radius:999px;
  background:rgba(99,102,241,.08);
  border:1px solid rgba(99,102,241,.14);
  color:#4338ca;
  font-size:12px;
  font-weight:700;
  letter-spacing:-.01em;
}
.shareCard{
  display:grid;
  gap:10px;
  padding:16px;
  border-radius:20px;
  background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.98));
  border:1px solid rgba(148,163,184,.18);
  box-shadow:0 14px 32px rgba(15,23,42,.06);
  margin-bottom:14px;
}
.shareCard__top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
}
.shareCard__eyebrow{
  font-size:12px;
  font-weight:800;
  color:#7c3aed;
  letter-spacing:.04em;
  text-transform:uppercase;
}
.shareCard__state{
  display:inline-flex;
  align-items:center;
  padding:7px 11px;
  border-radius:999px;
  background:rgba(124,58,237,.08);
  color:#6d28d9;
  font-size:12px;
  font-weight:700;
}
.shareCard__title{
  font-size:20px;
  font-weight:900;
  letter-spacing:-.03em;
  color:#111827;
}
.shareCard__sub{
  color:#475569;
  font-size:14px;
  line-height:1.5;
}
.shareChipRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.shareChip{
  display:inline-flex;
  align-items:center;
  padding:7px 10px;
  border-radius:999px;
  background:#fff;
  border:1px solid rgba(148,163,184,.2);
  color:#334155;
  font-size:12px;
  font-weight:700;
}
.contentWrap{
  display:grid;
  gap:8px;
}
.contentWrap--share{
  padding:14px 15px;
  border-radius:18px;
  background:#f8fafc;
  border:1px solid rgba(148,163,184,.16);
}
.contentLabel{
  font-size:12px;
  font-weight:800;
  letter-spacing:.02em;
  color:#7c3aed;
}

.footer{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;padding-top:2px}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--border);padding:6px 10px;border-radius:999px;background:color-mix(in oklab,var(--surface-2) 85%,transparent)}
.pill.btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pill.btn:disabled{opacity:.6;cursor:not-allowed}
.pill.btn.on{border-color:color-mix(in oklab,var(--danger) 45%,var(--border));color:var(--text)}
.flowHint{margin-left:auto;font-size:11.5px;color:rgba(255,255,255,.72);padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10)}
.comments{padding-bottom:94px;display:grid;gap:12px;background:linear-gradient(180deg, rgba(255,255,255,.032), rgba(255,255,255,.015)), color-mix(in oklab,var(--surface) 95%, rgba(8,12,26,.92))}
.cHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:2px}
.cTitle{font-weight:950;font-size:16px}
.cSub{font-size:12px;color:var(--muted);margin-top:3px}
.cControls{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.seg{height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.9);font-weight:900;cursor:pointer}
.seg.on{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.18)}
.newBadge{height:36px;width:fit-content;padding:0 13px;border-radius:999px;border:1px solid color-mix(in oklab,var(--accent) 38%, rgba(255,255,255,.12));background:color-mix(in oklab,var(--accent) 12%, rgba(255,255,255,.04));color:rgba(255,255,255,.96);font-weight:950;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.16)}
.cState{font-size:13px;color:var(--muted);text-align:center;padding:10px 0}
.cState.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.emptyCommentCard{padding:16px;border-radius:18px;border:1px dashed rgba(255,255,255,.10);background:rgba(255,255,255,.03)}
.emptyTitle{font-weight:950}
.emptySub{margin-top:6px;font-size:13px;color:rgba(255,255,255,.68);line-height:1.5}
.cList{display:grid;gap:10px}
.cItem{border:1px solid color-mix(in oklab,var(--border) 90%, rgba(255,255,255,.08));border-radius:18px;padding:13px;background:linear-gradient(180deg, rgba(255,255,255,.042), rgba(255,255,255,.02));box-shadow:0 12px 30px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.03)}
.cItem.optimistic{opacity:.75}
.cItem.depth1{margin-left:16px;border-left:2px solid rgba(255,255,255,.12);padding-left:14px;background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.012))}
.cMeta{display:grid;gap:4px}
.cNameRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cName{font-weight:950;font-size:13px;color:rgba(255,255,255,.96)}
.replyBadge{padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);font-size:11px;font-weight:900;color:rgba(255,255,255,.82)}
.cSubMeta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cHandle,.cTime{font-size:12px;color:var(--muted)}
.cContent{margin-top:8px;font-size:13.5px;line-height:1.52;white-space:pre-wrap;color:rgba(255,255,255,.95)}
.cActionRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.cAct{height:34px;padding:0 12px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.94);font-weight:900;cursor:pointer}
.cAct.like{min-width:72px}
.cAct.action{border-color:color-mix(in oklab,var(--accent) 36%, rgba(255,255,255,.12));background:color-mix(in oklab,var(--accent) 10%, rgba(255,255,255,.03))}
.cAct.danger{border-color:color-mix(in oklab,var(--danger) 45%,rgba(255,255,255,.12))}
.replyBox{margin-top:10px;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:10px;background:rgba(255,255,255,.04)}
.replyTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
.replyTo{font-size:12px;font-weight:900;opacity:.85}
.replyCancel{border:0;background:transparent;color:rgba(255,255,255,.8);font-weight:900;cursor:pointer}
.replyRow{margin-top:8px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
.replyInput{min-height:40px;max-height:120px;resize:none;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);padding:10px 11px;color:var(--text);line-height:1.35}
.replyBtn{height:40px;padding:0 12px;border-radius:14px;border:1px solid color-mix(in oklab,var(--accent) 45%,rgba(255,255,255,.12));background:color-mix(in oklab,var(--accent) 16%,transparent);font-weight:950;color:var(--text)}
.replyBtn:disabled{opacity:.6}
.cSentinel{display:grid;place-items:center;padding:10px 0 2px}
.cMoreHint{opacity:.75;font-size:12px}.cEnd{font-size:12px;color:var(--muted)}
.sheetBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(4px);z-index:90;display:grid;place-items:end center;padding:16px}
.sheet{width:min(520px,100%);border-radius:22px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,22,.94);padding:14px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.sheetTitle{font-size:16px;font-weight:950}
.sheetSub{margin-top:4px;font-size:12px;opacity:.72}
.sheetPreview{margin-top:10px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);font-size:13px;line-height:1.45;color:rgba(255,255,255,.92)}
.sheetActions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.sheetBtn{height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.95);font-weight:950;cursor:pointer}
.sheetClose{margin-top:10px;width:100%;height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:transparent;color:rgba(255,255,255,.88);font-weight:900}
.composerBar{position:fixed;left:0;right:0;bottom:0;z-index:80;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(to bottom,color-mix(in oklab,var(--bg) 0%,transparent),color-mix(in oklab,var(--bg) 96%,transparent));backdrop-filter:blur(18px);border-top:1px solid rgba(255,255,255,.08)}
.composerInner{max-width:980px;margin:0 auto;display:grid;grid-template-columns:1fr;gap:10px;align-items:end;padding:8px;border:1px solid rgba(255,255,255,.10);border-radius:20px;background:rgba(7,12,28,.78);box-shadow:0 12px 34px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.03)}
.composerField{display:grid;gap:6px}
.cInput{min-height:46px;max-height:120px;resize:none;border-radius:16px;border:1px solid var(--border);background:color-mix(in oklab,var(--surface-2) 88%,transparent);padding:11px 12px;color:var(--text);line-height:1.35}
.composerHint{font-size:11.5px;color:rgba(255,255,255,.62);padding:0 2px}
.cBtn{height:42px;min-width:0;width:100%;padding:0 18px;border-radius:16px;border:1px solid color-mix(in oklab,var(--accent) 45%,var(--border));background:color-mix(in oklab,var(--accent) 16%,transparent);font-weight:950;color:var(--text);font-size:14px}
.cBtn:disabled{opacity:.6}
.mentionPopup{position:fixed;left:14px;right:14px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:90;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,22,.92);backdrop-filter:blur(16px);padding:6px;box-shadow:0 16px 40px rgba(0,0,0,.35);max-width:980px;margin:0 auto}
.mentionItem{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border-radius:12px;border:0;background:transparent;color:rgba(255,255,255,.92);cursor:pointer}
.mentionItem.on{background:rgba(255,255,255,.10)}
.mh{font-weight:950}.mn{opacity:.7;font-size:12px}
.c-enter-active,.c-leave-active{transition:all .22s ease}
.c-enter-from{opacity:0;transform:translateY(6px) scale(.98)}
.c-leave-to{opacity:0;transform:translateY(-6px) scale(.98)}
@media (max-width:700px){
  .flowHint{width:100%;margin-left:0}
  .doubleGrid{grid-template-columns:1fr}
  .gridShot{aspect-ratio:4/3}
}
@media (min-width:1280px){
  .composerInner{grid-template-columns:minmax(0,1fr) auto;align-items:center}
  .cBtn{width:auto;min-width:90px;justify-self:auto}
}

@media (max-width:520px){
  .page{padding-left:12px;padding-right:12px;padding-bottom:calc(142px + env(safe-area-inset-bottom))}
  .shareCard{padding:14px;border-radius:18px}
  .shareCard__title{font-size:18px}
  .scanRow{margin-bottom:12px}
  .shot{width:88vw}
  .card{padding:13px}
  .cHead{align-items:stretch;flex-direction:column}
  .cControls{justify-content:flex-start}
  .cItem.depth1{margin-left:12px;padding-left:12px}
  .replyRow{grid-template-columns:1fr}
  .composerHint{font-size:11px}
  .sheetActions{grid-template-columns:1fr}
}
</style>
