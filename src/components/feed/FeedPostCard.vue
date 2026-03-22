<!-- src/components/feed/FeedPostCard.vue -->
<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useToastStore } from "../../stores/toast";
import MediaLightbox from "../media/MediaLightbox.vue";
import { normalizePostMediaItems } from "@/lib/mediaModel";

const props = defineProps({
  post: { type: Object, required: true },
});

const emit = defineEmits(["like"]);

const router = useRouter();
const toast = useToastStore();

const mediaItems = computed(() => {
  const p = props.post || {};
  if (Array.isArray(p.mediaItems) && p.mediaItems.length) return p.mediaItems;
  const fallback = p.imageUrls || p.images || [];
  return Array.isArray(fallback) ? fallback.map((url) => ({ mediaType: "IMAGE", url, thumbnailUrl: url })) : [];
});

const normalizedMediaItems = computed(() => normalizePostMediaItems(mediaItems.value).filter((m) => !!m.url && m.kind !== "file"));
const images = computed(() => normalizedMediaItems.value.filter((m) => m.kind === "image").map((m) => m.url || m.thumbnailUrl).filter(Boolean));
const firstVideo = computed(() => normalizedMediaItems.value.find((m) => m.kind === "video") || null);

const previewComments = computed(() => {
  const p = props.post || {};
  const list = p.previewComments || p.recentComments || p.commentPreviews || [];
  if (!Array.isArray(list)) return [];
  return list.slice(0, 2);
});

const visBadge = computed(() => {
  const v = String(props.post?.visibility || "PUBLIC").toUpperCase();
  if (v.includes("PRIVATE") || v === "ME") return { icon: "🔒", label: "나만" };
  if (v.includes("FOLLOW") || v.includes("FRIEND")) return { icon: "👥", label: "친구" };
  return { icon: "🌐", label: "공개" };
});

const mediaBadge = computed(() => {
  const count = images.value.length;
  if (count <= 1) return "";
  return `${count}장`;
});

const mediaViewerOpen = ref(false);
const mediaViewerIndex = ref(0);
const slide = ref(0);
const dragging = ref(false);
let startX = 0;
let startY = 0;

const hasMany = computed(() => images.value.length > 1);
const visibleImages = computed(() => images.value.slice(0, 8));

function openDetail() {
  const id = props.post?.postId;
  if (!id) return;
  router.push(`/posts/${id}`);
}

function fmtTime(t) {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${mi}`;
}

const likeBump = ref(false);
const burst = ref(false);

function triggerLikeFX() {
  likeBump.value = true;
  burst.value = true;
  setTimeout(() => (likeBump.value = false), 220);
  setTimeout(() => (burst.value = false), 520);
}

function likeIfNeeded() {
  if (props.post?.likedByMe) {
    triggerLikeFX();
    return;
  }
  triggerLikeFX();
  emit("like", props.post);
}

function onLike(e) {
  e?.stopPropagation?.();
  triggerLikeFX();
  emit("like", props.post);
}

let lastTapAt = 0;
function onMediaTap(e) {
  if (!visibleImages.value.length) return;
  const now = Date.now();
  if (now - lastTapAt < 280) {
    e?.stopPropagation?.();
    likeIfNeeded();
    lastTapAt = 0;
    return;
  }
  lastTapAt = now;
}

function openMediaViewerByIndex(i, e) {
  e?.stopPropagation?.();
  mediaViewerIndex.value = Math.max(0, Math.min(i || 0, normalizedMediaItems.value.length - 1));
  mediaViewerOpen.value = true;
}

function openImageViewer(imageIndex, e) {
  const target = images.value[imageIndex];
  const mediaIndex = normalizedMediaItems.value.findIndex((m) => m.kind === "image" && (m.url === target || m.thumbnailUrl === target));
  openMediaViewerByIndex(mediaIndex >= 0 ? mediaIndex : 0, e);
}

function openVideoViewer(e) {
  const mediaIndex = normalizedMediaItems.value.findIndex((m) => m.kind === "video");
  openMediaViewerByIndex(mediaIndex >= 0 ? mediaIndex : 0, e);
}

function onPointerDown(e) {
  if (!hasMany.value) return;
  dragging.value = true;
  startX = e.clientX;
  startY = e.clientY;
}
function onPointerUp(e) {
  if (!hasMany.value || !dragging.value) return;
  dragging.value = false;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) nextSlide();
    else prevSlide();
  }
}
function prevSlide() {
  slide.value = Math.max(0, slide.value - 1);
}
function nextSlide() {
  slide.value = Math.min(visibleImages.value.length - 1, slide.value + 1);
}

async function sharePost(e) {
  e?.stopPropagation?.();
  const id = props.post?.postId;
  if (!id) return;

  const url = `${location.origin}/posts/${id}`;
  const title = "RealLife";
  const text = props.post?.content ? String(props.post.content).slice(0, 80) : "게시글";

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      toast.success?.("공유됨", "공유가 완료됐어요.");
      return;
    }
  } catch {}

  try {
    await navigator.clipboard.writeText(url);
    toast.success?.("링크 복사", "클립보드에 복사했어요.");
  } catch {
    toast.error?.("공유 실패", "복사에 실패했어요.");
  }
}

function isActionSharePost(post) {
  if (post?.sourceMeta) return true;
  return String(post?.content || "").includes("#RealLife");
}

function normalizedLines(post) {
  return String(post?.content || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
}

function stripLeadingEmojiTitle(line) {
  return String(line || "")
      .replace(/^[\u{1F300}-\u{1FAFF}\uFE0F\u200D]+\s*/u, "")
      .trim();
}

function normalizeActionState(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (["DONE", "COMPLETED", "완료", "완료됨"].includes(s)) return "DONE";
  if (["CANCELED", "CANCELLED", "취소", "취소됨"].includes(s)) return "CANCELED";
  if (["ACTIVE", "PENDING", "SCHEDULED", "예정", "예정됨", "진행 준비"].includes(s)) return "ACTIVE";
  return "";
}

function actionStateLabel(raw) {
  const normalized = normalizeActionState(raw);
  if (normalized === "DONE") return "완료";
  if (normalized === "CANCELED") return "취소";
  if (normalized === "ACTIVE") return "예정";
  return String(raw || "").trim();
}

function actionStateTone(raw) {
  const normalized = normalizeActionState(raw);
  if (normalized === "DONE") return "done";
  if (normalized === "CANCELED") return "cancelled";
  if (normalized === "ACTIVE") return "pending";
  return "neutral";
}

function inferKindLabel(title) {
  const s = String(title || "");
  if (!s) return "액션";
  if (/(약속|만나|미팅|식사|데이트|모임|약속잡)/.test(s)) return "약속";
  if (/(할일|해야|작업|업무|정리|구매|체크|예약|준비|제출)/.test(s)) return "할일";
  if (/(장소|가자|방문|성수|역|카페|공원|식당|주소|출구)/.test(s)) return "장소";
  return "액션";
}

function kindTone(kind) {
  const v = String(kind || "").trim();
  if (v === "약속") return "promise";
  if (v === "할일") return "todo";
  if (v === "장소") return "place";
  return "neutral";
}

function fallbackActionMetaFromContent(post) {
  const lines = normalizedLines(post).filter((line) => line !== "#RealLife");
  if (!lines.length) return null;

  const first = lines[0] || "";
  const title = stripLeadingEmojiTitle(first);

  let time = "";
  let place = "";
  let remindAt = "";

  for (const line of lines.slice(1)) {
    if (line.startsWith("🕒")) time = line.replace(/^🕒\s*/, "").trim();
    else if (line.startsWith("📍")) place = line.replace(/^📍\s*/, "").trim();
    else if (line.startsWith("⏰")) remindAt = line.replace(/^⏰\s*/, "").trim();
  }

  const kind = inferKindLabel(title);
  const subtitle = [kind, place].filter(Boolean).join(" · ");
  const description = [time, place].filter(Boolean).join(" · ");

  const chips = [];
  if (time) chips.push(`🕒 ${time}`);
  if (place) chips.push(`📍 ${place}`);
  if (remindAt && remindAt !== "리마인드 없음") chips.push(`⏰ ${remindAt}`);

  return {
    badge: "액션 공유",
    title,
    subtitle: subtitle || description || "",
    kind,
    state: remindAt ? "리마인더 설정됨" : kind,
    chips: chips.slice(0, 3),
  };
}

const actionShareMeta = computed(() => {
  const meta = props.post?.sourceMeta || null;
  if (meta) {
    const chips = [];

    if (Array.isArray(meta.chips) && meta.chips.length) {
      chips.push(...meta.chips.filter(Boolean).map((v) => String(v).trim()));
    } else {
      if (meta.time) chips.push(`🕒 ${meta.time}`);
      if (meta.place) chips.push(`📍 ${meta.place}`);
      if (meta.remindAt) chips.push(`⏰ ${meta.remindAt}`);
    }

    const kind = meta.kind || meta.type || inferKindLabel(meta.title || meta.subtitle || "");
    return {
      badge: meta.badge || "액션 공유",
      title: meta.title || "",
      subtitle: meta.subtitle || meta.description || "",
      kind: inferKindLabel(kind),
      state: actionStateLabel(meta.status || meta.state || ""),
      chips: chips.slice(0, 3),
    };
  }

  if (!isActionSharePost(props.post)) return null;
  return fallbackActionMetaFromContent(props.post);
});

const actionKindTone = computed(() => kindTone(actionShareMeta.value?.kind || ""));
const actionKindLabel = computed(() => actionShareMeta.value?.kind || "");

const shareComment = computed(() => {
  if (!actionShareMeta.value) return "";
  const lines = normalizedLines(props.post);
  if (!lines.length) return "";

  const cleaned = [];
  let skippedTitle = false;

  for (const line of lines) {
    if (line === "#RealLife") continue;
    if (/^[🕒📍⏰]/u.test(line)) continue;

    const normalizedTitle = stripLeadingEmojiTitle(line);
    const title = stripLeadingEmojiTitle(actionShareMeta.value?.title || "");
    if (!skippedTitle && normalizedTitle && title && normalizedTitle === title) {
      skippedTitle = true;
      continue;
    }

    cleaned.push(line);
  }

  const text = cleaned.join(" ").replace(/\s+/g, " ").trim();
  return text.slice(0, 160);
});

const bodyText = computed(() => {
  if (actionShareMeta.value) return shareComment.value;
  return String(props.post?.content || "").trim();
});

const bodyPreview = computed(() => {
  const text = bodyText.value;
  if (!text) return "";
  if (text.length <= 160) return text;
  return `${text.slice(0, 160)}…`;
});

const bodyLabel = computed(() => {
  if (!actionShareMeta.value) return "";
  return shareComment.value ? "이렇게 덧붙였어요" : "공유 코멘트 없음";
});

const engagementStrip = computed(() => {
  const likeCount = Number(props.post?.likeCount || 0);
  const commentCount = Number(props.post?.commentCount || 0);
  const parts = [];

  if (actionShareMeta.value) parts.push("액션 카드 공유됨");
  if (commentCount <= 0) parts.push("첫 댓글로 대화 시작 가능");
  else if (commentCount === 1) parts.push("댓글 1개 · 바로 이어보기 좋아요");
  else parts.push(`댓글 ${commentCount}개 · 대화가 이어지는 중`);

  if (likeCount > 0) parts.push(`좋아요 ${likeCount}`);
  return parts.join(" · ");
});

const commentPreviewTitle = computed(() => {
  if (actionShareMeta.value) return "이 액션에서 이어진 대화";
  return "최근 댓글";
});

const insightHeadline = computed(() => {
  if (actionShareMeta.value) {
    if (Number(props.post?.commentCount || 0) > 0) return "지금 이 액션에서 대화가 이어지고 있어요";
    if (actionShareMeta.value?.state) return `${actionShareMeta.value.state} 상태의 액션 공유예요`;
    return "액션 카드가 피드로 공유됐어요";
  }
  if (Number(props.post?.commentCount || 0) > 0) return "댓글이 달려서 바로 이어가기 좋아요";
  if (images.value.length > 0) return "사진과 함께 올라온 최근 순간이에요";
  return "첫 반응이 달리면 대화로 이어지기 쉬운 글이에요";
});

const insightSubline = computed(() => {
  if (actionShareMeta.value) {
    if (shareComment.value) return "카드 정보와 덧붙인 코멘트를 분리해서 읽기 쉽게 정리했어요.";
    return "댓글을 남기면 약속, 할 일, 장소 흐름으로 다시 이어갈 수 있어요.";
  }
  if (Number(props.post?.commentCount || 0) > 0) return "게시글을 열면 최근 댓글과 다음 액션 흐름을 같이 볼 수 있어요.";
  return "가볍게 댓글을 달아 대화를 시작하거나 저장해 두고 다시 볼 수 있어요.";
});

const commentActionLabel = computed(() => {
  if (actionShareMeta.value) return "대화 보기";
  if (Number(props.post?.commentCount || 0) > 0) return "댓글 보기";
  return "댓글 열기";
});

const detailActionLabel = computed(() => {
  if (actionShareMeta.value) return "액션 이어보기";
  if (Number(props.post?.commentCount || 0) > 0) return "흐름 이어보기";
  return "게시글 보기";
});
</script>

<template>
  <article class="card" role="article" @click="openDetail">
    <div v-if="firstVideo" class="videoHero" @click.stop="openVideoViewer">
      <video
          class="videoHero__player"
          @click.stop="openVideoViewer"
          :src="firstVideo?.url || ''"
          :poster="firstVideo?.thumbnailUrl || ''"
          controls
          playsinline
          muted
          preload="metadata"
      ></video>
      <div class="videoHero__badge">VIDEO</div>
    </div>

    <div class="head">
      <div class="avatar"></div>

      <div class="meta">
        <div class="authorRow">
          <div class="author">{{ post.authorName || "User" }}</div>
          <div class="handle">@{{ post.authorHandle || post.authorUsername || "handle" }}</div>
          <div class="dot">·</div>
          <div class="time">{{ fmtTime(post.createdAt || post.createdDateTime) }}</div>
        </div>

        <div class="subRow">
          <span class="badge" :title="post.visibility || 'PUBLIC'">
            <span class="bIco">{{ visBadge.icon }}</span>
            <span class="bTxt">{{ visBadge.label }}</span>
          </span>
          <span v-if="mediaBadge" class="badge badge--media">{{ mediaBadge }}</span>
          <span v-if="actionShareMeta" class="badge badge--actionShare">{{ actionShareMeta.badge }}</span>
        </div>
      </div>
    </div>

    <section
        v-if="actionShareMeta && (actionShareMeta.title || actionShareMeta.subtitle || actionShareMeta.state || actionShareMeta.chips.length)"
        class="shareCard"
    >
      <div class="shareCard__top">
        <div class="shareCard__icon">✨</div>

        <div class="shareCard__body">
          <div class="shareCard__labels">
            <span
                v-if="actionKindLabel"
                class="actionKind"
                :data-tone="actionKindTone"
            >
              {{ actionKindLabel }}
            </span>

            <div
                v-if="actionShareMeta.state"
                class="shareCard__state shareCard__state--mobile"
                :data-tone="actionStateTone(actionShareMeta.state)"
            >
              {{ actionShareMeta.state }}
            </div>
          </div>

          <div v-if="actionShareMeta.title" class="shareCard__title">{{ actionShareMeta.title }}</div>
          <div v-if="actionShareMeta.subtitle" class="shareCard__sub">{{ actionShareMeta.subtitle }}</div>
        </div>

        <div
            v-if="actionShareMeta.state"
            class="shareCard__state shareCard__state--desktop"
            :data-tone="actionStateTone(actionShareMeta.state)"
        >
          {{ actionShareMeta.state }}
        </div>
      </div>

      <div v-if="actionShareMeta.chips.length" class="actionMetaBar">
        <span v-for="chip in actionShareMeta.chips" :key="chip" class="actionMetaChip">{{ chip }}</span>
      </div>
    </section>

    <section v-if="bodyLabel || bodyPreview" class="bodyCard" :class="{ 'bodyCard--share': actionShareMeta }">
      <div v-if="bodyLabel" class="bodyCard__label">{{ bodyLabel }}</div>
      <div v-if="bodyPreview" class="content">{{ bodyPreview }}</div>
      <div v-else-if="actionShareMeta" class="bodyCard__empty">액션 카드만 간단하게 공유했어요. 댓글로 바로 이어가도 좋아요.</div>
    </section>

    <div
        v-if="visibleImages.length"
        class="mediaSlider"
        @click.stop="onMediaTap"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
    >
      <div class="track" :style="{ transform: `translateX(${-slide * 100}%)` }">
        <button
            v-for="(u, idx) in visibleImages"
            :key="idx"
            class="slide"
            type="button"
            @click.stop="openImageViewer(idx, $event)"
            :aria-label="`이미지 ${idx + 1} 확대`"
        >
          <img class="img" :src="u" alt="post image" loading="lazy" decoding="async" />
        </button>
      </div>

      <div v-if="visibleImages.length > 1" class="dots" aria-hidden="true">
        <span v-for="(_, i) in visibleImages.length" :key="i" class="dot" :class="{ on: i === slide }"></span>
      </div>

      <div class="heartBurst" :class="{ on: burst }" aria-hidden="true">❤</div>

      <div class="mediaTopMeta">
        <span class="mediaPill">{{ slide + 1 }} / {{ visibleImages.length }}</span>
        <button class="zoomBtn" type="button" @click.stop="openImageViewer(slide, $event)" aria-label="이미지 크게 보기">⌕</button>
        <span v-if="visibleImages.length > 1" class="mediaPill mediaPill--soft">스와이프</span>
      </div>

      <button v-if="visibleImages.length > 1" class="nav left" type="button" @click.stop="prevSlide" aria-label="이전">‹</button>
      <button v-if="visibleImages.length > 1" class="nav right" type="button" @click.stop="nextSlide" aria-label="다음">›</button>
    </div>

    <div class="flowBar">
      <span class="flowDot"></span>
      <span>{{ engagementStrip }}</span>
    </div>

    <div class="insightPanel">
      <div class="insightLine">
        <span class="insightLabel">지금 포인트</span>
        <strong>{{ insightHeadline }}</strong>
      </div>
      <div class="insightLine">
        <span class="insightLabel">이어가기</span>
        <span class="insightText">{{ insightSubline }}</span>
      </div>
    </div>

    <div v-if="previewComments.length" class="commentPreview" @click.stop="openDetail">
      <div class="commentPreview__title">{{ commentPreviewTitle }}</div>
      <div v-for="(c, idx) in previewComments" :key="idx" class="cRow">
        <span class="cAuthor">{{ c.authorName || c.author || "user" }}</span>
        <span class="cText">{{ c.content || c.text || "" }}</span>
      </div>
      <div class="cMore">게시글 열고 이어보기</div>
    </div>

    <div class="actions" @click.stop>
      <button class="act" :class="{ bump: likeBump }" type="button" :data-on="post.likedByMe" @click="onLike">
        <span class="ico">❤</span>
        <span class="num">{{ Number(post.likeCount ?? 0) }}</span>
      </button>

      <button class="act" type="button" @click="openDetail">
        <span class="ico">💬</span>
        <span class="num">{{ Number(post.commentCount ?? 0) }}</span>
        <span>{{ commentActionLabel }}</span>
      </button>

      <button class="act act--strong" type="button" @click="openDetail">
        <span class="ico">↗</span>
        <span class="num">{{ detailActionLabel }}</span>
      </button>

      <button class="act act--ghost" type="button" @click="sharePost">
        <span class="ico">⤴</span>
        <span class="num">공유</span>
      </button>
    </div>

    <MediaLightbox
        v-if="mediaViewerOpen && normalizedMediaItems.length"
        :items="normalizedMediaItems"
        :start-index="mediaViewerIndex"
        @close="mediaViewerOpen = false"
    />
  </article>
</template>

<style scoped>
.card{
  min-height:372px;
  display:flex;
  flex-direction:column;
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.035));
  border-radius: 20px;
  padding: 14px;
  cursor: pointer;
  transition: transform .15s ease, background .15s ease, border-color .18s ease, box-shadow .18s ease;
  max-width: 100%;
  overflow: hidden;
  box-shadow: 0 14px 40px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.03);
}
.card:hover{
  transform: translateY(-1px);
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.04));
  border-color: rgba(255,255,255,.14);
}

.head{ display:flex; gap: 10px; align-items: flex-start; }
.avatar{
  width: 38px; height: 38px; border-radius: 14px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.22), transparent 50%), linear-gradient(135deg, rgba(139,92,246,.44), rgba(45,212,191,.44));
  flex: 0 0 auto;
}
.meta{ flex: 1; min-width: 0; }
.authorRow{ display:flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.author{ font-weight: 900; }
.handle, .time, .dot{ opacity: .7; font-size: 12px; }
.dot{ margin: 0 2px; }
.subRow{ margin-top: 6px; display:flex; gap:6px; flex-wrap:wrap; }

.badge{
  display:inline-flex; align-items:center; gap: 6px;
  height: 22px; padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  font-size: 11px;
  font-weight: 900;
  opacity: .9;
}
.badge--media{
  background: color-mix(in oklab, var(--accent) 12%, rgba(255,255,255,.05));
}
.badge--actionShare{
  background: color-mix(in oklab,var(--accent) 18%, rgba(255,255,255,.05));
  border-color: color-mix(in oklab,var(--accent) 34%, rgba(255,255,255,.12));
}
.bIco{ font-size: 12px; }
.bTxt{ letter-spacing: -0.01em; }

.shareCard{
  margin-top: 10px;
  border: 1px solid color-mix(in oklab, var(--accent) 28%, rgba(255,255,255,.12));
  background:
      linear-gradient(180deg, color-mix(in oklab, var(--accent) 12%, transparent), rgba(255,255,255,.02));
  border-radius: 18px;
  padding: 12px;
}
.shareCard__top{
  display:flex;
  gap:10px;
  align-items:flex-start;
}
.shareCard__icon{
  width:32px;
  height:32px;
  border-radius:12px;
  display:grid;
  place-items:center;
  background: color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.04));
  border: 1px solid rgba(255,255,255,.10);
  flex: 0 0 auto;
}
.shareCard__body{
  flex:1;
  min-width:0;
}
.shareCard__labels{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  margin-bottom:6px;
}
.shareCard__title{
  font-size:15px;
  font-weight:950;
  color: rgba(255,255,255,.96);
  line-height:1.35;
}
.shareCard__sub{
  margin-top:4px;
  font-size:12.5px;
  color: rgba(255,255,255,.72);
  line-height:1.45;
}
.shareCard__state{
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  font-size: 11px;
  font-weight: 900;
  color: rgba(255,255,255,.86);
  white-space: nowrap;
}
.shareCard__state--mobile{ display:none; }

.actionKind{
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.05);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  color: rgba(255,255,255,.92);
}
.actionKind[data-tone="promise"]{
  border-color: rgba(110, 156, 255, .28);
  background: rgba(82, 127, 255, .16);
  color: #cfe0ff;
}
.actionKind[data-tone="todo"]{
  border-color: rgba(255, 212, 102, .26);
  background: rgba(255, 212, 102, .14);
  color: #ffe8a3;
}
.actionKind[data-tone="place"]{
  border-color: rgba(77, 208, 164, .26);
  background: rgba(77, 208, 164, .14);
  color: #c9f7e9;
}

.shareCard__state[data-tone="pending"]{
  border-color: color-mix(in oklab, var(--warning) 42%, rgba(255,255,255,.12));
  background: color-mix(in oklab, var(--warning) 20%, rgba(255,255,255,.05));
  color: color-mix(in oklab, var(--warning) 78%, white);
}
.shareCard__state[data-tone="done"]{
  border-color: color-mix(in oklab, var(--success) 44%, rgba(255,255,255,.12));
  background: color-mix(in oklab, var(--success) 20%, rgba(255,255,255,.05));
  color: color-mix(in oklab, var(--success) 78%, white);
}
.shareCard__state[data-tone="cancelled"]{
  border-color: color-mix(in oklab, var(--danger) 44%, rgba(255,255,255,.12));
  background: color-mix(in oklab, var(--danger) 20%, rgba(255,255,255,.05));
  color: color-mix(in oklab, var(--danger) 78%, white);
}

.bodyCard{
  margin-top: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.032);
  padding: 11px 12px;
}
.bodyCard--share{
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.028));
}
.bodyCard__label{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .06em;
  color: rgba(255,255,255,.58);
  text-transform: uppercase;
}
.bodyCard__empty{
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255,255,255,.68);
}
.content{
  margin-top: 6px;
  display:-webkit-box;
  -webkit-line-clamp:4;
  -webkit-box-orient:vertical;
  overflow:hidden;
  white-space: pre-wrap;
  line-height: 1.58;
  color: rgba(255,255,255,.94);
  font-size: 14px;
  min-height: calc(1.58em * 2);
}

.actionMetaBar{
  margin-top:10px;
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}
.actionMetaChip{
  display:inline-flex;
  align-items:center;
  min-height:24px;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  font-size:11px;
  font-weight:900;
  color:rgba(255,255,255,.82);
}

.mediaSlider{
  margin-top: 10px;
  position: relative;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  overflow: hidden;
  user-select: none;
  touch-action: pan-y;
}
.track{ display:flex; width: 100%; transition: transform .28s cubic-bezier(.2,.9,.2,1); }
.slide{ flex: 0 0 100%; border: 0; background: transparent; padding: 0; cursor: zoom-in; }
.img{
  width: 100%;
  display:block;
  object-fit: cover;
  aspect-ratio: 16 / 18;
  max-height: 680px;
  background: rgba(255,255,255,.04);
}

.dots{
  position:absolute; left: 50%; transform: translateX(-50%); bottom: 10px;
  display:flex; gap: 6px; padding: 6px 10px; border-radius: 999px;
  background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.10); backdrop-filter: blur(10px);
}
.dots .dot{ width: 6px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.35); }
.dots .dot.on{ background: rgba(255,255,255,.92); }

.mediaTopMeta{
  position:absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display:flex;
  justify-content:space-between;
  gap:8px;
  pointer-events:none;
}
.mediaTopMeta > *{ pointer-events:auto; }

.zoomBtn{
  width:32px;
  height:32px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.28);
  color:rgba(255,255,255,.94);
  font-size:16px;
  font-weight:900;
  cursor:pointer;
  backdrop-filter:blur(10px);
  display:inline-flex;
  align-items:center;
  justify-content:center;
}

.mediaPill{
  display:inline-flex;
  align-items:center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.28);
  border: 1px solid rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  font-size: 11px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}
.mediaPill--soft{ opacity: .82; }

.nav{
  position:absolute; top: 50%; transform: translateY(-50%);
  width: 42px; height: 42px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.20);
  color: rgba(255,255,255,.92); font-size: 24px; font-weight: 900; cursor:pointer; backdrop-filter: blur(10px);
}
.left{ left: 10px; }
.right{ right: 10px; }

.heartBurst{
  position:absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(.2);
  opacity: 0; font-size: 64px; text-shadow: 0 12px 40px rgba(0,0,0,.5);
  transition: transform .26s cubic-bezier(.2,1,.2,1), opacity .26s ease; pointer-events: none;
}
.heartBurst.on{ opacity: 1; transform: translate(-50%, -50%) scale(1); animation: burstOut .52s ease forwards; }
@keyframes burstOut{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(.2); }
  35%{ opacity: 1; transform: translate(-50%,-52%) scale(1.05); }
  100%{ opacity: 0; transform: translate(-50%,-58%) scale(1.22); }
}

.videoHero{
  margin-top: 10px;
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.28);
  isolation: isolate;
}
.videoHero__player{
  display:block;
  width:100%;
  max-width:100%;
  aspect-ratio: 9 / 16;
  max-height: min(68dvh, 640px);
  object-fit: cover;
  background: #05070d;
}
.videoHero__badge{
  position:absolute;
  left:10px;
  top:10px;
  min-height:28px;
  padding:0 10px;
  display:inline-flex;
  align-items:center;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(0,0,0,.34);
  color:rgba(255,255,255,.94);
  font-size:11px;
  font-weight:900;
  letter-spacing:.06em;
  backdrop-filter: blur(12px);
}

.flowBar{
  margin-top: 10px;
  min-height: 34px;
  display:flex;
  align-items:center;
  gap:8px;
  padding: 0 11px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.035);
  font-size: 12px;
  color: rgba(255,255,255,.76);
}
.insightPanel{
  margin-top:10px;
  display:grid;
  gap:8px;
  padding:11px 12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.08);
  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.025));
}
.insightLine{display:grid;gap:4px;}
.insightLabel{font-size:11px;font-weight:900;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.05em;}
.insightLine strong{font-size:13px;line-height:1.45;color:rgba(255,255,255,.94);}
.insightText{font-size:12px;line-height:1.5;color:rgba(255,255,255,.76);}
.flowDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 80%, white);
  box-shadow: 0 0 0 5px color-mix(in oklab, var(--accent) 20%, transparent);
}

.commentPreview{
  margin-top: 10px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  border-radius: 14px;
  padding: 10px 12px;
}
.commentPreview__title{ font-size: 11px; font-weight: 900; color: rgba(255,255,255,.62); margin-bottom: 6px; }
.cRow{ display:flex; gap: 8px; align-items: baseline; font-size: 12px; line-height: 1.3; }
.cRow + .cRow{ margin-top: 6px; }
.cAuthor{ font-weight: 900; opacity: .9; white-space: nowrap; }
.cText{ opacity: .78; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cMore{ margin-top: 8px; font-size: 12px; font-weight: 900; opacity: .72; }

.actions{
  margin-top:auto;
  padding-top: 12px;
  display:flex;
  gap: 10px;
  align-items:center;
  flex-wrap: wrap;
}
.act{
  display:inline-flex; align-items:center; gap: 8px;
  height: 34px; padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-weight: 900; font-size: 12px; cursor: pointer; transform: translateZ(0);
}
.act[data-on="true"]{ background: rgba(255,255,255,.14); }
.act--strong{
  background: color-mix(in oklab, var(--accent) 16%, rgba(255,255,255,.06));
  border-color: color-mix(in oklab, var(--accent) 34%, rgba(255,255,255,.14));
}
.act--ghost{ opacity: .85; background: transparent; }
.num{ opacity: .85; font-weight: 800; }
.ico{ font-size: 14px; }
.act.bump{ animation: bump .22s cubic-bezier(.2,1,.2,1); }
@keyframes bump{ 0%{ transform: scale(1); } 55%{ transform: scale(1.08); } 100%{ transform: scale(1); } }

@media (max-width: 720px){
  .img{ aspect-ratio: 1 / 1.05; }
  .mediaTopMeta{ top: 8px; left: 8px; right: 8px; }
  .nav{ width: 38px; height: 38px; }
  .shareCard__top{ flex-wrap: wrap; }
  .shareCard__state--desktop{ display:none; }
  .shareCard__state--mobile{ display:inline-flex; }
  .actions{ gap: 8px; }
  .act{ flex: 1 1 calc(50% - 4px); justify-content: center; }
}
</style>