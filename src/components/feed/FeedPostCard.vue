<!-- src/components/feed/FeedPostCard.vue -->
<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useToastStore } from "../../stores/toast";
import Lightbox from "../media/Lightbox.vue";

const props = defineProps({
  post: { type: Object, required: true },
});

const emit = defineEmits(["like"]);

const router = useRouter();
const toast = useToastStore();

const images = computed(() => {
  const p = props.post || {};
  return p.imageUrls || p.images || [];
});

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

const lightboxOpen = ref(false);
const lightboxIndex = ref(0);
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

function openLightbox(i, e) {
  e?.stopPropagation?.();
  lightboxIndex.value = i;
  lightboxOpen.value = true;
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
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, "")
    .trim();
}

function inferKindLabel(title) {
  const s = String(title || "");
  if (!s) return "액션";
  if (/(약속|만나|미팅|식사|데이트|모임)/.test(s)) return "약속";
  if (/(할일|해야|작업|업무|정리|구매|체크)/.test(s)) return "할일";
  if (/(장소|가자|방문|성수|역|카페|공원|식당)/.test(s)) return "장소";
  return "액션";
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

    return {
      badge: meta.badge || "액션 공유",
      title: meta.title || "",
      subtitle: meta.subtitle || meta.description || "",
      state: meta.status || meta.state || "",
      chips: chips.slice(0, 3),
    };
  }

  if (!isActionSharePost(props.post)) return null;
  return fallbackActionMetaFromContent(props.post);
});

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
</script>

<template>
  <article class="card" role="article" @click="openDetail">
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
          <div v-if="actionShareMeta.title" class="shareCard__title">{{ actionShareMeta.title }}</div>
          <div v-if="actionShareMeta.subtitle" class="shareCard__sub">{{ actionShareMeta.subtitle }}</div>
        </div>
        <div v-if="actionShareMeta.state" class="shareCard__state">{{ actionShareMeta.state }}</div>
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
          @click.stop="openLightbox(idx, $event)"
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
        <button class="zoomBtn" type="button" @click.stop="openLightbox(slide, $event)" aria-label="이미지 크게 보기">⌕</button>
        <span v-if="visibleImages.length > 1" class="mediaPill mediaPill--soft">스와이프</span>
      </div>

      <button v-if="visibleImages.length > 1" class="nav left" type="button" @click.stop="prevSlide" aria-label="이전">‹</button>
      <button v-if="visibleImages.length > 1" class="nav right" type="button" @click.stop="nextSlide" aria-label="다음">›</button>
    </div>

    <div class="flowBar">
      <span class="flowDot"></span>
      <span>{{ engagementStrip }}</span>
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
      </button>

      <button class="act act--strong" type="button" @click="openDetail">
        <span class="ico">↗</span>
        <span class="num">이어보기</span>
      </button>

      <button class="act act--ghost" type="button" @click="sharePost">
        <span class="ico">⤴</span>
        <span class="num">공유</span>
      </button>
    </div>

    <Lightbox
      v-if="lightboxOpen"
      :images="visibleImages"
      :start-index="lightboxIndex"
      @close="lightboxOpen = false"
    />
  </article>
</template>

<style scoped>
.card{
  min-height:360px;
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
  aspect-ratio: 4 / 5;
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
  margin-top:auto; margin-top: 12px; display:flex; gap: 10px; align-items:center; flex-wrap: wrap; }
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
  .img{ aspect-ratio: 1 / 1.08; }
  .mediaTopMeta{ top: 8px; left: 8px; right: 8px; }
  .nav{ width: 38px; height: 38px; }
  .shareCard__top{ flex-wrap: wrap; }
  .actions{
  margin-top:auto; gap: 8px; }
  .act{ flex: 1 1 calc(50% - 4px); justify-content: center; }
}
</style>
