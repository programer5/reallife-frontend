<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, onBeforeUnmount, watch} from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";
import PinCandidateCard from "@/components/pins/PinCandidateCard.vue";
import SseStatusBanner from "@/components/SseStatusBanner.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
import { fetchConversationReadState } from "@/api/conversations";
import {
  getConversationLock,
  setConversationLock,
  disableConversationLock,
  issueUnlockToken,
} from "@/api/conversationLock";
import { pinDone, pinCancel, pinDismiss, pinUpdate } from "@/api/pinsActions";
import { confirmPinFromMessage } from "@/api/pins";

import { useToastStore } from "@/stores/toast";
import { useConversationsStore } from "@/stores/conversations";
import { useAuthStore } from "@/stores/auth";
import { useConversationPinsStore } from "@/stores/conversationPins";
import { readNotification } from "@/api/notifications";
import { useNotificationsStore } from "@/stores/notifications";
import { fetchConversationReadReceipts } from "@/api/conversations";
import { updateMessage } from "@/api/messages";
import sse from "@/lib/sse";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const convStore = useConversationsStore();
const auth = useAuthStore();
const pinsStore = useConversationPinsStore();
const notificationsStore = useNotificationsStore();

const conversationId = computed(() => String(route.params.conversationId || ""));
const isPinnedHighlight = ref(false);

const unreadDividerMid = ref(null); // 첫 unread 메시지 ID(구분선 위치)

const readReceipts = ref([]); // [{ userId, lastReadAt }]

// ✅ RealLife v2: Dock(상단)에서 액션/제안 관리
const dockMode = ref("active"); // 'active' | 'suggestions'
const dockOpen = ref(false);
const dockJustMovedPinId = ref(null);
const savingCandidateId = ref(null);
const lastCreatedPinId = ref(null);

// ✅ v2.10: placeholder slot for clearer FLIP destination
const flipPlaceholder = ref(null); // { pinId, title, time, place, type }

// ✅ v2.9: Dock → Active 'TRUE FLIP' animation + queue
const flyLayer = ref(null);
const _flyQueue = []; // [{ fromRect, html, createdPinId }]
let _flyRunning = false;
let _flySeq = 0; // v2.12: sequence for stacked fly ghosts

function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, width:r.width, height:r.height };
}

function makeFlyGhost(fromRect, toRect, html, fromStyle, toStyle, seq){
  // Card-shaped ghost that flies (kept for UX delight)
  try{
    const ghost = document.createElement("div");
    ghost.className = "flyGhost";
    const stack = (seq ? (seq % 3) : 0);
    const ox = stack * 8;
    const oy = stack * 6;
    ghost.style.left = (fromRect.left + ox) + "px";
    ghost.style.top = (fromRect.top + oy) + "px";
    ghost.style.width = fromRect.width + "px";
    ghost.style.height = fromRect.height + "px";
    ghost.style.zIndex = String(10000 + (seq || 0));

    // v2.10+: interpolate radius/shadow/background too
    if(fromStyle){
      if(fromStyle.borderRadius) ghost.style.borderRadius = fromStyle.borderRadius;
      if(fromStyle.boxShadow) ghost.style.boxShadow = fromStyle.boxShadow;
      if(fromStyle.background) ghost.style.background = fromStyle.background;
    }

    // v2.12: keep card shape; animate tilt/scale on inner so outer can FLIP by transitions
    ghost.innerHTML = `<div class="flyGhostInner">${html || ""}</div>`;
    document.body.appendChild(ghost);

    // force layout
    ghost.getBoundingClientRect();

    // destination style
    if(toStyle){
      if(toStyle.borderRadius) ghost.style.borderRadius = toStyle.borderRadius;
      if(toStyle.boxShadow) ghost.style.boxShadow = toStyle.boxShadow;
      if(toStyle.background) ghost.style.background = toStyle.background;
    }

    ghost.style.left = (toRect.left) + "px";
    ghost.style.top = (toRect.top) + "px";
    ghost.style.width = toRect.width + "px";
    ghost.style.height = toRect.height + "px";
    ghost.style.opacity = "0.0";

    const clean = () => { try{ ghost.remove(); }catch{} };
    ghost.addEventListener("transitionend", clean, { once:true });
    setTimeout(clean, 820);
  }catch{}
}

function playTrueFlip(el, fromRect){
  // Animate destination element from 'fromRect' to its current rect (FLIP)
  try{
    if(!el || !fromRect) return;
    const last = rectOf(el);
    if(!last) return;
    const dx = fromRect.left - last.left;
    const dy = fromRect.top - last.top;
    const sx = fromRect.width / Math.max(1, last.width);
    const sy = fromRect.height / Math.max(1, last.height);

    el.style.willChange = "transform, opacity";
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = "0.65";

    // force
    el.getBoundingClientRect();

    el.style.transition = "transform 520ms cubic-bezier(.16,1,.3,1), opacity 420ms cubic-bezier(.16,1,.3,1)";
    el.style.transform = "translate(0px, 0px) scale(1, 1)";
    el.style.opacity = "1";

    const clean = () => {
      try{
        el.style.willChange = "";
        el.style.transformOrigin = "";
        el.style.transition = "";
        el.style.transform = "";
      }catch{}
    };
    el.addEventListener("transitionend", clean, { once:true });
    setTimeout(clean, 750);
  }catch{}
}

function enqueueDockToActiveFly(job){
  if(!job?.fromRect || !job?.createdPinId) return;
  // v2.12: keep a sequence so rapid saves look like a stacked queue
  const seq = (++_flySeq);
  _flyQueue.push({ ...job, _seq: seq });
  if(!_flyRunning) processFlyQueue();
}

async function processFlyQueue(){
  if(_flyRunning) return;
  _flyRunning = true;

  while(_flyQueue.length){
    const job = _flyQueue.shift();
    try{
      await runDockToActiveFly(job);
      // small gap so rapid saves feel like a "stack queue"
      await new Promise(r => setTimeout(r, 70));
    }catch{}
  }

  _flyRunning = false;
}


function spawnSparks(x, y){
  try{
    const n = 9;
    for(let i=0;i<n;i++){
      const s = document.createElement("span");
      s.className = "spark";
      const a = (Math.PI * 2) * (i / n) + (Math.random()*0.4);
      const d = 10 + Math.random()*14;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--dx", (Math.cos(a)*d).toFixed(2)+"px");
      s.style.setProperty("--dy", (Math.sin(a)*d).toFixed(2)+"px");
      s.style.setProperty("--rot", (Math.random()*120-60).toFixed(1)+"deg");
      document.body.appendChild(s);
      s.addEventListener("animationend", () => { try{s.remove()}catch{} }, { once:true });
    }
  }catch{}
}

function safeText(v){
  return (v==null) ? "" : String(v);
}

function formatCandidateTime(c){
  const raw = c?.startAt || c?.whenAt || c?.datetime || c?.timeAt || c?.at || c?.dateTime;
  if(!raw) return "";
  try{
    const d = new Date(raw);
    if(!isNaN(d.getTime())){
      const y = d.getFullYear();
      const mo = String(d.getMonth()+1).padStart(2,"0");
      const da = String(d.getDate()).padStart(2,"0");
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      return `${y}-${mo}-${da} ${hh}:${mm}`;
    }
  }catch{}
  return safeText(raw).slice(0,16);
}

function formatCandidatePlace(c){
  const p = c?.placeText || c?.place || c?.location || c?.where || c?.addr || c?.address;
  return p ? safeText(p).slice(0,18) : "";
}

function makeCandidateGhostHtml(candidate, title){
  const t = safeText(title || candidate?.title || "액션").slice(0,24);
  const time = formatCandidateTime(candidate);
  const place = formatCandidatePlace(candidate);
  const metaParts = [];
  if(time) metaParts.push(`🕒 ${time}`);
  if(place) metaParts.push(`📍 ${place}`);
  const meta = metaParts.length ? metaParts.join(" · ") : "저장 중…";
  // minimal HTML, styled by .flyGhostInner
  return `<div class="flyGhostInner">
            <div class="flyGhostTitle">${t}</div>
            <div class="flyGhostMeta">${meta}</div>
          </div>`;
}


async function runDockToActiveFly(job){
  const createdPinId = job?.createdPinId;
  const fromRect = job?.fromRect;
  const html = job?.html;

  if(!fromRect || !createdPinId) return;

  // remember so it can be force-rendered in dock row (in case list is sliced)
  lastCreatedPinId.value = String(createdPinId);

  // v2.10: render a placeholder slot so destination exists before real card appears
  if(job?.meta){
    flipPlaceholder.value = { pinId: String(createdPinId), ...job.meta };
  } else {
    flipPlaceholder.value = { pinId: String(createdPinId), title: "저장됨", time: "", place: "", type: "OTHER" };
  }

  // ensure dock open + active tab visible so target exists
  try{
    dockMode.value = "active";
    dockOpen.value = true;
    await nextTick();
    await nextTick();
  }catch{}

  // try find target card
  let target = document.querySelector(`[data-pin-id="${String(createdPinId)}"]`);

  // if not found (filtered/sliced), try force filter to match the new pin type
  if(!target){
    const p = (pins.value || []).find(x => String(x.pinId)===String(createdPinId));
    if(p){
      const k = classifyPin(p);
      activeFilter.value = k || "ALL";
      await nextTick();
      await nextTick();
      target = document.querySelector(`[data-pin-id="${String(createdPinId)}"]`);
    }
  }

  // fallback target: dock panel itself
  const fallbackEl = document.querySelector(".dockPanel") || document.querySelector(".dockWrap");
  const toRect = rectOf(target || fallbackEl);

  if(toRect){
    // 1) Fly the ghost card (visual continuity)
    const toEl = (target || fallbackEl);
    const tcs = toEl ? window.getComputedStyle(toEl) : null;
    const toStyle = tcs ? { borderRadius: tcs.borderRadius, boxShadow: tcs.boxShadow, background: tcs.background } : null;

    makeFlyGhost(fromRect, toRect, html, job?.fromStyle, toStyle, job?._seq);
    // v2.12: tiny spark burst at destination (subtle)
    try{ spawnSparks(toRect.left + toRect.width*0.75, toRect.top + 18); }catch{}

    // 2) TRUE FLIP: animate the destination element from the source rect
    // (only if target exists)
    if(target){
      // ensure it's visible in horizontal row
      try{
        target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
      }catch{}
      // play FLIP on next frame so scroll/layout settles a bit
            requestAnimationFrame(() => playTrueFlip(target, fromRect));

      // clear placeholder once real card is in DOM
      setTimeout(() => {
        try{
          const exists = (pins.value || []).some(x => String(x.pinId)===String(createdPinId));
          if(exists) flipPlaceholder.value = null;
        }catch{}
      }, 850);
    }
  }
}


const dockPulseOn = ref(false);
function triggerDockPulse(){
  dockPulseOn.value = true;
  setTimeout(() => { dockPulseOn.value = false; }, 240);
}

const dockAnimating = ref(false);
const activeFilter = ref("ALL"); // ALL | PROMISE | TODO | PLACE

function classifyCandidate(c){
  const t = c && (c.type || c.pinType || c.kind || c.category) ? String(c.type || c.pinType || c.kind || c.category).toUpperCase() : "";
  if (t.includes("PLACE")) return "PLACE";
  if (t.includes("TODO") || t.includes("TASK")) return "TODO";
  if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";

  // heuristic
  const text = String(c?.title || c?.content || c?.summary || "").toLowerCase();
  if (text.includes("할일") || text.includes("todo") || text.includes("task")) return "TODO";
  if (text.includes("장소") || text.includes("주소") || text.includes("place")) return "PLACE";
  return "PROMISE"; // default: 약속 계열
}

function classifyPin(p) {
  // 백엔드 스키마가 타입을 주면 우선 사용, 없으면 휴리스틱
  const t = (p && (p.type || p.pinType || p.kind || p.category)) ? String(p.type || p.pinType || p.kind || p.category).toUpperCase() : "";
  if (t.includes("PLACE")) return "PLACE";
  if (t.includes("TODO") || t.includes("TASK")) return "TODO";
  if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";
  // 휴리스틱: startAt 있으면 약속, placeText만 있으면 장소, 그 외 할일
  if (p?.startAt) return "PROMISE";
  if (p?.placeText) return "PLACE";
  return "TODO";
}


function pinKindMeta(p) {
  const kind = classifyPin(p);
  if (kind === "PROMISE") return { emoji: "📅", label: "약속" };
  if (kind === "TODO") return { emoji: "✅", label: "할일" };
  return { emoji: "📍", label: "장소" };
}

function pinTimelineState(p) {
  const kind = classifyPin(p);
  const now = Date.now();
  const startTs = p?.startAt ? new Date(p.startAt).getTime() : 0;

  if (kind === "PLACE") {
    return { stage: "saved", label: "저장됨", tone: "stable", progress: 34 };
  }
  if (kind === "TODO") {
    return { stage: "working", label: "진행 준비", tone: "active", progress: 58 };
  }
  if (kind === "PROMISE") {
    if (startTs && startTs > now) return { stage: "scheduled", label: "예정됨", tone: "accent", progress: 74 };
    if (startTs && startTs <= now) return { stage: "started", label: "시간 지남", tone: "warn", progress: 90 };
    return { stage: "saved", label: "저장됨", tone: "stable", progress: 48 };
  }
  return { stage: "saved", label: "저장됨", tone: "stable", progress: 40 };
}

const nextPromisePin = computed(() => {
  const now = Date.now();
  return (pins.value || [])
    .filter((p) => classifyPin(p) === "PROMISE" && p?.startAt)
    .map((p) => ({ pin: p, ts: new Date(p.startAt).getTime() }))
    .filter((x) => x.ts && x.ts >= now)
    .sort((a, b) => a.ts - b.ts)[0]?.pin || null;
});

const dockTimelineSummary = computed(() => {
  const total = Array.isArray(pins.value) ? pins.value.length : 0;
  const promises = activeCounts.value.PROMISE || 0;
  const todos = activeCounts.value.TODO || 0;
  const places = activeCounts.value.PLACE || 0;
  return {
    total,
    promises,
    todos,
    places,
    nextLabel: nextPromisePin.value ? pinTimeText(nextPromisePin.value) : "",
    nextTitle: nextPromisePin.value?.title || "",
  };
});

const activeCounts = computed(() => {
  const res = { PROMISE: 0, TODO: 0, PLACE: 0 };
  (pins.value || []).forEach((p) => {
    const k = classifyPin(p);
    if (res[k] != null) res[k] += 1;
  });
  return res;
});

const filteredActivePins = computed(() => {
  const list = Array.isArray(pins.value) ? [...pins.value] : [];
  const f = activeFilter.value;
  const out = f === "ALL" ? list : list.filter((p) => classifyPin(p) === f);
  // 정렬: 약속(startAt) 우선 + 시간 오름차순, 나머지는 최근
  out.sort((a, b) => {
    const ak = classifyPin(a);
    const bk = classifyPin(b);
    if (ak !== bk) {
      const order = { PROMISE: 0, TODO: 1, PLACE: 2 };
      return (order[ak] ?? 9) - (order[bk] ?? 9);
    }
    const at = a?.startAt ? new Date(a.startAt).getTime() : 0;
    const bt = b?.startAt ? new Date(b.startAt).getTime() : 0;
    if (at && bt) return at - bt;
    return 0;
  });
  return out;
});


const dockActivePinsToShow = computed(() => {
  const list = Array.isArray(filteredActivePins.value) ? [...filteredActivePins.value] : [];
  const lastId = lastCreatedPinId.value ? String(lastCreatedPinId.value) : null;

  // v2.10: placeholder slot to make FLIP destination visible immediately
  const ph = flipPlaceholder.value && flipPlaceholder.value.pinId ? flipPlaceholder.value : null;
  const hasReal = ph ? list.some(p => String(p.pinId) === String(ph.pinId)) : false;
  const phItem = (ph && !hasReal) ? {
    pinId: String(ph.pinId),
    title: ph.title || "저장 중…",
    placeName: ph.place || "",
    startAt: ph.time || "",
    __placeholder: true,
    __type: ph.type || "OTHER",
  } : null;

  // show a bit more in dock and ensure last created is included
  let show = list.slice(0, 10);

  if (phItem && !show.some(p => String(p.pinId) === String(phItem.pinId))) {
    show = [phItem, ...show].slice(0, 10);
  }

  if (lastId && !show.some(p => String(p.pinId) === lastId)) {
    const found = list.find(p => String(p.pinId) === lastId);
    if (found) show = [found, ...show].slice(0, 10);
  }

  return show;
});

const sortedDockCandidates = computed(() => {
  const list = Array.isArray(dockCandidates.value) ? [...dockCandidates.value] : [];
  // candidate가 startAt/score 같은 속성을 줄 수도 있어서 최대한 안정적으로 정렬
  list.sort((a, b) => {
    const at = a?.startAt ? new Date(a.startAt).getTime() : 0;
    const bt = b?.startAt ? new Date(b.startAt).getTime() : 0;
    if (at && bt) return at - bt;
    const as = typeof a?.score === "number" ? -a.score : 0;
    const bs = typeof b?.score === "number" ? -b.score : 0;
    if (as !== bs) return as - bs;
    return String(a?.candidateId || "").localeCompare(String(b?.candidateId || ""));
  });
  return list;
});


// 제안(후보) 표시용: 현재 선택된 메시지 기준
const dockSourceMsg = ref(null); // message object
const dockCandidates = ref([]);  // candidate array

const activeCount = computed(() => (Array.isArray(pins.value) ? pins.value.length : 0));
const suggestionCount = computed(() => {
  const arr = items.value || [];
  return arr.reduce((acc, m) => acc + ((m?.pinCandidates && m.pinCandidates.length) ? m.pinCandidates.length : 0), 0);
});

function openActiveDock() {
  dockAnimating.value = true;
  setTimeout(() => (dockAnimating.value = false), 220);
dockMode.value = "active";
  dockOpen.value = !dockOpen.value;
}

function openSuggestionsDock(message) {
  if (!message || !message.pinCandidates || !message.pinCandidates.length) return;

  // 같은 메시지 제안을 다시 누르면 닫기
  const mid = String(message.messageId);
  const curMid = dockSourceMsg.value ? String(dockSourceMsg.value.messageId) : null;

  if (dockOpen.value && dockMode.value === "suggestions" && curMid === mid) {
    dockOpen.value = false;
    return;
  }

  dockMode.value = "suggestions";
  dockOpen.value = true;
  dockSourceMsg.value = message;
  dockCandidates.value = Array.isArray(message.pinCandidates) ? message.pinCandidates : [];
}

// hoverActions의 ✨ 버튼이 호출
function isCandidatesOpen(messageId) {
  return (
    dockOpen.value &&
    dockMode.value === "suggestions" &&
    dockSourceMsg.value &&
    String(dockSourceMsg.value.messageId) === String(messageId)
  );
}

function toggleCandidates(messageId) {
  const mid = String(messageId);
  const msg = (items.value || []).find((x) => String(x?.messageId) === mid);
  if (!msg || !msg.pinCandidates || !msg.pinCandidates.length) return;
  openSuggestionsDock(msg);
}

function parseTime(v) {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : null;
}

function computeUnreadDividerMid(lastReadAt) {
  if (!lastReadAt) return null;

  const base = parseTime(lastReadAt);
  if (base == null) return null;

  // items는 normalizeMessages로 "오래된->최신" 정렬 상태
  // 읽음 기준: createdAt > lastReadAt 인 첫 메시지가 “첫 unread”
  for (const m of items.value) {
    const ct = parseTime(m.createdAt);
    if (ct != null && ct > base) {
      return String(m.messageId);
    }
  }
  return null;
}

async function jumpToFirstUnread(lastReadAt) {
  // 1) 현재 페이지에 read(<=lastReadAt) 메시지가 하나도 없으면,
  //    unread의 "가장 처음"이 더 과거에 있을 수 있음 -> loadMore로 더 가져오기
  const base = parseTime(lastReadAt);
  if (!base) {
    unreadDividerMid.value = null;
    scrollToBottom({ smooth: false });
    return;
  }

  const hasAnyReadInLoaded = () =>
      items.value.some((m) => {
        const ct = parseTime(m.createdAt);
        return ct != null && ct <= base;
      });

  // 최대 10페이지까지만(무한루프 방지)
  let guard = 0;
  while (!hasAnyReadInLoaded() && hasNext.value && !loading.value && guard < 10) {
    guard++;
    await loadMore(); // 기존 함수 그대로 사용 (prepend + 스크롤 유지)
    await nextTick();
  }

  // 2) divider mid 계산
  const mid = computeUnreadDividerMid(lastReadAt);
  unreadDividerMid.value = mid;

  // 3) unread가 있으면 그 위치로, 없으면 맨 아래로
  await nextTick();

  if (mid) {
    const el = scrollerRef.value?.querySelector(`[data-mid="${mid}"]`);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } else {
    scrollToBottom({ smooth: false });
  }
}

function onPinRemindHighlight(e) {
  const cid = e?.detail?.conversationId;
  if (!cid) return;

  // 현재 보고 있는 대화방만 하이라이트
  if (String(cid) !== String(conversationId.value)) return;

  isPinnedHighlight.value = true;
  setTimeout(() => (isPinnedHighlight.value = false), 800);
}

onMounted(() => {
  detectTouchUi();
  window.addEventListener('resize', detectTouchUi);

  window.addEventListener("pin-remind-highlight", onPinRemindHighlight);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', detectTouchUi);

  window.removeEventListener("pin-remind-highlight", onPinRemindHighlight);
});
const myId = computed(() => auth.me?.id || null);

/** 상대(목록 데이터 기반) */

const currentConversationRow = computed(() => {
  const cid = conversationId.value;
  return convStore.items?.find(c => String(c.conversationId) === String(cid)) || null;
});

const conversationType = computed(() =>
  String(currentConversationRow.value?.conversationType || "DIRECT")
);

const conversationTitle = computed(() =>
  currentConversationRow.value?.conversationTitle || ""
);

const isGroupConversation = computed(() =>
  conversationType.value === "GROUP"
);

const groupDraftMeta = computed(() => {
  try {
    const raw = sessionStorage.getItem("reallife:groupConversationMetaMap") || "{}";
    const map = JSON.parse(raw);
    return map?.[String(conversationId.value)] || null;
  } catch {
    return null;
  }
});

const groupMembers = computed(() => {
  const arr = Array.isArray(groupDraftMeta.value?.members) ? groupDraftMeta.value.members : [];
  return arr;
});

const peer = computed(() => {
  const cid = conversationId.value;
  const row = convStore.items?.find((c) => String(c.conversationId) === String(cid));
  return row?.peerUser || null;
});

const peerName = computed(() => {
  if (isGroupConversation.value) return conversationTitle.value || groupDraftMeta.value?.title || "그룹 대화";
  return peer.value?.nickname || peer.value?.name || "대화";
});
const peerHandle = computed(() => {
  if (isGroupConversation.value) return `${groupMembers.value.length || 0}명 참여 중`;
  return peer.value?.handle || "";
});
const hasPeer = computed(() => (isGroupConversation.value ? false : !!peer.value));

function peerInitial() {
  if (isGroupConversation.value) {
    const s = String(conversationTitle.value || groupDraftMeta.value?.title || "").trim();
    return s ? s[0].toUpperCase() : "G";
  }
  const s = String(peer.value?.nickname || peer.value?.name || peer.value?.handle || "").trim();
  return s ? s[0].toUpperCase() : "U";
}
function openPeerProfile() {
  const h = peer.value?.handle;
  const id = peer.value?.userId || peer.value?.id;
  if (h) return router.push(`/u/${h}`);
  if (id) return router.push(`/u/id/${id}`);
}

/** ====== DM 잠금 ====== */
const lockEnabled = ref(false);
const unlocked = ref(false);
const lockGatePw = ref("");

const lockModalOpen = ref(false);
const lockModalMode = ref("set"); // set | disable
const lockPw1 = ref("");
const lockPw2 = ref("");

// ✅ Teleport 기반 메시지 메뉴 상태
const menu = ref({
  open: false,
  top: 0,
  left: 0,
  msg: null,
});

function closeMsgMenu() {
  menu.value.open = false;
  menu.value.msg = null;
}

function openMsgMenu(e, m) {
  if (!m) return;

  const rect = e?.currentTarget?.getBoundingClientRect?.() || null;

  const w = 140; // 팝오버 대략 폭
  const h = 96;  // 팝오버 대략 높이(2개 메뉴)
  const pad = 10;

  let left = rect ? rect.right - w : (e?.clientX || 0);
  let top = rect ? rect.bottom + 8 : (e?.clientY || 0);

  // ✅ 화면 밖 보정
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + w + pad > vw) left = vw - w - pad;
  if (left < pad) left = pad;
  if (top + h + pad > vh) top = (rect ? rect.top - h - 8 : vh - h - pad);
  if (top < pad) top = pad;

  menu.value = { open: true, left, top, msg: m };
}

// ESC로 닫기
function onKeydownForMenu(e) {
  if (e.key === "Escape") closeMsgMenu();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydownForMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydownForMenu);
});

function tokenKey() {
  return `conv_unlock_${conversationId.value}`;
}
function getSavedToken() {
  try {
    return sessionStorage.getItem(tokenKey()) || "";
  } catch {
    return "";
  }
}
function saveToken(token) {
  try {
    sessionStorage.setItem(tokenKey(), token);
  } catch {}
}
function clearToken() {
  try {
    sessionStorage.removeItem(tokenKey());
  } catch {}
}
const unlockToken = computed(() => getSavedToken());

const canViewConversation = computed(() => {
  if (!lockEnabled.value) return true;
  return !!unlocked.value;
});

async function refreshLockState() {
  try {
    const res = await getConversationLock(conversationId.value);
    lockEnabled.value = !!res?.enabled;

    if (!lockEnabled.value) {
      unlocked.value = true;
      return;
    }
    unlocked.value = !!getSavedToken();
  } catch {
    lockEnabled.value = false;
    unlocked.value = true;
  }
}

async function handleUnlockGate() {
  const pw = String(lockGatePw.value || "").trim();
  if (!pw) return;

  try {
    // ⚠️ 기존 프로젝트 시그니처 유지: issueUnlockToken(conversationId, pw)
    const res = await issueUnlockToken(conversationId.value, pw);
    if (!res?.token) throw new Error("no token");
    saveToken(res.token);
    lockGatePw.value = "";
    unlocked.value = true;

    await loadFirst();
    await loadPins();
  } catch (e) {
    toast.error?.("잠금 해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
  }
}

function openLockModal(mode) {
  lockModalMode.value = mode;
  lockPw1.value = "";
  lockPw2.value = "";
  lockModalOpen.value = true;
}
function closeLockModal() {
  lockModalOpen.value = false;
  lockPw1.value = "";
  lockPw2.value = "";
}

async function submitLockModal() {
  if (lockModalMode.value === "set") {
    const p1 = String(lockPw1.value || "").trim();
    const p2 = String(lockPw2.value || "").trim();

    if (p1.length < 4) {
      toast.error?.("설정 실패", "비밀번호는 최소 4자 이상으로 설정해 주세요.");
      return;
    }
    if (p1 !== p2) {
      toast.error?.("설정 실패", "비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      // ⚠️ 기존 프로젝트 시그니처 유지: setConversationLock(conversationId, pw)
      await setConversationLock(conversationId.value, p1);
      clearToken();
      lockEnabled.value = true;
      unlocked.value = false;
      toast.success?.("완료", "이 DM은 잠금 상태가 됐어요.");
      closeLockModal();
    } catch (e) {
      toast.error?.("설정 실패", e?.response?.data?.message || "잠금 설정에 실패했습니다.");
    }
    return;
  }

  const pw = String(lockPw1.value || "").trim();
  if (!pw) {
    toast.error?.("해제 실패", "비밀번호를 입력해 주세요.");
    return;
  }

  try {
    // ⚠️ 기존 프로젝트 시그니처 유지: disableConversationLock(conversationId, pw)
    await disableConversationLock(conversationId.value, pw);
    lockEnabled.value = false;
    unlocked.value = true;
    clearToken();
    toast.success?.("완료", "잠금을 해제했습니다.");
    closeLockModal();

    await loadPins();
  } catch (e) {
    toast.error?.("해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
  }
}

/** ====== Pins (Pinned) ====== */
// ✅ NEW: PIN_REMIND 배지
const hasPinRemindBadge = computed(() => pinsStore.hasRemindBadge?.(conversationId.value));

function clearPinRemindBadge() {
  pinsStore.clearRemindBadge?.(conversationId.value);
}

const pins = computed(() => pinsStore.getPins(conversationId.value));
const showPinned = computed(() => {
  const arr = pins.value;
  return canViewConversation.value && Array.isArray(arr) && arr.length > 0;
});


function pinActivityStorageKey(cid) {
  return `reallife:pinActivity:${cid || ""}`;
}

function loadPinActivityFromStorage(cid) {
  try {
    const raw = sessionStorage.getItem(pinActivityStorageKey(cid));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const pinActivity = ref([]);

function syncPinActivity(cid = conversationId.value) {
  pinActivity.value = loadPinActivityFromStorage(cid).slice(0, 6);
}

function savePinActivity(cid = conversationId.value) {
  try {
    sessionStorage.setItem(pinActivityStorageKey(cid), JSON.stringify(pinActivity.value.slice(0, 6)));
  } catch {}
}

function rememberPinAction(action, pin) {
  const entry = {
    id: `${action}-${pin?.pinId || Date.now()}-${Date.now()}`,
    action,
    pinId: pin?.pinId || null,
    title: pin?.title || pinKindMeta(pin).label,
    type: classifyPin(pin),
    placeText: pin?.placeText || "",
    startAt: pin?.startAt || "",
    at: new Date().toISOString(),
  };
  pinActivity.value = [entry, ...pinActivity.value.filter((x) => String(x.pinId) !== String(entry.pinId))].slice(0, 6);
  savePinActivity();
}

watch(conversationId, () => {
  syncPinActivity();
}, { immediate: true });


const dockVisibleSummary = computed(() => {
  const list = Array.isArray(dockActivePinsToShow.value) ? dockActivePinsToShow.value.filter((x) => !x?.__placeholder) : [];
  return {
    total: list.length,
    hidden: Math.max(0, list.length - 4),
    hasMany: list.length > 4,
  };
});

const dockStatusSummary = computed(() => {
  const now = Date.now();
  const list = Array.isArray(pins.value) ? pins.value : [];
  let overdue = 0;
  let upcoming = 0;
  let todoReady = 0;
  let placeSaved = 0;
  list.forEach((p) => {
    const kind = classifyPin(p);
    const ts = p?.startAt ? new Date(p.startAt).getTime() : 0;
    if (kind === "PROMISE") {
      if (ts && ts < now) overdue += 1;
      else upcoming += 1;
      return;
    }
    if (kind === "TODO") {
      todoReady += 1;
      return;
    }
    if (kind === "PLACE") placeSaved += 1;
  });
  return { overdue, upcoming, todoReady, placeSaved };
});

const upcomingReminderPins = computed(() => {
  const now = Date.now();
  return (Array.isArray(pins.value) ? pins.value : [])
    .filter((p) => p?.remindAt)
    .map((p) => ({ pin: p, ts: new Date(p.remindAt).getTime() }))
    .filter((x) => x.ts && x.ts >= now)
    .sort((a, b) => a.ts - b.ts)
    .map((x) => x.pin);
});

const nextReminderPin = computed(() => upcomingReminderPins.value[0] || null);
const reminderDueSoonCount = computed(() => {
  const limit = Date.now() + 1000 * 60 * 60 * 24;
  return upcomingReminderPins.value.filter((p) => {
    const ts = p?.remindAt ? new Date(p.remindAt).getTime() : 0;
    return ts && ts <= limit;
  }).length;
});

const reminderTodayCount = computed(() => {
  const now = new Date();
  return upcomingReminderPins.value.filter((p) => {
    const ts = p?.remindAt ? new Date(p.remindAt) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    return ts.getFullYear() === now.getFullYear()
      && ts.getMonth() === now.getMonth()
      && ts.getDate() === now.getDate();
  }).length;
});

function reminderTimeText(pin) {
  const remind = pin?.remindAt ? new Date(pin.remindAt).getTime() : 0;
  if (!remind) return '리마인드 없음';
  const startText = pin?.startAt ? ` · 일정 ${pinTimeText(pin)}` : '';
  return `${String(pin.remindAt).replace('T', ' ').slice(0, 16)}${startText}`;
}

function openReminderPins(pin) {
  if (!conversationId.value) return;
  const q = pin?.pinId ? `?pinId=${encodeURIComponent(String(pin.pinId))}` : '';
  router.push(`/inbox/conversations/${encodeURIComponent(String(conversationId.value))}/pins${q}`);
}

const recentPinActivity = computed(() => pinActivity.value.slice(0, 4));

function pinActivityLabel(item) {
  if (item?.action === "DONE") return "완료";
  if (item?.action === "CANCELED") return "취소";
  return "숨김";
}

function pinActivityTone(item) {
  if (item?.action === "DONE") return "done";
  if (item?.action === "CANCELED") return "cancel";
  return "hide";
}

function pinActivityMeta(item) {
  const when = item?.startAt ? pinTimeText(item) : "방금 처리";
  const place = item?.placeText ? ` · ${item.placeText}` : "";
  return `${when}${place}`;
}

const timelinePrimaryMeta = computed(() => {
  if (dockTimelineSummary.value.nextLabel) return dockTimelineSummary.value.nextLabel;
  if (dockStatusSummary.value.overdue) return `시간 지난 액션 ${dockStatusSummary.value.overdue}개`;
  if (dockStatusSummary.value.todoReady) return `바로 체크 가능한 할 일 ${dockStatusSummary.value.todoReady}개`;
  if (dockStatusSummary.value.placeSaved) return `기억해둔 장소 ${dockStatusSummary.value.placeSaved}개`;
  return '새 액션이 생기면 여기서 바로 이어갈 수 있어요';
});

const timelinePriorityReason = computed(() => {
  if (dockStatusSummary.value.overdue) {
    return {
      title: `시간 지난 액션 ${dockStatusSummary.value.overdue}개`,
      description: '약속 시간이나 처리 시점을 다시 확인해 지금 대화를 놓치지 않게 정리하세요.',
    };
  }
  if (reminderDueSoonCount.value) {
    return {
      title: `24시간 내 리마인드 ${reminderDueSoonCount.value}개`,
      description: '곧 울릴 리마인드를 미리 보고, 필요하면 시간이나 내용을 바로 다듬는 흐름이 좋아요.',
    };
  }
  if (dockStatusSummary.value.todoReady) {
    return {
      title: `바로 할 일 ${dockStatusSummary.value.todoReady}개`,
      description: '짧게 끝낼 수 있는 할 일을 먼저 처리하면 대화 흐름이 훨씬 가벼워져요.',
    };
  }
  return {
    title: '저장된 액션 흐름 유지 중',
    description: '약속, 할 일, 장소가 정리돼 있어서 지금은 필요한 카드만 빠르게 훑으면 돼요.',
  };
});

const timelineActionPath = computed(() => {
  if (dockStatusSummary.value.overdue) {
    return {
      title: '카드에서 시간/상태 먼저 수정',
      description: '아래 액션 카드에서 수정이나 완료 처리를 바로 눌러 흐름을 정리할 수 있어요.',
    };
  }
  if (nextReminderPin.value) {
    return {
      title: '리마인더 카드에서 바로 확인',
      description: '다음 리마인더와 오늘 예정 수를 보고 필요한 액션으로 바로 이동하면 돼요.',
    };
  }
  return {
    title: '아래 액션 카드에서 바로 처리',
    description: '수정, 완료, 취소, 피드 공유를 카드 안에서 바로 이어갈 수 있게 정리돼 있어요.',
  };
});

function pinPrimarySummary(pin) {
  const kind = classifyPin(pin);
  const state = pinTimelineState(pin);
  if (kind === 'PROMISE') {
    if (pin?.startAt) return `${state.label} · ${pinTimeText(pin)}`;
    return '시간을 정하면 약속 흐름이 더 선명해져요';
  }
  if (kind === 'TODO') {
    return pin?.remindAt ? `리마인드 예정 · ${reminderTimeText(pin)}` : '체크 전 상태예요';
  }
  return pin?.placeText ? `${pin.placeText} 저장됨` : '다음에 다시 꺼낼 장소예요';
}

function pinSecondarySummary(pin) {
  const kind = classifyPin(pin);
  if (kind === 'PROMISE') {
    return pin?.placeText ? '장소와 시간을 확인한 뒤 완료 또는 일정 조정' : '시간과 장소를 보강해 약속 맥락 완성';
  }
  if (kind === 'TODO') {
    return pin?.startAt ? '시간에 맞춰 처리하거나 완료로 정리' : '완료 처리하거나 필요하면 리마인드 추가';
  }
  return pin?.remindAt ? '리마인드 시점 전에 다시 확인' : '필요하면 메모를 덧붙여 공유하기';
}

function pinCtaHint(pin) {
  const kind = classifyPin(pin);
  if (kind === 'PROMISE') return '시간 변경, 완료 처리, 피드 공유까지 한 카드에서 이어갈 수 있어요';
  if (kind === 'TODO') return '할 일은 완료 처리와 리마인드 정리가 가장 빠른 다음 액션이에요';
  return '장소는 수정 후 공유해 두면 나중에 다시 찾기 쉬워져요';
}


function pinTimelineEvents(pin) {
  const events = [];
  if (pin?.createdAt) {
    events.push({
      key: `created-${pin.pinId || pin.id || ''}`,
      time: pin.createdAt,
      label: '액션 생성',
      tone: 'create',
    });
  }

  const status = String(pin?.status || '').toUpperCase();
  if (status === 'DONE' && pin?.updatedAt) {
    events.push({
      key: `done-${pin.pinId || pin.id || ''}`,
      time: pin.updatedAt,
      label: '완료 처리',
      tone: 'done',
    });
  } else if ((status === 'CANCELED' || status === 'CANCELLED') && pin?.updatedAt) {
    events.push({
      key: `cancel-${pin.pinId || pin.id || ''}`,
      time: pin.updatedAt,
      label: '취소 처리',
      tone: 'cancel',
    });
  }

  return events
    .filter((event) => event.time)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function pinTimelineTimeText(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

async function loadPins() {
  if (!conversationId.value) return;
  if (!canViewConversation.value) return;
  await pinsStore.refresh(conversationId.value, { size: 10 });
}

// pin action modal
const pinModalOpen = ref(false);
const pinModalAction = ref("DONE"); // DONE | CANCELED | DISMISSED
const pinModalPin = ref(null);
const pinActionLoading = ref(false);

function openPinActionModal(action, pin) {
  pinModalAction.value = action;
  pinModalPin.value = pin;
  pinModalOpen.value = true;
}
function closePinActionModal() {
  pinModalOpen.value = false;
  pinModalPin.value = null;
}

const pinModalTitle = computed(() => {
  if (pinModalAction.value === "DONE") return "✅ 핀 완료";
  if (pinModalAction.value === "CANCELED") return "❌ 핀 취소";
  return "🙈 핀 숨김";
});
const pinModalSubtitle = computed(() => {
  if (pinModalAction.value === "DONE") return "이 핀을 완료 처리할까요? (대화방 전체에 적용)";
  if (pinModalAction.value === "CANCELED") return "이 핀을 취소 처리할까요? (대화방 전체에 적용)";
  return "이 핀을 내 화면에서 숨길까요? (상대방은 그대로 보일 수 있어요)";
});
const pinModalConfirmText = computed(() => {
  if (pinModalAction.value === "DONE") return "완료 처리";
  if (pinModalAction.value === "CANCELED") return "취소 처리";
  return "숨김 처리";
});
const pinModalConfirmVariant = computed(() => {
  if (pinModalAction.value === "DONE") return "primary";
  if (pinModalAction.value === "CANCELED") return "danger";
  return "ghost";
});

function pinTimeText(pin) {
  const s = pin?.startAt ? String(pin.startAt) : "";
  if (!s) return "미정";
  // ISO yyyy-mm-ddThh:mm -> yyyy-mm-dd hh:mm
  return s.replace("T", " ").slice(0, 16);
}

async function confirmPinAction() {
  const p = pinModalPin.value;
  if (!p?.pinId) return;

  pinActionLoading.value = true;
  try {
    if (pinModalAction.value === "DONE") await pinDone(p.pinId);
    else if (pinModalAction.value === "CANCELED") await pinCancel(p.pinId);
    else await pinDismiss(p.pinId);

    rememberPinAction(pinModalAction.value, p);
    pinsStore.removePin(conversationId.value, p.pinId);
    closePinActionModal();
  } catch (e) {
    toast.error?.("처리 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    pinActionLoading.value = false;
  }
}

// pin edit (title / time / place)
const pinEditOpen = ref(false);
const pinEditPin = ref(null);

const pinEditTitle = ref("");
const pinEditPlaceText = ref("");
const pinEditStartAtLocal = ref(""); // datetime-local용 "YYYY-MM-DDTHH:mm"

const pinEditRemindMinutes = ref(60);

const REMIND_OPTIONS = [
  { label: "5분 전", value: 5 },
  { label: "10분 전", value: 10 },
  { label: "30분 전", value: 30 },
  { label: "1시간 전", value: 60 },
];

function guessRemindMinutesFromPin(pin) {
  try {
    const s = pin?.startAt ? Date.parse(pin.startAt) : NaN;
    const r = pin?.remindAt ? Date.parse(pin.remindAt) : NaN;
    const diff = Math.round((s - r) / 60000);
    if ([5, 10, 30, 60].includes(diff)) return diff;
  } catch {}
  return 60;
}

const pinEditLoading = ref(false);

function toLocalInput(dt) {
  if (!dt) return "";
  const s = String(dt);
  if (s.includes("T")) return s.slice(0, 16);
  // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm"
  if (s.length >= 16) return s.slice(0, 10) + "T" + s.slice(11, 16);
  return "";
}
function fromLocalInput(v) {
  // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:00"
  if (!v) return null;
  return v.length === 16 ? `${v}:00` : v;
}


function feedShareTextForPin(pin) {
  const meta = pinKindMeta(pin);
  const title = String(pin?.title || meta.label || "액션").trim();
  const time = pin?.startAt ? pinTimeText(pin) : "";
  const place = String(pin?.placeText || "").trim();
  const remind = pin?.remindAt ? reminderTimeText(pin) : "";

  return [
    `${meta.emoji} ${title}`,
    time ? `🕒 ${time}` : "",
    place ? `📍 ${place}` : "",
    remind && remind !== "리마인드 없음" ? `⏰ ${remind}` : "",
    "",
    "#RealLife",
  ]
      .filter((line, idx, arr) => {
        if (line) return true;
        return idx === arr.length - 2; // 해시태그 위 한 줄 띄우기용 빈 줄만 유지
      })
      .join("\n");
}

function feedShareMetaForPin(pin) {
  const meta = pinKindMeta(pin);
  const title = String(pin?.title || meta.label || "액션").trim();
  const time = pin?.startAt ? pinTimeText(pin) : "시간 미정";
  const place = String(pin?.placeText || "장소 미정").trim();
  const remind = pin?.remindAt ? reminderTimeText(pin) : "리마인드 없음";

  const chips = [
    time ? `🕒 ${time}` : "",
    place ? `📍 ${place}` : "",
    remind && remind !== "리마인드 없음" ? `⏰ ${remind}` : "",
  ].filter(Boolean);

  return {
    badge: "액션 공유",
    title,
    subtitle: [meta.label, place !== "장소 미정" ? place : ""].filter(Boolean).join(" · "),
    description: [time, place].filter(Boolean).join(" · "),
    state: remind && remind !== "리마인드 없음" ? "리마인더 설정됨" : meta.label,
    status: remind && remind !== "리마인드 없음" ? remind : meta.label,

    kind: meta.label,
    emoji: meta.emoji,

    time,
    place,
    remindAt: remind && remind !== "리마인드 없음" ? remind : "",
    chips,
  };
}

function sharePinToFeed(pin) {
  try {
    sessionStorage.setItem("reallife:feedShareDraft", JSON.stringify({
      content: feedShareTextForPin(pin),
      visibility: "ALL",
      source: "action-pin",
      pinId: pin?.pinId || null,
      sourceMeta: feedShareMetaForPin(pin),
    }));
    toast.success?.("피드 공유 준비", "홈에서 바로 게시할 수 있게 초안을 채워뒀어요.");
    router.push({ path: "/home", query: { compose: "1" } });
  } catch {
    toast.error?.("공유 준비 실패", "잠시 후 다시 시도해 주세요.");
  }
}

function openPinEdit(pin) {
  pinEditPin.value = pin;

  pinEditTitle.value = pin?.title || "";
  pinEditPlaceText.value = pin?.placeText || "";
  pinEditStartAtLocal.value = toLocalInput(pin?.startAt || "");
  pinEditRemindMinutes.value = guessRemindMinutesFromPin(pin);

  pinEditOpen.value = true;
}
function closePinEdit() {
  if (pinEditLoading.value) return;
  pinEditOpen.value = false;
  pinEditPin.value = null;
  pinEditTitle.value = "";
  pinEditPlaceText.value = "";
  pinEditStartAtLocal.value = "";
  pinEditRemindMinutes.value = 60;
}

async function submitPinEdit() {
  const p = pinEditPin.value;
  if (!p?.pinId) return;

  pinEditLoading.value = true;
  try {
    await pinUpdate(p.pinId, {
      title: pinEditTitle.value.trim() ? pinEditTitle.value.trim() : null,
      placeText: pinEditPlaceText.value.trim() ? pinEditPlaceText.value.trim() : null,
      startAt: fromLocalInput(pinEditStartAtLocal.value), // null이면 일정 변경 없음
      remindMinutes: pinEditRemindMinutes.value, // ✅ NEW
    });

    await loadPins();
    toast.success?.("저장 완료", "핀 정보를 업데이트했습니다.");
    closePinEdit();
  } catch (e) {
    toast.error?.("저장 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    pinEditLoading.value = false;
  }
}

/** ====== 메시지 영역 ====== */
const loading = ref(false);
const error = ref("");

const items = ref([]);
const editingMid = ref(null);      // 현재 편집 중 messageId (string)
const editingText = ref("");       // 편집 텍스트
const savingEdit = ref(false);     // 저장중 플래그

const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);

const scrollerRef = ref(null);
const newMsgCount = ref(0);

// ✅ 메시지 시간 라벨 자동 갱신용 tick
const nowTick = ref(Date.now());
let _msgTimeTimer = null;
let _msgTimeTimer2 = null;

const pageRef = ref(null);
const composerRef = ref(null);

// ✅ v3.6 Bridge: Post/댓글 → Action → Chat Dock
const pendingAction = ref(null);
const pendingActionPrimed = ref(false);
const pendingActionTempId = ref(null);
const pendingHighlight = ref(false);
function bumpPendingHighlight() {
  pendingHighlight.value = true;
  setTimeout(() => { pendingHighlight.value = false; }, 1400);
}

function loadPendingAction() {
  try {
    pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
  } catch {
    pendingAction.value = null;
  }
}
function clearPendingAction() {
  try { sessionStorage.removeItem("reallife:pendingAction"); } catch {}
  try { sessionStorage.removeItem("reallife:pendingActionTargetConversationId"); } catch {}
  pendingAction.value = null;
  pendingActionPrimed.value = false;
  pendingActionTempId.value = null;
}
function pendingKindLabel(kind) {
  if (kind === "PROMISE") return "📅 약속";
  if (kind === "TODO") return "✅ 할일";
  return "📍 장소";
}
function pendingSourceRoute() {
  const p = pendingAction.value;
  if (!p) return "";
  if (p.sourceRoute) return String(p.sourceRoute);
  if (p.postId) return `/posts/${encodeURIComponent(String(p.postId))}`;
  return "";
}
function pendingSourceMeta() {
  const p = pendingAction.value;
  if (!p) return "";
  const author = p.sourcePostAuthorHandle || p.sourcePostAuthorName || p.authorHandle || "";
  const label = p.sourceLabel || "게시글 댓글";
  return author ? `${label} · ${String(author).replace(/^@?/, "@")}` : label;
}
function pendingSourcePreview() {
  const p = pendingAction.value;
  if (!p) return "";
  return String(p.sourcePostPreview || p.text || "").trim().slice(0, 92);
}
function goPendingSource() {
  const to = pendingSourceRoute();
  if (to) router.push(to);
}
function pendingToDraftText(p) {
  if (!p) return "";
  const k = pendingKindLabel(p.kind);
  const t = String(p.text || "").trim();
  // ✅ 후보 감지가 잘 되도록 키워드 + 원문을 같이 넣는다.
  // (백엔드가 메시지에서 pinCandidates를 뽑는 구조이므로, 여기서 메시지로 한 번 흘려보내는 방식)
  return t ? `${k}: ${t}` : `${k} 만들자`;
}
function focusComposer() {
  try {
    const el = composerRef.value?.querySelector?.("input, textarea");
    el?.focus?.();
  } catch {}
}
function primePendingAction(silent = false, force = false) {
  if (!pendingAction.value) return;
  if (!force && String(content.value || "").trim()) {
    // 이미 사용자가 입력 중이면 방해하지 않음
    focusComposer();
    return;
  }
  content.value = pendingToDraftText(pendingAction.value);
  pendingActionPrimed.value = true;
  nextTick(() => focusComposer());
  if (!silent) toast.success?.("액션 준비됨", "전송하면 ✨ 제안으로 바로 뜹니다.");
}
async function quickSendPendingAction() {
  if (!pendingAction.value || sending.value) return;
  primePendingAction(true, true);
  bumpPendingHighlight();
  await nextTick();
  await onSend();
}

const flashMid = ref("");

function syncComposerHeightVar() {
  const pageEl = pageRef.value;
  const composerEl = composerRef.value;
  if (!pageEl || !composerEl) return;

  const h = Math.ceil(composerEl.getBoundingClientRect().height || 0);
  // ✅ CSS에서 쓰는 --composer-h 값을 실제 높이로 동기화
  pageEl.style.setProperty("--composer-h", `${h}px`);
}

function hasMessage(messageId) {
  if (!messageId) return false;
  return items.value.some((m) => String(m.messageId) === String(messageId));
}
function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}
function getScrollAnchor(el) {
  // 현재 화면에서 "제일 위에 걸쳐있는 메시지"를 앵커로 잡는다
  const nodes = el.querySelectorAll("[data-mid]");
  if (!nodes.length) return null;

  const top = el.getBoundingClientRect().top;
  let best = null;
  let bestDist = Infinity;

  for (const n of nodes) {
    const r = n.getBoundingClientRect();
    // scroller 안에 있는 메시지들 중, top에 가장 가까운 걸 선택
    const dist = Math.abs(r.top - top);
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }

  if (!best) return null;
  return { mid: best.getAttribute("data-mid"), topOffset: best.getBoundingClientRect().top - top };
}

function restoreScrollAnchor(el, anchor) {
  if (!anchor?.mid) return;
  const node = el.querySelector(`[data-mid="${CSS.escape(anchor.mid)}"]`);
  if (!node) return;

  const top = el.getBoundingClientRect().top;
  const nowOffset = node.getBoundingClientRect().top - top;
  el.scrollTop += (nowOffset - anchor.topOffset);
}

function scrollToBottom({ smooth = false } = {}) {
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollerRef.value;
        if (!el) return;

        if (smooth) {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  });
}
function isNearBottom() {
  const el = scrollerRef.value;
  if (!el) return true;
  return el.scrollHeight - (el.scrollTop + el.clientHeight) < 160;
}

function isMineMessage(m) {
  if (!myId.value) return false;
  return String(m?.senderId) === String(myId.value);
}

function startEdit(m) {
  if (!m) return;
  if (!isMineMessage(m)) return;
  editingMid.value = String(m.messageId);
  editingText.value = (m.content ?? "").toString();
}

function cancelEdit() {
  editingMid.value = null;
  editingText.value = "";
}

async function saveEdit(m) {
  if (!m) return;
  if (!isMineMessage(m)) return;

  const mid = String(m.messageId);
  const nextText = (editingText.value ?? "").toString().trim();

  if (!nextText) {
    toast.error?.("수정 실패", "내용을 입력해 주세요.");
    return;
  }

  // (선택) 길이 제한(백엔드 5000 기준)
  if (nextText.length > 5000) {
    toast.error?.("수정 실패", "최대 5000자까지 입력할 수 있어요.");
    return;
  }

  // optimistic update 준비
  const idx = items.value.findIndex(x => String(x.messageId) === mid);
  const prev = idx >= 0 ? { ...items.value[idx] } : null;

  savingEdit.value = true;
  try {
    // optimistic 반영(내 화면 즉시)
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        content: nextText,
        editedAt: new Date().toISOString(), // 임시 (서버 응답으로 덮임)
      };
    }

    const res = await updateMessage(conversationId.value, mid, nextText);

    // 서버 응답으로 확정
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        content: res?.content ?? nextText,
        editedAt: res?.editedAt ?? items.value[idx].editedAt,
      };
    }

    cancelEdit();
  } catch (e) {
    // 실패 시 롤백
    if (idx >= 0 && prev) items.value[idx] = prev;

    const msg =
        e?.response?.data?.message ||
        (e?.response?.status ? `요청 실패 (status=${e.response.status})` : "네트워크 오류");
    toast.error?.("수정 실패", msg);
  } finally {
    savingEdit.value = false;
  }
}

async function copyMessage(m) {
  if (!m) return;
  closeMsgMenu();
  await navigator.clipboard.writeText(m.content || "");
  toast?.success?.("복사됨", "메시지를 클립보드에 복사했어요.");
}

// 기존 startEdit을 그대로 쓰되, 메뉴에서 누르면 메뉴를 닫게만 보강

// ✅ Touch-friendly message actions (mobile/app)
// WebView 환경에서 hover 판정이 불안정하므로, 모바일에서는 메시지 탭/롱프레스로 메뉴를 연다.
const isTouchUi = ref(false);
const _lpTimer = ref(null);
const _lastTouch = ref({ x: 0, y: 0, el: null });

function detectTouchUi() {
  try {
    const mq = window.matchMedia && window.matchMedia("(pointer: coarse)");
    isTouchUi.value = !!mq?.matches;
  } catch {
    isTouchUi.value = false;
  }
}

function onBubbleTouchStart(e, m) {
  if (!isTouchUi.value) return;
  const t = e?.target;
  if (t?.closest?.("button, a, textarea, input, select, .hoverActions")) return;

  const touch = e?.touches?.[0];
  if (touch) {
    _lastTouch.value = { x: touch.clientX, y: touch.clientY, el: e.currentTarget };
  } else {
    _lastTouch.value = { x: 0, y: 0, el: e.currentTarget };
  }

  clearTimeout(_lpTimer.value);
  _lpTimer.value = setTimeout(() => {
    openMsgMenu({ currentTarget: _lastTouch.value.el, clientX: _lastTouch.value.x, clientY: _lastTouch.value.y }, m);
  }, 420);
}

function onBubbleTouchEnd() {
  clearTimeout(_lpTimer.value);
  _lpTimer.value = null;
}

function onBubbleClick(e, m) {
  if (!isTouchUi.value) return;
  const t = e?.target;
  if (t?.closest?.("button, a, textarea, input, select, .hoverActions")) return;
  openMsgMenu(e, m);
}

function startEditFromMenu(m) {
  if (!m) return;
  closeMsgMenu();
  startEdit(m);
}

function toggleCandidatesFromMenu(m) {
  if (!m) return;
  closeMsgMenu();
  openSuggestionsDock(m);
}

const lastMyMessageId = computed(() => {
  // items는 오래된 -> 최신 순서
  for (let i = items.value.length - 1; i >= 0; i--) {
    const m = items.value[i];
    if (isMineMessage(m)) return String(m.messageId);
  }
  return null;
});

// 1:1 전용 "읽음" 라벨
function getReadLabel(m) {
  if (!isMineMessage(m)) return "";
  if (!lastMyMessageId.value) return "";
  if (String(m.messageId) !== String(lastMyMessageId.value)) return "";

  const myMsgTime = parseTime(m.createdAt);
  if (myMsgTime == null) return "";

  // readReceipts에서 "나(myId)"가 아닌 상대 1명을 찾음
  const peerItem = (readReceipts.value || []).find(
      (x) => String(x.userId) !== String(myId.value)
  );
  const peerReadAt = peerItem?.lastReadAt;
  const peerTime = parseTime(peerReadAt);

  if (peerTime == null) return "";
  return peerTime >= myMsgTime ? "읽음" : "";
}

function messageTimeText(m) {
  const raw = m?.createdAt ? String(m.createdAt) : "";
  if (!raw) return "";

  // ✅ createdAt 포맷 유연하게 처리 (ISO / "YYYY-MM-DD HH:mm:ss" 모두)
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return raw.replace("T", " ").slice(11, 16); // fallback hh:mm

  const now = nowTick.value;
  const diffMin = Math.floor((now - t) / 60000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;

  // 60분 이상이면 기존처럼 hh:mm
  return iso.replace("T", " ").slice(11, 16);
}

// ✅ 메시지 그룹핑(같은 sender + 5분 이내면 같은 그룹)
function isSameSender(a, b) {
  const sa = a?.senderId;
  const sb = b?.senderId;
  if (sa == null || sb == null) return false;
  return String(sa) === String(sb);
}

function minutesBetween(a, b) {
  const ta = Date.parse(String(a?.createdAt || "").replace(" ", "T"));
  const tb = Date.parse(String(b?.createdAt || "").replace(" ", "T"));
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 9999;
  return Math.abs(tb - ta) / 60000;
}

// 현재 메시지가 "이전 메시지"와 같은 그룹인지
function isGroupWithPrev(idx) {
  if (idx <= 0) return false;
  const cur = items.value[idx];
  const prev = items.value[idx - 1];
  if (!cur || !prev) return false;
  if (!isSameSender(cur, prev)) return false;
  return minutesBetween(prev, cur) <= 5;
}

// 현재 메시지가 "다음 메시지"와 같은 그룹인지
function isGroupWithNext(idx) {
  if (idx < 0 || idx >= items.value.length - 1) return false;
  const cur = items.value[idx];
  const next = items.value[idx + 1];
  if (!cur || !next) return false;
  if (!isSameSender(cur, next)) return false;
  return minutesBetween(cur, next) <= 5;
}

let _readTouchTimer = null;
function touchReadDebounced() {
  if (_readTouchTimer) clearTimeout(_readTouchTimer);
  _readTouchTimer = setTimeout(async () => {
    try {
      await markConversationRead(conversationId.value);
    } catch {}
  }, 350); // 너무 잦지 않게
}

function appendIncomingMessage(payload) {
  if (!payload?.messageId) return;
  if (hasMessage(payload.messageId)) return;

  // ✅ 핵심: “지금 사용자가 바닥 근처를 보고 있나?”
  const shouldAutoScroll = isNearBottom();

  // ✅ 1) 일단 메시지는 append
  items.value.push(payload);

  // pinCandidates 렌더로 높이가 늘 수 있어 1번 더 보정 필요
  const hasCandidates =
      Array.isArray(payload?.pinCandidates) && payload.pinCandidates.length > 0;

  // ✅ 2) 바닥 근처면: 기존처럼 하단 유지 (배너 리셋)
  if (shouldAutoScroll) {
    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });

    if (hasCandidates) {
      nextTick(() => scrollToBottom({ smooth: true }));
    }

    // ✅ NEW: 바닥에서 새 메시지를 받은 경우 = 사실상 읽음 처리
    touchReadDebounced();
  }
  // ✅ 3) 바닥이 아니면: 자동 스크롤 금지 + 배너 카운트 증가
  else {
    newMsgCount.value = (newMsgCount.value || 0) + 1;
  }
}

function onScroll() {
  const el = scrollerRef.value;
  if (!el) return;

  if (el.scrollTop < 12) {
    if (hasNext.value && !loading.value) loadMore();
  }

  if (isNearBottom() && newMsgCount.value > 0) {
    newMsgCount.value = 0;
  }

  // ✅ unread divider 자동 제거: 바닥 근처까지 내려오면 '읽지 않은 메시지' 라인 제거
  if (isNearBottom() && unreadDividerMid.value) {
    unreadDividerMid.value = null;
  }
}

async function ensureSessionOrRedirect() {
  if (auth.me?.id) return true;
  try {
    await auth.ensureSession();
    return !!auth.me?.id;
  } catch {
    router.replace("/login");
    return false;
  }
}

async function loadFirst({ keepScroll = false } = {}) {
  if (!conversationId.value || conversationId.value === "undefined" || conversationId.value === "null") {
    error.value = "대화방 ID가 없습니다. 대화 목록에서 다시 들어와 주세요.";
    return;
  }
  if (!canViewConversation.value) return;

  loading.value = true;
  error.value = "";

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

  // ✅ fetch 끝난 뒤 어떤 스크롤을 할지 "예약"
  let shouldScrollToBottom = !keepScroll;
  let shouldKeepScroll = keepScroll;

  // ✅ NEW: 첫 unread 이동 예약
  let shouldJumpToUnread = false;
  let initialLastReadAt = null;

  // ✅ NEW: keepScroll(=loadMore 등)일 때는 unread 이동 안 함
  if (!keepScroll) {
    try {
      const rs = await fetchConversationReadState(conversationId.value);
      initialLastReadAt = rs?.lastReadAt ?? null;

      // lastReadAt이 있으면 “맨 아래 자동 스크롤” 대신 unread로 이동할 거라 예약
      if (initialLastReadAt) {
        shouldScrollToBottom = false;
        shouldJumpToUnread = true;
      }
    } catch {
      initialLastReadAt = null;
      shouldJumpToUnread = false;
    }
  }

  try {
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    // ✅ NEW: (읽음표시용) 대화방 멤버들의 lastReadAt 목록 로드
    // - 최초 진입/대화방 변경 시에만 로드 (keepScroll=loadMore 때는 스킵)
    if (!keepScroll) {
      let initialReadReceipts = [];
      try {
        const rr = await fetchConversationReadReceipts(conversationId.value);
        initialReadReceipts = rr?.items || [];
      } catch {
        initialReadReceipts = [];
      }
      readReceipts.value = initialReadReceipts;
    }

    // ✅ (중요) unread 기준값은 markRead "이전"에 받은 initialLastReadAt을 사용해야 함
    // ✅ 따라서 markRead는 기존처럼 실행해도 됨
    await markConversationRead(conversationId.value);
    convStore.markRead?.(conversationId.value);
    convStore.setActiveConversation?.(conversationId.value);
    convStore.softSyncSoon?.();

  } catch (e) {
    const msg = e?.response?.data?.message || "메시지를 불러오지 못했습니다.";
    error.value = msg;

    if (e?.response?.status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
    }

    // 에러면 스크롤 예약 취소
    shouldScrollToBottom = false;
    shouldKeepScroll = false;
    shouldJumpToUnread = false;
    unreadDividerMid.value = null;
  } finally {
    loading.value = false;

    // ✅ DOM 렌더 + 레이아웃 확정 이후 스크롤 맞춤
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          const el = scrollerRef.value;
          if (!el) return;

          // 1) keepScroll(=더보기 prepend 보정)
          if (shouldKeepScroll) {
            const newHeight = el.scrollHeight;
            el.scrollTop += newHeight - prevScrollHeight;
            return;
          }

          // 2) 첫 unread로 이동(최초 진입에서만)
          if (shouldJumpToUnread && initialLastReadAt) {
            // divider + 스크롤까지 처리
            await jumpToFirstUnread(initialLastReadAt);
            return;
          }

          // 3) 기본: 맨 아래로
          if (shouldScrollToBottom) {
            el.scrollTop = el.scrollHeight;
          }
        });
      });
    });
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  if (!canViewConversation.value) return;

  const el = scrollerRef.value;
  const anchor = el ? getScrollAnchor(el) : null;

  const res = await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
    cursor: nextCursor.value,
    unlockToken: lockEnabled.value ? unlockToken.value : null,
  });

  items.value = [...normalizeMessages(res.items), ...items.value];
  nextCursor.value = res.nextCursor ?? null;
  hasNext.value = !!res.hasNext;

  nextTick(() => {
    const el2 = scrollerRef.value;
    if (!el2) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScrollAnchor(el2, anchor);
      });
    });
  });
}

function makeTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function removeMessageById(id) {
  const idx = items.value.findIndex((x) => String(x?.messageId) === String(id));
  if (idx >= 0) items.value.splice(idx, 1);
}

function replaceMessageById(id, nextMsg) {
  const idx = items.value.findIndex((x) => String(x?.messageId) === String(id));
  if (idx >= 0) {
    // ✅ temp 메시지를 서버 메시지로 교체
    items.value.splice(idx, 1, { ...nextMsg });
  } else {
    // 혹시 temp가 이미 없어졌으면(예: 다른 로직) 그냥 추가
    items.value.push({ ...nextMsg });
  }
}

function upsertServerMessage(tempId, serverMsg) {
  const mid = serverMsg?.messageId;
  if (!mid) {
    // messageId가 없다면 안전하게 temp를 실패로 처리하는 편이 낫다
    return;
  }

  // ✅ 이미 SSE로 같은 messageId가 들어와 있으면 temp는 제거만 한다 (중복 방지)
  if (hasMessage(mid)) {
    removeMessageById(tempId);
    return;
  }

  // ✅ SSE로 아직 안 들어왔으면 temp를 서버 메시지로 교체
  replaceMessageById(tempId, { ...serverMsg });
}

async function onSend() {
  const text = String(content.value || "").trim();
  const isPendingSend = !!(pendingActionPrimed.value && pendingAction.value && text && (
    // pending의 원문이 조금이라도 포함되면 pending 전송으로 간주
    !pendingAction.value.text || String(text).includes(String(pendingAction.value.text).trim())
  ));
  if (!text || sending.value) return;

  if (!conversationId.value) {
    toast.error?.("전송 실패", "대화방 ID가 없습니다.");
    return;
  }
  if (!canViewConversation.value) {
    toast.error?.("전송 실패", "잠금이 해제되어야 전송할 수 있어요.");
    return;
  }

  // ✅ NEW: temp 메시지 먼저 넣기 (senderId를 반드시 세팅)
  const tempId = makeTempId();
  const tempMsg = {
    messageId: tempId,
    senderId: myId.value, // ✅ 핵심: 내 메시지로 즉시 판별되게
    content: text,
    createdAt: new Date().toISOString(),
    pinCandidates: [],
    _status: "sending",
  };

  items.value.push(tempMsg);
  content.value = "";
  newMsgCount.value = 0;
  scrollToBottom({ smooth: true });

  sending.value = true;
  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: text,
      attachmentIds: [],
      unlockToken: lockEnabled.value && unlocked.value ? unlockToken.value : null,
    });

    // ✅ 성공: SSE가 먼저 왔을 수도 있으니 "중복 방지 upsert"
    upsertServerMessage(tempId, msg);

    // ✅ v3.6 Bridge: pending action으로 보낸 메시지면, 곧바로 Dock ✨ 제안으로 열어준다.
    if (isPendingSend) {
      // tempId는 항상 1회 전송에만 대응
      pendingActionTempId.value = tempId;

      // 서버 응답에 pinCandidates가 있으면 즉시 Dock 오픈
      const hasCandidates = msg && Array.isArray(msg.pinCandidates) && msg.pinCandidates.length > 0;
      if (hasCandidates) {
        openSuggestionsDock(msg);
        triggerDockPulse();
        clearPendingAction();
      } else {
        // 후보가 안 생기면 pendingAction은 유지하고, 사용자가 문장을 조금 더 구체화해서 다시 전송할 수 있게 한다.
        toast.info?.("제안이 생성되지 않았어요", "메시지를 조금 더 구체적으로 적고 다시 전송해보세요.");
      }
    }

    convStore.ingestMessageCreated?.({
      messageId: msg?.messageId,
      conversationId: conversationId.value,
      senderId: msg?.senderId, // ✅ 응답 payload에서 가져오기
      content: msg?.content,
      createdAt: msg?.createdAt,
      attachments: msg?.attachments || [],
      pinCandidates: msg?.pinCandidates || [],
    });

    const hasCandidates = Array.isArray(msg?.pinCandidates) && msg.pinCandidates.length > 0;
    scrollToBottom({ smooth: true });
    if (hasCandidates) nextTick(() => scrollToBottom({ smooth: true }));
  } catch (e) {
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.message;
    const url = e?.config?.url;

    if (status === 401) {
      toast.error?.("전송 실패", "로그인이 만료됐어요. 다시 로그인해 주세요.");
    } else if (status === 403) {
      toast.error?.("전송 실패", "권한이 없어요. (403)");
    } else if (status === 404) {
      toast.error?.("전송 실패", `API 경로를 찾을 수 없어요. (404) ${url || ""}`);
    } else if (status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
      toast.error?.("전송 실패", "이 대화는 잠금 상태입니다. 먼저 잠금을 해제하세요.");
    } else {
      toast.error?.(
          "전송 실패",
          serverMsg || (status ? `요청 실패 (status=${status})` : "네트워크 오류/서버 응답 없음")
      );
    }

    // temp 메시지에 실패 상태 부여 → 재시도 버튼 활성화
    const idx = items.value.findIndex((x) => x?.messageId === tempId);
    if (idx >= 0) items.value[idx]._status = "failed";
  } finally {
    sending.value = false;
    await nextTick();
    syncComposerHeightVar();
  }
}

async function retrySend(m) {
  if (!m || m._status !== "failed") return;

  if (!canViewConversation.value) {
    toast.error?.("재시도 실패", "잠금이 해제되어야 전송할 수 있어요.");
    return;
  }

  // ✅ 핵심: 재시도 메시지도 내 메시지로 고정
  m.senderId = myId.value;

  m._status = "sending";

  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: m.content,
      attachmentIds: [],
      unlockToken: lockEnabled.value && unlocked.value ? unlockToken.value : null,
    });

    upsertServerMessage(m.messageId, msg);

    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });
  } catch (e) {
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.message;

    if (status === 401) {
      toast.error?.("재시도 실패", "로그인이 만료됐어요. 다시 로그인해 주세요.");
    } else if (status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
      toast.error?.("재시도 실패", "이 대화는 잠금 상태입니다. 먼저 잠금을 해제하세요.");
    } else {
      toast.error?.("재시도 실패", serverMsg || (status ? `요청 실패 (status=${status})` : "네트워크 오류"));
    }

    m._status = "failed";
  }
}

function jumpToNewest() {
  newMsgCount.value = 0;
  unreadDividerMid.value = null; // ✅ 추가
  scrollToBottom({ smooth: true });
}

/** ====== 저장됨 배지(2초) ====== */
const savedBadgeByMessageId = ref({});
const savedBadgeTimers = new Map();

function isSavedBadgeOn(messageId) {
  const key = String(messageId || "");
  return !!savedBadgeByMessageId.value[key];
}
function showSavedBadge(messageId) {
  const key = String(messageId || "");
  if (!key) return;

  const prev = savedBadgeTimers.get(key);
  if (prev) clearTimeout(prev);

  savedBadgeByMessageId.value[key] = true;

  const t = setTimeout(() => {
    delete savedBadgeByMessageId.value[key];
    savedBadgeTimers.delete(key);
  }, 2000);

  savedBadgeTimers.set(key, t);
}

/** ====== 핀 후보 confirm (중복 포함) ====== */
// ✅ messageId별 confirm busy (같은 메시지 연타만 막기)
const confirmBusyByMessageId = ref({}); // { [messageId]: true }

function isConfirmBusy(messageId) {
  const key = String(messageId || "");
  return !!confirmBusyByMessageId.value[key];
}

function setConfirmBusy(messageId, v) {
  const key = String(messageId || "");
  if (!key) return;
  if (v) confirmBusyByMessageId.value[key] = true;
  else delete confirmBusyByMessageId.value[key];
}

async function onConfirmCandidate(message, payload) {
  if (!conversationId.value) return;
  if (!message?.messageId) return;
  if (isConfirmBusy(message.messageId)) return;
  setConfirmBusy(message.messageId, true);
  // v2.5: 제안 카드 '이동' 애니메이션
const _cid = payload?.candidateId ?? payload?.id ?? null;
if (_cid) savingCandidateId.value = String(_cid);

// ✅ v2.9: capture source rect + ghost html (enqueue after created)
let flyDraft = null; // { fromRect, html, fromStyle, meta }
if (_cid) {
  const srcEl = document.querySelector(`[data-cid="${String(_cid)}"]`);
  const srcRect = rectOf(srcEl);
  const cs = srcEl ? window.getComputedStyle(srcEl) : null;
  const fromStyle = cs ? {
    borderRadius: cs.borderRadius,
    boxShadow: cs.boxShadow,
    background: cs.background,
  } : null;

  if (srcRect) {
    const title = payload?.overrideTitle || payload?.title || "액션";
    const time = formatCandidateTime(payload);
    const place = safeText(payload?.placeName || payload?.place || payload?.location || payload?.where || "");
    const type = classifyCandidate(payload); // PROMISE | TODO | PLACE | OTHER
    flyDraft = {
      fromRect: srcRect,
      fromStyle,
      html: makeCandidateGhostHtml(payload, title),
      meta: { title, time, place, type },
    };
  }
}
  try {
    const created = await confirmPinFromMessage({
      conversationId: conversationId.value,
      messageId: message.messageId,
      overrideTitle: payload?.overrideTitle ?? null,
      overrideStartAt: payload?.overrideStartAt ?? null,
      overridePlaceText: payload?.overridePlaceText ?? null,
      overrideRemindMinutes: payload?.overrideRemindMinutes ?? 60, // ✅ NEW
    });

    if (created?.pinId) {
      pinsStore.appendPin(conversationId.value, created);

      triggerDockPulse();

      // ✅ v2.5: Dock에 "방금 이동" 애니메이션(제안 → 액션)
      dockJustMovedPinId.value = String(created.pinId);
      setTimeout(() => {
        if (dockJustMovedPinId.value === String(created.pinId)) dockJustMovedPinId.value = null;
      }, 900);

      toast.success?.("핀 생성", "Pinned에 저장했어요.");
      await nextTick();
      if (flyDraft) enqueueDockToActiveFly({ ...flyDraft, createdPinId: created.pinId });
      showSavedBadge(message.messageId);
    }

    if (Array.isArray(message.pinCandidates)) message.pinCandidates = [];
  } catch (e) {
    const code = e?.response?.data?.code;
    if (code === "PIN_ALREADY_SAVED") {
      toast.success?.("이미 저장됨", "이미 Pinned에 저장된 메시지예요.");
      showSavedBadge(message.messageId);
      if (Array.isArray(message.pinCandidates)) message.pinCandidates = [];
      return;
    }
    toast.error?.("핀 생성 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    savingCandidateId.value = null;
    setConfirmBusy(message.messageId, false);
  }
}

async function scrollAndFlashMessage(mid) {
  if (!mid) return false;
  await nextTick();

  const el = document.querySelector(`[data-mid="${mid}"]`);
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  flashMid.value = String(mid);
  setTimeout(() => {
    if (flashMid.value === String(mid)) flashMid.value = "";
  }, 2000);

  return true;
}

// ✅ mid가 안 보이면, 더 로드하면서 찾기(최대 N번)
async function ensureMessageVisible(mid, maxTries = 5) {
  for (let i = 0; i < maxTries; i++) {
    const ok = await scrollAndFlashMessage(mid);
    if (ok) return true;

    // 🔻 여기만 너 프로젝트의 "이전 메시지 로드" 함수명에 맞춰 바꿔줘
    // 예시: await loadMoreOlder();
    if (typeof loadMore === "function") {
      await loadMore();     // 너 코드에 맞는 함수로 교체 필요
    } else if (typeof loadPrev === "function") {
      await loadPrev();
    } else {
      return false;
    }
  }
  return false;
}

function onDismissCandidate(message, candidate) {
  if (!message) return;
  if (!Array.isArray(message.pinCandidates)) return;

  message.pinCandidates = message.pinCandidates.filter(
      (c) => String(c?.candidateId) !== String(candidate?.candidateId)
  );
}

// ✅ 템플릿에서 화살표 제거용 wrapper
function confirmCandidate(m, cand) {
  onConfirmCandidate(m, cand);
}
function dismissCandidate(m, cand) {
  onDismissCandidate(m, cand);
}

/** ====== SSE ====== */
let offEvent = null;
let offStatus = null;
let _wasConnected = false;

async function syncTailAfterReconnect() {
  try {
    // 1) 최근 20개 다시 가져와서 merge
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    const incoming = normalizeMessages(res.items || []);
    // 기존 items에 없는 것만 추가
    for (const m of incoming) {
      if (!hasMessage(m.messageId)) items.value.push(m);
    }

    // 2) 내가 바닥에 있으면 스크롤 유지 + 읽음 처리
    if (isNearBottom()) {
      scrollToBottom({ smooth: false });
      touchReadDebounced();
    }

    // 3) readReceipts도 한 번 갱신(선택이지만 추천)
    try {
      const rr = await fetchConversationReadReceipts(conversationId.value);
      readReceipts.value = rr?.items || [];
    } catch {}
  } catch {}
}

onMounted(async () => {
  const ok = await ensureSessionOrRedirect();
  if (!ok) return;

  convStore.setActiveConversation?.(conversationId.value);

  await refreshLockState();
  if (canViewConversation.value) {
    await loadFirst();
    await loadPins();
  }

  // ✅ v3.6 Bridge: 댓글에서 만든 pending action을 이 대화 입력창에 자동 준비
  loadPendingAction();
  // ✅ ConversationsView에서 특정 대화방을 '가져오기' 대상으로 찍어둔 경우에만 강조
  let targetOk = true;
  try {
    const t = sessionStorage.getItem("reallife:pendingActionTargetConversationId");
    if (t && String(t) !== String(conversationId.value)) targetOk = false;
  } catch {}
  if (canViewConversation.value && pendingAction.value) {
    primePendingAction(true);
    if (targetOk) {
      bumpPendingHighlight();
      try { sessionStorage.removeItem("reallife:pendingActionTargetConversationId"); } catch {}
    }
  }

  // ✅ 알림으로 진입한 경우: 읽음 처리 + 해당 메시지로 스크롤
  const notiId = route.query?.notiId ? String(route.query.notiId) : "";
  const fromNoti = route.query?.fromNoti ? String(route.query.fromNoti) === "1" : false;
  const targetMid = route.query?.mid ? String(route.query.mid) : "";

  if (notiId) {
    try {
      await readNotification(notiId);
      await notificationsStore.refresh?.();
    } catch {}
  }

  await nextTick();

  if (scrollerRef.value) scrollerRef.value.addEventListener("scroll", onScroll);

  // ✅ composer 높이 실측 → CSS 변수 동기화
  syncComposerHeightVar();

  // ✅ (알림 진입) mid가 있으면 그 메시지로, 없으면 마지막 메시지로
  if (fromNoti) {
    if (targetMid) {
      await ensureMessageVisible(targetMid, 6);
    } else {
      const last = items.value?.length ? items.value[items.value.length - 1] : null;
      const lastMid = last?.messageId;
      if (lastMid) await scrollAndFlashMessage(lastMid, { block: "end" });
    }
  }

  // ✅ 화면 크기/주소창 변화/키보드 등으로 높이 달라질 때 다시 측정
  window.addEventListener("resize", syncComposerHeightVar);

  offEvent = sse.onEvent((evt) => {
    const type = evt?.type;
    const payload = evt?.data;
    if (!type) return;

    if (type === "message-created") {
      if (String(payload?.conversationId) !== String(conversationId.value)) return;

      const mid = payload?.messageId;
      if (mid && hasMessage(mid)) return;

      appendIncomingMessage({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content,
        createdAt: payload.createdAt,
        attachments: payload.attachments || [],
        pinCandidates: payload.pinCandidates || [],
      });

      return;
    }

    if (type === "message-updated") {
      if (String(payload?.conversationId) !== String(conversationId.value)) return;

      const mid = String(payload?.messageId || "");
      if (!mid) return;

      const idx = items.value.findIndex(m => String(m.messageId) === mid);
      if (idx >= 0) {
        items.value[idx] = {
          ...items.value[idx],
          content: payload?.content ?? items.value[idx].content,
          editedAt: payload?.editedAt ?? items.value[idx].editedAt,
        };
      }

      // 내가 편집 중인 메시지가 서버에서 업데이트되면 편집모드 종료(충돌 방지)
      if (editingMid.value && String(editingMid.value) === mid) {
        cancelEdit();
      }

      return;
    }

    if (type === "conversation-read") {
      if (String(payload?.conversationId) !== String(conversationId.value)) return;

      const uid = String(payload?.userId || "");
      const at = payload?.lastReadAt || null;
      if (!uid) return;

      const arr = [...(readReceipts.value || [])];
      const idx = arr.findIndex((x) => String(x.userId) === uid);

      // ✅ NEW: 더 과거 lastReadAt이 들어오면 무시 (읽음이 뒤로 가는 것 방지)
      if (idx >= 0) {
        const cur = arr[idx]?.lastReadAt;
        if (cur && at) {
          const curT = parseTime(cur);
          const newT = parseTime(at);
          if (curT != null && newT != null && newT < curT) return;
        }
      }

      if (idx >= 0) arr[idx] = { ...arr[idx], lastReadAt: at };
      else arr.push({ userId: uid, lastReadAt: at });

      readReceipts.value = arr;
      return;
    }

    if (type === "pin-created") {
      if (payload) pinsStore.ingestPinCreated?.(payload);
      return;
    }

    if (type === "pin-updated") {
      if (payload) pinsStore.ingestPinUpdated?.(payload);
      return;
    }
  });

  offStatus = sse.onStatus(({ connected }) => {
    // false -> true 로 바뀌는 순간만
    if (connected && !_wasConnected) {
      syncTailAfterReconnect();
    }
    _wasConnected = connected;
  });

  // ✅ 분 경계에 맞춰 갱신(방금/1분 전 자연스럽게)
  const delay = 60000 - (Date.now() % 60000);
  _msgTimeTimer = setTimeout(() => {
    nowTick.value = Date.now();
    _msgTimeTimer2 = setInterval(() => {
      nowTick.value = Date.now();
    }, 60000);
  }, delay);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncComposerHeightVar); // ✅ 추가

  if (scrollerRef.value) scrollerRef.value.removeEventListener("scroll", onScroll);
  if (offEvent) offEvent();
  if (offStatus) offStatus();
  offStatus = null;

  convStore.setActiveConversation?.(null);

  for (const t of savedBadgeTimers.values()) clearTimeout(t);
  savedBadgeTimers.clear();

  if (_msgTimeTimer) clearTimeout(_msgTimeTimer);
  if (_msgTimeTimer2) clearInterval(_msgTimeTimer2);
  if (_readTouchTimer) clearTimeout(_readTouchTimer);
  _msgTimeTimer = null;
  _msgTimeTimer2 = null;
  _readTouchTimer = null;
});
</script>

<template>
  <div ref="pageRef" class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>

      <button class="peer" type="button" @click="openPeerProfile" :disabled="!hasPeer">
        <div class="peerAva" aria-hidden="true">{{ peerInitial() }}</div>
        <div class="peerMeta">
          <div class="peerName">{{ peerName }}</div>
          <div class="peerHandle" v-if="isGroupConversation">{{ peerHandle }}</div>
          <div class="peerHandle" v-else-if="peerHandle">@{{ peerHandle }}</div>
          <div class="peerHandle" v-else>프로필</div>
        </div>
      </button>

      <div class="right">
        <RlButton
            size="sm"
            variant="soft"
            @click="lockEnabled ? openLockModal('disable') : openLockModal('set')"
        >
          {{ lockEnabled ? "🔒 잠금 해제" : "🔓 잠금 설정" }}
        </RlButton>
      </div>
    </div>

    <SseStatusBanner />

    <div v-if="isGroupConversation && groupMembers.length" class="groupMembersInline rl-cardish">
      <div class="groupMembersHead">초대된 멤버</div>
      <div class="groupMembersList">
        <span v-for="m in groupMembers" :key="m.userId || m.id || m.handle || m.name" class="groupMemberChip">
          {{ m.nickname || m.name || m.handle || "멤버" }}
        </span>
      </div>
    </div>

    
<!-- ✅ RealLife v2: Active Actions Dock -->
<div class="dockWrap" v-if="canViewConversation" :class="{ dockPulse: dockPulseOn }">
  <div class="dockBar">
    <button
      class="dockTab"
      :class="{ on: dockMode==='active' }"
      type="button"
      @click="openActiveDock"
    >
      📌 액션 <span class="dockCount">{{ activeCount }}</span>
    </button>

    <button
      class="dockTab"
      :class="{ on: dockMode==='suggestions' }"
      type="button"
      :disabled="suggestionCount===0"
      @click="dockMode='suggestions'; dockOpen=!dockOpen"
    >
      ✨ 제안 <span class="dockCount">{{ suggestionCount }}</span>
    </button>

    <div class="dockSpacer"></div>

    <RlButton
      size="sm"
      variant="ghost"
      class="dockMore"
      @click="
        clearPinRemindBadge();
        router.push(`/inbox/conversations/${conversationId}/pins`)
      "
    >
      전체
      <span v-if="hasPinRemindBadge" class="pinRemindDot" title="리마인드 도착"></span>
    </RlButton>
  </div>

  <div v-if="dockOpen" class="dockPanel" :class="{ enter: dockAnimating }">
    <!-- Active -->
    <div v-if="dockMode==='active'" class="dockGrid">
      <div class="dockFilterBar">
        <button class="dockPill" :class="{ on: activeFilter==='ALL' }" type="button" @click="activeFilter='ALL'">
          전체 <span class="dockPillCount">{{ activeCount }}</span>
        </button>
        <button class="dockPill" :class="{ on: activeFilter==='PROMISE' }" type="button" @click="activeFilter='PROMISE'">
          📅 약속
        <span class="dockPillCount">{{ activeCounts.PROMISE }}</span>
        </button>
        <button class="dockPill" :class="{ on: activeFilter==='TODO' }" type="button" @click="activeFilter='TODO'">
          ✅ 할일
        <span class="dockPillCount">{{ activeCounts.TODO }}</span>
        </button>
        <button class="dockPill" :class="{ on: activeFilter==='PLACE' }" type="button" @click="activeFilter='PLACE'">
          📍 장소
        <span class="dockPillCount">{{ activeCounts.PLACE }}</span>
        </button>
      </div>

      <div v-if="pins && pins.length" class="dockTimelineHero">
        <div class="timelineHeroHead">
          <div>
            <div class="timelineHeroEyebrow">Action Timeline</div>
            <div class="timelineHeroTitle">이 대화에서 바로 이어갈 액션</div>
          </div>
          <div class="timelineHeroTotal">{{ dockTimelineSummary.total }}개</div>
        </div>

        <div class="timelineHeroStats">
          <div class="timelineStat">
            <span class="timelineStatK">📅 약속</span>
            <strong>{{ dockTimelineSummary.promises }}</strong>
            <span class="timelineStatSub">시간이 있는 액션</span>
          </div>
          <div class="timelineStat">
            <span class="timelineStatK">✅ 할일</span>
            <strong>{{ dockTimelineSummary.todos }}</strong>
            <span class="timelineStatSub">바로 체크 가능한 항목</span>
          </div>
          <div class="timelineStat">
            <span class="timelineStatK">📍 장소</span>
            <strong>{{ dockTimelineSummary.places }}</strong>
            <span class="timelineStatSub">나중에 다시 꺼낼 위치</span>
          </div>
        </div>

        <div class="timelineScanStrip">
          <div class="timelineScanCard" data-tone="accent">
            <span class="timelineScanLabel">지금 먼저 볼 것</span>
            <strong>{{ dockTimelineSummary.nextTitle || (dockStatusSummary.overdue ? '시간 지난 액션 확인' : '바로 할 일 점검') }}</strong>
            <span class="timelineScanMeta">{{ dockTimelineSummary.nextTitle ? dockTimelineSummary.nextLabel : timelinePrimaryMeta }}</span>
          </div>
          <div class="timelineScanCard" data-tone="warn">
            <span class="timelineScanLabel">왜 지금 봐야 하나</span>
            <strong>{{ timelinePriorityReason.title }}</strong>
            <span class="timelineScanMeta">{{ timelinePriorityReason.description }}</span>
          </div>
          <div class="timelineScanCard" data-tone="soft">
            <span class="timelineScanLabel">어디서 바로 처리하나</span>
            <strong>{{ timelineActionPath.title }}</strong>
            <span class="timelineScanMeta">{{ timelineActionPath.description }}</span>
          </div>
        </div>

        <div class="timelineFocusRow">
          <div class="timelineFocusCard" data-tone="upcoming">
            <span class="timelineFocusLabel">다가오는 일정</span>
            <strong>{{ dockStatusSummary.upcoming }}</strong>
            <span class="timelineFocusMeta">예정된 약속</span>
          </div>
          <div class="timelineFocusCard" data-tone="warn">
            <span class="timelineFocusLabel">시간 지난 액션</span>
            <strong>{{ dockStatusSummary.overdue }}</strong>
            <span class="timelineFocusMeta">시간 확인 필요</span>
          </div>
          <div class="timelineFocusCard" data-tone="todo">
            <span class="timelineFocusLabel">바로 할 일</span>
            <strong>{{ dockStatusSummary.todoReady }}</strong>
            <span class="timelineFocusMeta">체크 가능한 항목</span>
          </div>
        </div>

        <div v-if="nextReminderPin" class="timelineReminderCard">
          <div>
            <div class="timelineReminderEyebrow">Action Reminder</div>
            <div class="timelineReminderTitle">다음 리마인더는 “{{ nextReminderPin.title || '액션' }}”예요</div>
            <div class="timelineReminderMeta">{{ reminderTimeText(nextReminderPin) }}</div>
          </div>
          <div class="timelineReminderActions">
            <span class="timelineReminderCount">오늘 {{ reminderTodayCount }}개 · 24시간 내 {{ reminderDueSoonCount }}개</span>
            <button class="timelineReminderBtn" type="button" @click="openReminderPins(nextReminderPin)">리마인더 보기</button>
          </div>
        </div>

        <div v-if="dockTimelineSummary.nextTitle" class="timelineHeroNext">
          <span class="timelineHeroNextLabel">다음 약속</span>
          <span class="timelineHeroNextTitle">{{ dockTimelineSummary.nextTitle }}</span>
          <span class="timelineHeroNextTime">{{ dockTimelineSummary.nextLabel }}</span>
        </div>

        <div v-if="recentPinActivity.length" class="timelineRecent">
          <div class="timelineRecentHead">최근 처리</div>
          <div class="timelineRecentList">
            <div v-for="item in recentPinActivity" :key="item.id" class="timelineRecentItem">
              <span class="timelineRecentBadge" :data-tone="pinActivityTone(item)">{{ pinActivityLabel(item) }}</span>
              <div class="timelineRecentBody">
                <div class="timelineRecentTitle">{{ item.title }}</div>
                <div class="timelineRecentMeta">{{ pinActivityMeta(item) }}</div>
              </div>
              <button class="timelineRecentShare" type="button" @click="sharePinActivityToFeed(item)">피드 공유</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pins && pins.length" class="dockRowWrap">
        <div v-if="dockVisibleSummary.hasMany" class="dockBrowseHint">아래 카드에서 이어지는 액션을 계속 볼 수 있어요.</div>
        <div class="dockRow">
        <div v-for="p in dockActivePinsToShow" :key="p.pinId" class="dockCard" :data-pin-id="String(p.pinId)" :class="{ moved: dockJustMovedPinId===String(p.pinId), placeholder: !!p.__placeholder }" @click="p.__placeholder ? null : openPinEdit(p)">
          <div class="dockCardTopline">
            <span class="dockTypePill">{{ pinKindMeta(p).emoji }} {{ pinKindMeta(p).label }}</span>
            <span class="dockStatePill" :data-tone="pinTimelineState(p).tone">{{ pinTimelineState(p).label }}</span>
          </div>
          <div class="dockCardTitle">{{ p.title || "약속" }}</div>
          <div class="dockCardMeta">
            <span v-if="p.startAt">🕒 {{ pinTimeText(p) }}</span>
            <span v-else class="muted">🕒 시간 미정</span>
            <span v-if="p.placeText" class="sep">·</span>
            <span v-if="p.placeText">📍 {{ p.placeText }}</span>
          </div>
          <div class="dockCardSummary">
            <div class="dockCardSummaryLine">
              <span class="dockCardSummaryLabel">지금 상태</span>
              <span class="dockCardSummaryText">{{ pinPrimarySummary(p) }}</span>
            </div>
            <div class="dockCardSummaryLine">
              <span class="dockCardSummaryLabel">다음 액션</span>
              <span class="dockCardSummaryText">{{ pinSecondarySummary(p) }}</span>
            </div>
          </div>
          <div v-if="p.remindAt" class="dockReminderRow">⏰ {{ reminderTimeText(p) }}</div>
          <div class="dockProgress">
            <div class="dockProgressFill" :style="{ width: pinTimelineState(p).progress + '%' }"></div>
          </div>
          <div class="dockCardHint">{{ pinCtaHint(p) }}</div>
          <div v-if="pinTimelineEvents(p).length" class="dockCardTimeline">
            <div class="dockCardTimelineHead">Action Timeline</div>
            <div class="dockCardTimelineList">
              <div v-for="event in pinTimelineEvents(p)" :key="event.key" class="dockCardTimelineItem" :data-tone="event.tone">
                <span class="dockCardTimelineDot" aria-hidden="true"></span>
                <span class="dockCardTimelineTime">{{ pinTimelineTimeText(event.time) }}</span>
                <span class="dockCardTimelineLabel">{{ event.label }}</span>
              </div>
            </div>
          </div>
          <div v-if="!p.__placeholder" class="dockCardActions" @click.stop>
            <button class="dockMiniBtn dockMiniBtn--soft" type="button" @click="openPinEdit(p)">수정</button>
            <button class="dockMiniBtn dockMiniBtn--primary" type="button" @click="openPinActionModal('DONE', p)">완료</button>
            <button class="dockMiniBtn dockMiniBtn--danger" type="button" @click="openPinActionModal('CANCELED', p)">취소</button>
          </div>
          <button v-if="!p.__placeholder" class="dockShareBtn" type="button" @click.stop="sharePinToFeed(p)">피드에 공유</button>
        </div>
        </div>
      </div>
      <div v-else class="dockEmpty">아직 저장된 액션이 없어요. 메시지의 ✨로 약속/할일을 바로 만들어보세요.</div>
    </div>

    <!-- Suggestions -->
    <div v-else class="dockGrid">
      <div v-if="dockSourceMsg" class="dockSuggestHead">
        <div class="dockSuggestTitle">✨ 제안</div>
        <div class="dockSuggestSub">“{{ dockSourceMsg.content }}”에서 생성된 후보</div>
      </div>

      <div v-if="dockCandidates && dockCandidates.length" class="dockSuggestList">
        <div v-for="(c, i) in sortedDockCandidates.slice(0, 3)" :key="c.candidateId" class="dockSlot" :data-cid="String(c.candidateId)">
        <PinCandidateCard
          :candidate="c"
          :class="{ leaving: savingCandidateId===String(c.candidateId) }"
          :busy="dockSourceMsg ? isConfirmBusy(dockSourceMsg.messageId) : false"
          @confirm="dockSourceMsg && confirmCandidate(dockSourceMsg, $event)"
          @dismiss="dockSourceMsg && dismissCandidate(dockSourceMsg, $event)"
        />
      </div>
      </div>

      <div v-else class="dockEmpty">표시할 제안이 없어요.</div>
    </div>
  </div>
</div>
<!-- ✅ 잠금 게이트 -->
    <div v-if="lockEnabled && !unlocked" class="lockGate">
      <div class="lockCard">
        <div class="lockTitle">🔒 잠금된 대화</div>
        <div class="lockSub">비밀번호를 입력해야 대화를 볼 수 있어요.</div>

        <input
            v-model="lockGatePw"
            class="lockInput"
            type="password"
            placeholder="비밀번호 입력"
            @keydown.enter.prevent="handleUnlockGate"
        />

        <div class="lockActions">
          <button class="lockBtn" type="button" @click="handleUnlockGate">열기</button>
          <button class="lockBtn soft" type="button" @click="router.back()">뒤로</button>
        </div>
      </div>
    </div>

    <AsyncStatePanel
      v-else-if="loading"
      icon="⏳"
      title="대화를 불러오는 중이에요"
      description="메시지와 액션 흐름을 연결하고 있어요."
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="대화를 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="뒤로 가기"
      @primary="loadFirst"
      @secondary="() => router.back()"
    />

    <!-- ✅ 메시지 스크롤 -->
    <div v-else ref="scrollerRef" class="scroller rl-scroll rl-scroll--premium">
      <div class="inner">
        <div class="more">
          <button v-if="hasNext" class="moreBtn" type="button" @click="loadMore">
            이전 메시지 더 보기
          </button>
        </div>

        <div
            v-for="(m, i) in items"
            :key="m.messageId"
            class="msg"
            :class="{ mine: isMineMessage(m), 'msg--flash': flashMid === String(m.messageId),
            'msg--groupPrev': isGroupWithPrev(i), 'msg--groupNext': isGroupWithNext(i),}"
            :data-mid="m.messageId"
        >
          <div
              v-if="unreadDividerMid && String(m.messageId) === String(unreadDividerMid)"
              class="unreadDivider"
          >
            <span>읽지 않은 메시지</span>
          </div>

          <div class="bubble"
            @contextmenu.prevent.stop="openMsgMenu($event, m)"
            @touchstart.passive="onBubbleTouchStart($event, m)"
            @touchend="onBubbleTouchEnd"
            @touchcancel="onBubbleTouchEnd"
            @click="onBubbleClick($event, m)"
          >
            <!-- ✅ Hover Action Bar (RealLife v1) -->
            <div
                class="hoverActions"
                v-if="!editingMid || String(m.messageId) !== String(editingMid)"
            >
              <!-- 복사: 내/상대 모두 가능 -->
              <button class="haBtn" type="button" title="복사" @click.stop="copyMessage(m)">⧉</button>

              <!-- 수정: 내 메시지만 -->
              <button
                  v-if="isMineMessage(m)"
                  class="haBtn"
                  type="button"
                  title="수정"
                  @click.stop="startEdit(m)"
              >✎</button>

              <!-- 후보(약속/핀) 펼치기: 후보 있을 때만 -->
              <button
                  v-if="m.pinCandidates && m.pinCandidates.length"
                  class="haBtn"
                  type="button"
                  :title="isCandidatesOpen(m.messageId) ? '후보 닫기' : '후보 보기'"
                  @click.stop="toggleCandidates(m.messageId)"
              >✨</button>
            </div>

            <!-- ✅ 저장됨 배지 -->
            <span v-if="isSavedBadgeOn(m.messageId)" class="savedBadge" aria-live="polite">저장됨</span>

            <!-- ✅ 본문 -->
            <div class="text">
              <!-- 편집 모드 -->
              <template v-if="editingMid && String(m.messageId) === String(editingMid)">
                <textarea
                    v-model="editingText"
                    class="editBox"
                    rows="2"
                    :disabled="savingEdit"
                ></textarea>

                <div class="editActions">
                  <button class="editBtn" :disabled="savingEdit" @click="cancelEdit">취소</button>
                  <button class="editBtn editBtn--primary" :disabled="savingEdit" @click="saveEdit(m)">
                    저장
                  </button>
                </div>
              </template>

              <!-- 일반 모드 -->
              <template v-else>
                <div>
                  {{ m.content }}
                  <span v-if="m.editedAt" class="editedMark">(수정됨)</span>
                </div>
              </template>
            </div>

            <!-- ✅ optimistic send 상태 -->
            <div v-if="m._status" class="sendState" :data-status="m._status">
              <template v-if="m._status === 'sending'">전송 중…</template>

              <template v-else-if="m._status === 'failed'">
                전송 실패
                <button class="retryBtn" type="button" @click="retrySend(m)">재시도</button>
              </template>
            </div>
          </div>

          <div v-if="getReadLabel(m)" class="readReceipt">{{ getReadLabel(m) }}</div>

          <div v-if="!isGroupWithNext(i)" class="time">{{ messageTimeText(m) }}</div>
        </div>

        <div class="bottomSpacer"></div>
      </div>
    </div>

    <!-- ✅ 새 메시지 배너 -->
    <button v-if="newMsgCount > 0" class="newBanner" type="button" @click="jumpToNewest">
      새 메시지 {{ newMsgCount }}개 · 아래로
    </button>

    <!-- ✅ composer (항상 화면 하단에 보이게 CSS에서 sticky 처리) -->
    <div ref="composerRef" class="composerWrap" v-if="canViewConversation">
      <div v-if="pendingAction" class="pendingBridge" :class="{ 'pendingBridge--highlight': pendingHighlight }">
      <div class="pbHead">
        <div>
          <div class="pbEyebrow">{{ pendingSourceMeta() }}</div>
          <div class="pbTitle">댓글에서 가져온 액션</div>
          <div class="pbSub">
            <span class="pbKind">{{ pendingKindLabel(pendingAction.kind) }}</span>
            <span class="pbQuote">“{{ pendingAction.text }}”</span>
          </div>
        </div>
        <span v-if="pendingActionPrimed" class="pbReady">입력 준비됨</span>
      </div>
      <div v-if="pendingSourcePreview()" class="pbSourcePreview">원문: {{ pendingSourcePreview() }}</div>
      <div class="pbHint">바로 보내면 이 대화의 ✨ 제안 Dock으로 이어집니다.</div>
      <div class="pbActions">
        <RlButton size="sm" variant="primary" @click="quickSendPendingAction">바로 보내고 제안 열기</RlButton>
        <RlButton size="sm" variant="soft" @click="() => { primePendingAction(false, true); bumpPendingHighlight(); }">입력창에 넣기</RlButton>
        <RlButton v-if="pendingSourceRoute()" size="sm" variant="soft" @click="goPendingSource">원문 보기</RlButton>
        <RlButton size="sm" variant="ghost" @click="clearPendingAction">닫기</RlButton>
      </div>
    </div>

    <div class="composerInner">
        <input v-model="content" class="input" placeholder="메시지 입력…" @keydown.enter.prevent="onSend" />
        <button class="btn" type="button" @click="onSend" :disabled="sending">
          {{ sending ? "..." : "전송" }}
        </button>
      </div>
    </div>

    <!-- ✅ 핀 액션 모달 -->
    <RlModal
        :open="pinModalOpen"
        :title="pinModalTitle"
        :subtitle="pinModalSubtitle"
        :blockClose="pinActionLoading"
        :closeOnBackdrop="!pinActionLoading"
        @close="closePinActionModal"
    >
      <div class="pinModalBody">
        <div class="pinModalLine">
          <span class="k">제목</span>
          <span class="v">{{ pinModalPin?.title || "약속" }}</span>
        </div>
        <div class="pinModalLine">
          <span class="k">
          📍 장소
        </span>
          <span class="v">{{ pinModalPin?.placeText || "미정" }}</span>
        </div>
        <div class="pinModalLine">
          <span class="k">시간</span>
          <span class="v">{{ pinTimeText(pinModalPin) }}</span>
        </div>
      </div>

      <template #actions>
        <RlButton
            block
            :variant="pinModalConfirmVariant"
            :loading="pinActionLoading"
            @click="confirmPinAction"
        >
          {{ pinModalConfirmText }}
        </RlButton>

        <RlButton block variant="ghost" :disabled="pinActionLoading" @click="closePinActionModal">
          닫기
        </RlButton>
      </template>
    </RlModal>

    <RlModal
        :open="pinEditOpen"
        title="✏️ 핀 수정"
        subtitle="제목/시간/장소를 수정할 수 있어요."
        :blockClose="pinEditLoading"
        :closeOnBackdrop="!pinEditLoading"
        @close="closePinEdit"
    >
      <div class="pinEditBody">
        <label class="pinEditField">
          <div class="pinEditLabel">제목</div>
          <input
              class="pinEditInput"
              v-model="pinEditTitle"
              placeholder="예: 홍대에서 저녁 약속"
              :disabled="pinEditLoading"
          />
        </label>

        <label class="pinEditField">
          <div class="pinEditLabel">시간</div>
          <input
              class="pinEditInput"
              v-model="pinEditStartAtLocal"
              type="datetime-local"
              :disabled="pinEditLoading"
          />
        </label>

        <label class="pinEditField">
          <div class="pinEditLabel">리마인드</div>
          <select class="pinEditInput" v-model.number="pinEditRemindMinutes" :disabled="pinEditLoading">
            <option v-for="o in REMIND_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>

        <label class="pinEditField">
          <div class="pinEditLabel">
          📍 장소
        </div>
          <input
              class="pinEditInput"
              v-model="pinEditPlaceText"
              placeholder="예: 홍대입구 3번출구 / 회사 앞 / ○○ 술집"
              :disabled="pinEditLoading"
          />
        </label>
      </div>

      <template #actions>
        <RlButton block variant="primary" :loading="pinEditLoading" @click="submitPinEdit">저장</RlButton>
        <RlButton block variant="ghost" :disabled="pinEditLoading" @click="closePinEdit">닫기</RlButton>
      </template>
    </RlModal>

    <!-- ✅ 잠금 설정/해제 모달(기존 유지) -->
    <div v-if="lockModalOpen" class="modalBackdrop" @click.self="closeLockModal">
      <div class="modal rl-cardish">
        <div class="mTitle">
          {{ lockModalMode === "set" ? "🔓 대화 잠금 설정" : "🔒 대화 잠금 해제" }}
        </div>
        <div class="mSub" v-if="lockModalMode === 'set'">
          이 DM에 들어갈 때마다 비밀번호를 입력해야 해요.
        </div>
        <div class="mSub" v-else>
          잠금을 해제하려면 비밀번호를 입력해 주세요.
        </div>

        <div class="mBody">
          <input
              v-model="lockPw1"
              class="mInput"
              type="password"
              :placeholder="lockModalMode === 'set' ? '비밀번호' : '비밀번호 입력'"
              @keydown.enter.prevent="submitLockModal"
          />
          <input
              v-if="lockModalMode === 'set'"
              v-model="lockPw2"
              class="mInput"
              type="password"
              placeholder="비밀번호 확인"
              @keydown.enter.prevent="submitLockModal"
          />
        </div>

        <div class="mActions">
          <button class="mBtn" type="button" @click="submitLockModal">
            {{ lockModalMode === "set" ? "잠금 설정" : "잠금 해제" }}
          </button>
          <button class="mBtn soft" type="button" @click="closeLockModal">취소</button>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div v-if="menu.open" class="msgMenuOverlay" @mousedown="closeMsgMenu">
      <div
          class="msgMenuPopover"
          :style="{ top: menu.top + 'px', left: menu.left + 'px' }"
          @mousedown.stop
      >
        <button class="msgMenuItem" type="button" @click="copyMessage(menu.msg)">복사</button>

        <button
            v-if="menu.msg && isMineMessage(menu.msg)"
            class="msgMenuItem"
            type="button"
            @click="startEditFromMenu(menu.msg)"
        >
          수정
        </button>

        <button
            v-if="menu.msg && menu.msg.pinCandidates && menu.msg.pinCandidates.length"
            class="msgMenuItem"
            type="button"
            @click="toggleCandidatesFromMenu(menu.msg)"
        >
          후보 보기/닫기
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* =========================
   핵심: 화면 고정 레이아웃
   ========================= */
.page{
  /* ✅ window(바디) 스크롤이 생기지 않게, 화면을 고정 */
  position: fixed;
  left: 0;
  right: 0;

  /* ✅ AppHeader에 가리지 않게 */
  top: var(--app-header-h, 64px);

  /* ✅ 하단 탭바가 있다면 이 값만큼 비워둠(기본 72px) */
  bottom: var(--app-bottombar-h, 72px);

  display:flex;
  flex-direction:column;
  min-height:0;
  overflow:hidden;
  background: transparent;
}

/* 상단바 */
.topbar{
  padding: 12px 12px 10px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
}

.peer{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  border:1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 84%, transparent);
  padding:8px 10px;
  border-radius: 16px;
  cursor:pointer;
  text-align:left;
}
.peer:disabled{opacity:.7;cursor:default}
.peer:hover{border-color: color-mix(in oklab, var(--accent) 28%, var(--border));}
.peerAva{
  width:34px;height:34px;border-radius:50%;
  display:grid;place-items:center;
  background:
      radial-gradient(12px 12px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white));
  color:#0b0f14;
  font-weight:950;
  flex:0 0 auto;
}
.peerMeta{min-width:0;display:flex;flex-direction:column;gap:2px}
.peerName{font-weight:950;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.peerHandle{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.right{display:flex;justify-content:flex-end}
.groupMembersInline{margin-top:10px;padding:12px 14px;border:1px solid color-mix(in oklab,var(--border) 80%, transparent);background:color-mix(in oklab,var(--surface) 82%, transparent);border-radius:16px}
.groupMembersHead{font-size:11px;font-weight:900;color:var(--muted);margin-bottom:8px}
.groupMembersList{display:flex;flex-wrap:wrap;gap:8px}
.groupMemberChip{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--accent) 26%, transparent);background:color-mix(in oklab,var(--accent) 10%, transparent);font-size:12px;font-weight:800;color:color-mix(in oklab,var(--text) 90%, white)}

.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

.pinRemindDot{
  display:inline-block;
  width:8px;height:8px;
  margin-left:8px;
  border-radius:999px;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
  vertical-align: middle;
}

/* 잠금 게이트 */
.lockGate{
  flex:1;
  display:grid;
  place-items:center;
  padding: 0 14px 18px;
}
.lockCard{
  max-width: 420px;
  width: 100%;
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: var(--r-lg);
  padding: 16px;
  backdrop-filter: blur(14px);
}
.lockTitle{font-weight:950;font-size:16px}
.lockSub{margin-top:6px;color:var(--muted);font-size:12px}
.lockInput{
  width:100%;
  margin-top:12px;
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text);
}
.lockActions{display:flex;gap:8px;margin-top:12px}
.lockBtn{
  flex:1;
  height:44px;
  border-radius:16px;
  border:1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background:color-mix(in oklab, var(--accent) 16%, transparent);
  font-weight:950;
  color:var(--text);
}
.lockBtn.soft{
  border:1px solid var(--border);
  background:transparent;
}

/* =========================
   메시지 스크롤 영역
   ========================= */
.scroller{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px;

  /* ✅ composer가 sticky로 떠도 마지막 메시지가 가려지지 않게 */
  padding-bottom: calc(var(--composer-h, 82px) + 18px);
}
.inner{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  flex-direction:column;
  gap:10px;
  padding-bottom: 12px;
}

.more{display:grid;place-items:center}
.moreBtn{
  height:40px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text);
  font-weight:900;
}

.msg{display:flex;flex-direction:column;align-items:flex-start}
.msg.mine{align-items:flex-end}

.bubble{
  position: relative;
  overflow: visible;
  max-width:75%;
  padding:10px 14px;
  border-radius:18px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  border:1px solid var(--border);
  font-size:13.5px;
  line-height:1.45;
  white-space:pre-wrap;
}
.msg.mine .bubble{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  border-color:color-mix(in oklab,var(--accent) 40%,var(--border));
}
.text{white-space:pre-wrap}
.time{font-size:11px;color:var(--muted);margin-top:4px}
.candidates{ margin-top: 10px; display: grid; gap: 8px; }
.bottomSpacer{height:10px}

/* ✅ 새 메시지 배너: composer 위에 안정적으로 */
.newBanner{
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--composer-h, 82px) + 16px);
  z-index: 50;

  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 14%, var(--bg));
  color: var(--text);
  font-weight: 950;
}

/* =========================
   composer: 항상 하단 고정
   ========================= */
.composerWrap{
  position: sticky;
  bottom: 0;
  z-index: 60;

  padding: 10px 12px 14px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  background: color-mix(in oklab, var(--bg) 92%, transparent);
  border-top: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  backdrop-filter: blur(10px);
}

.timelineHeroHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.timelineHeroEyebrow{
  font-size:11px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:rgba(255,255,255,.46);
}
.timelineHeroTitle{
  margin-top:4px;
  font-size:15px;
  font-weight:900;
  letter-spacing:-.02em;
}
.timelineHeroTotal{
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  color:rgba(255,255,255,.92);
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);
}
.dockTimelineHero{
  margin-bottom:12px;
  padding:14px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
    color-mix(in oklab, var(--surface) 90%, rgba(10,18,40,.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}
.timelineHeroStats{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
  margin-top:12px;
}
.timelineStat{
  display:grid;
  gap:4px;
  padding:10px 11px;
  border-radius:14px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
}
.timelineStatK{
  font-size:12px;
  color:rgba(255,255,255,.66);
}
.timelineStat strong{
  font-size:18px;
  line-height:1;
}
.timelineStatSub{
  font-size:11px;
  color:rgba(255,255,255,.54);
}
.timelineScanStrip{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
  margin-top:12px;
}
.timelineScanCard{
  display:grid;
  gap:6px;
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.03);
}
.timelineScanCard[data-tone="accent"]{
  border-color:color-mix(in oklab, var(--accent) 32%, rgba(255,255,255,.08));
}
.timelineScanCard[data-tone="warn"]{
  border-color:color-mix(in oklab, var(--warning) 36%, rgba(255,255,255,.08));
}
.timelineScanCard[data-tone="soft"]{
  border-color:color-mix(in oklab, var(--success) 30%, rgba(255,255,255,.08));
}
.timelineScanLabel{
  font-size:11px;
  font-weight:900;
  color:rgba(255,255,255,.6);
}
.timelineScanCard strong{
  font-size:14px;
  line-height:1.35;
}
.timelineScanMeta{
  font-size:12px;
  line-height:1.45;
  color:rgba(255,255,255,.72);
}
.timelineHeroNext{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  margin-top:12px;
  padding-top:12px;
  border-top:1px solid rgba(255,255,255,.06);
}
.timelineHeroNextLabel{
  font-size:12px;
  color:rgba(255,255,255,.58);
}
.timelineHeroNextTitle{
  font-size:13px;
  font-weight:800;
}
.timelineHeroNextTime{
  font-size:12px;
  color:rgba(255,255,255,.72);
}
.dockCardTopline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:8px;
}
.dockTypePill,
.dockStatePill{
  display:inline-flex;
  align-items:center;
  height:24px;
  padding:0 9px;
  border-radius:999px;
  font-size:11px;
  font-weight:800;
  border:1px solid rgba(255,255,255,.08);
}
.dockTypePill{
  color:rgba(255,255,255,.86);
  background:rgba(255,255,255,.035);
}
.dockStatePill{
  color:rgba(255,255,255,.88);
  background:rgba(255,255,255,.03);
}
.dockStatePill[data-tone="accent"]{
  background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.08));
}
.dockStatePill[data-tone="active"]{
  background:color-mix(in oklab, var(--success) 16%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--success) 34%, rgba(255,255,255,.08));
}
.dockStatePill[data-tone="warn"]{
  background:color-mix(in oklab, var(--warning) 18%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--warning) 40%, rgba(255,255,255,.08));
}
.dockProgress{
  height:7px;
  margin-top:10px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
  overflow:hidden;
}
.dockProgressFill{
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg, color-mix(in oklab, var(--accent) 88%, white), color-mix(in oklab, var(--success) 72%, white));
}
.dockCardSummary{
  display:grid;
  gap:8px;
  margin-top:10px;
  padding:10px 11px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.06);
  background:rgba(255,255,255,.025);
}
.dockCardSummaryLine{
  display:grid;
  gap:3px;
}
.dockCardSummaryLabel{
  font-size:11px;
  font-weight:800;
  color:rgba(255,255,255,.56);
}
.dockCardSummaryText{
  font-size:12px;
  line-height:1.45;
  color:rgba(255,255,255,.9);
}
.dockCardHint{
  margin-top:8px;
  font-size:11px;
  color:rgba(255,255,255,.58);
}
@media (max-width: 900px){
  .dockPanel{
    max-height: none;
  }
  .dockRow{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px){
  .timelineHeroStats{
    grid-template-columns:1fr;
  }
  .dockCardTopline{
    align-items:flex-start;
    flex-direction:column;
  }
  .dockRow{
    grid-template-columns: 1fr;
  }
}

.pendingBridge{
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--card) 70%, transparent);
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
}
.pbEyebrow{
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .02em;
  color: color-mix(in oklab, var(--accent) 74%, white);
}
.pbTitle{
  margin-top: 3px;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -0.2px;
}
.pbSub{
  margin-top: 4px;
  display:flex;
  gap: 8px;
  align-items:center;
  color: color-mix(in oklab, var(--text) 90%, transparent);
  font-size: 12px;
}
.pbKind{
  font-weight: 800;
}
.pbQuote{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.pbSourcePreview{
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.45;
  color: color-mix(in oklab, var(--text) 72%, transparent);
}
.pbHint{
  margin-top: 8px;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 72%, transparent);
}
.pbActions{
  margin-top: 8px;
  display:flex;
  gap: 8px;
  justify-content:flex-end;
}

.composerInner{
  display:flex;
  gap: 10px;
  align-items:center;
}
.input{
  flex:1;
  height: 44px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color: var(--text);
  padding: 0 12px;
}
.btn{
  height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 16%, transparent);
  color: var(--text);
  font-weight: 950;
}

/* ✅ 저장됨 배지 */
.savedBadge{
  position:absolute;
  top:-10px;
  right:8px;
  padding:4px 8px;
  border-radius:999px;
  font-size:11px;
  font-weight:800;
  letter-spacing:-0.2px;
  background: color-mix(in oklab, var(--accent) 22%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 55%, transparent);
  backdrop-filter: blur(6px);
  opacity: 0;
  transform: translateY(2px);
  animation: savedBadgeIn 0.12s ease-out forwards;
}
@keyframes savedBadgeIn{
  to { opacity: 1; transform: translateY(0); }
}

/* 기존 모달 스타일(유지) */
.modalBackdrop{
  position:fixed;
  inset:0;
  background: rgba(0,0,0,.45);
  display:grid;
  place-items:center;
  z-index: 80;
}
.modal{
  width: min(520px, calc(100% - 24px));
  border-radius: 18px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  padding: 14px;
}
.mTitle{font-weight:950}
.mSub{margin-top:6px;color:var(--muted);font-size:12px}
.mBody{margin-top:10px;display:grid;gap:8px}
.mInput{
  height:44px;border-radius:14px;border:1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color:var(--text);padding:0 12px;
}
.mActions{margin-top:10px;display:flex;gap:8px}
.mBtn{
  flex:1;height:44px;border-radius:14px;border:1px solid var(--border);
  background: transparent;color:var(--text);font-weight:950;
}
.mBtn.soft{opacity:.85}
.pinEditBody{padding: 10px 0 2px}
.pinEditInput{
  width:100%;
  height:44px;
  border-radius:14px;
  border:1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color: var(--text);
  padding: 0 12px;
}
.pinEditField { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
.pinEditLabel { font-size:12px; font-weight:900; color: var(--muted); }

.sendState{
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}
.sendState[data-status="sending"]{ opacity: .9; }
.sendState[data-status="failed"]{
  color: color-mix(in oklab, var(--danger) 70%, var(--text));
}
.retryBtn{
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--danger) 35%, var(--border));
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.retryBtn:hover{
  border-color: color-mix(in oklab, var(--danger) 55%, var(--border));
}

/* ===== Mobile / Narrow ===== */
@media (max-width: 520px) {
  /* 모바일에서는 탭바 높이가 더 작을 수도 있어서 기본값 조정(필요시 수정) */
  .page{
    bottom: var(--app-bottombar-h, 56px);
  }

  .topbar{
    padding: 10px 10px 8px;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "back peer"
      "lock lock";
    gap: 8px;
  }
  .topbar > :first-child { grid-area: back; }
  .peer { grid-area: peer; }
  .right { grid-area: lock; justify-content: flex-start; }

  .peer{ padding: 8px 10px; border-radius: 14px; }
  .peerAva{ width: 32px; height: 32px; }
  .peerName{ font-size: 12.5px; }

  .pinActions{
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .composerWrap{
    padding: 10px 10px 12px;
  }
  .composerInner{
    gap: 8px;
  }
  .composerInner .input{
    height: 44px;
    font-size: 16px; /* iOS 자동 줌 방지 */
  }
  .composerInner .btn{
    min-width: 72px;
    height: 44px;
  }

  .newBanner{
    left: 10px;
    right: 10px;
    width: auto;
    transform: none;
  }

  .dockWrap{
    top: 50px;
    padding: 10px 10px 0;
  }
  .dockBar{
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
  }
  .dockTab{
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
    min-height: 40px;
  }
  .dockMore{
    width: 100%;
  }
  .dockFilterBar{
    padding-left: 0;
    padding-right: 0;
  }
}

/* ===== Custom Scrollbar (ConversationDetailView scroller) ===== */
.scroller::-webkit-scrollbar { width: 8px; }
.scroller::-webkit-scrollbar-track { background: transparent; }
.scroller::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--accent) 60%, transparent),
      color-mix(in oklab, var(--accent) 40%, transparent)
  );
  border-radius: 999px;
  transition: background 0.2s ease;
}
.scroller::-webkit-scrollbar-thumb:hover { background: var(--accent); }
/* Firefox */
.scroller { scrollbar-width: thin; scrollbar-color: var(--accent) transparent; }
.msg--flash .bubble{
  outline: 2px solid color-mix(in oklab, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 15%, transparent);
  transition: outline .2s ease, box-shadow .2s ease;
}
.unreadDivider{
  margin: 14px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: .8;
}
.unreadDivider::before,
.unreadDivider::after{
  content: "";
  flex: 1;
  height: 1px;
  background: color-mix(in oklab, var(--border) 80%, transparent);
}
.unreadDivider span{
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
}
/* ✅ 같은 그룹(이전 메시지와 이어짐)이면 위 간격을 줄여서 '붙어보이게' */
.msg.msg--groupPrev {
  margin-top: -6px;
}

/* ✅ 버블 라운드도 살짝 다듬기: 그룹이면 위/아래 모서리를 덜 둥글게 */
.msg.msg--groupPrev:not(.mine) .bubble {
  border-top-left-radius: 10px;
}
.msg.msg--groupNext:not(.mine) .bubble {
  border-bottom-left-radius: 10px;
}

.msg.msg--groupPrev.mine .bubble {
  border-top-right-radius: 10px;
}
.msg.msg--groupNext.mine .bubble {
  border-bottom-right-radius: 10px;
}
.readReceipt{
  margin-top: 6px;
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  opacity: .75;
  text-align: right;
}
.editTrigger{
  margin-top: 6px;
  font-size: 11px;
  font-weight: 800;
  opacity: .65;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: right;
  width: 100%;
}

/* ===== 편집 UI (bubble 안에서 자연스럽게) ===== */
.editBox{
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1.45;
  padding: 4px 0;
}

.editActions{
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.editBtn{
  padding: 5px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  cursor: pointer;
}

.editBtn--primary{
  border: 1px solid rgba(80,160,255,.55);
  background: rgba(80,160,255,.18);
}

/* “수정됨”은 줄바꿈 말고 옆에 살짝 */
.editedMark{
  margin-left: 6px;
  font-size: 11px;
  opacity: .55;
}
/* ===== 메시지 ⋯ 메뉴 (개선) ===== */
/* 메뉴 래퍼: bubble 우상단 고정 */
.msgMenuWrap{
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 50;
}

/* 메뉴 버튼: 항상 "살짝" 보이게 (hover 없어도 어색하지 않게) */
.msgMenuBtn{
  width: 28px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,.85);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: .35;                 /* ✅ 0 → 0.35로 (항상 살짝 보임) */
  transition: opacity .15s ease, transform .15s ease, background .15s ease;
}

/* hover 시만 보이게 (모바일은 터치라 클릭하면 보임) */
.msg:hover .msgMenuBtn{
  opacity: .95;
}

.msgMenuBtn:active{
  transform: scale(.98);
}

/* 메뉴: 레이아웃을 밀지 않도록 "absolute"로 띄우기 */
.msgMenu{
  position: absolute;           /* ✅ 핵심 */
  top: 30px;
  right: 0;
  min-width: 120px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(20,25,35,.95);
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  overflow: hidden;
  z-index: 60;
}

.msgMenuItem{
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor: pointer;
}

.msgMenuItem:hover{
  background: rgba(255,255,255,.08);
}
@media (hover: none){
  /* 모바일에서는 hover UI 숨기고 ⋯만 사용 */
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

@media (pointer: coarse) and (max-width: 900px) and (max-width: 900px){
  /* 일부 WebView는 hover:none 판정이 불안정 → 터치 디바이스 강제 */
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

/* legacy */
@media (hover: none){
  .msgMenuBtn{ opacity: .6; }
}
/* ✅ 버블 안 액션 버튼 (⋯) */
.msg .bubble{ position: relative; overflow: visible; }

.msgActionBtn{
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,.9);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: .25;
  transition: opacity .15s ease, transform .15s ease;
}

.msg:hover .msgActionBtn{ opacity: .95; }
@media (hover: none){ .msgActionBtn{ opacity: .55; } }
.msgActionBtn:active{ transform: scale(.98); }

/* ✅ Teleport 메뉴 */
.msgMenuOverlay{
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.msgMenuPopover{
  position: fixed;
  min-width: 140px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(20,25,35,.95);
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  overflow: hidden;
}

.msgMenuItem{
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor: pointer;
}

.msgMenuItem:hover{
  background: rgba(255,255,255,.08);
}
/* =========================
   RealLife v1: Hover Actions
   ========================= */

.bubble {
  position: relative;
  overflow: visible;
}

/* 기본은 안 보이게, hover 시 보이게 */
.hoverActions{
  position: absolute;
  top: -10px;
  right: 6px;
  display: flex;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity .15s ease, transform .15s ease;
}

.msg:hover .hoverActions{
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* 터치 환경에서는 hover가 없으니 “살짝 보이게” */


.haBtn{
  width: 30px;
  height: 28px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(10px);
  color: rgba(255,255,255,.92);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.haBtn:hover{
  background: rgba(255,255,255,.12);
}

/* 모바일에서는 hover 액션 숨김 */
@media (hover: none) {

  .hoverActions{
    display:none;
  }

}


/* =========================
   Mobile/App adjustments
   ========================= */
.mobileOnly{ display:none; }



/* =========================
   RealLife v2: Active Actions Dock
   ========================= */
.dockWrap{
  position: sticky;
  top: 54px; /* topbar 높이에 맞춤 (필요하면 52~60 조정) */
  z-index: 20;
  padding: 10px 12px 0;
}

.dockBar{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.78);
  backdrop-filter: blur(14px);
  padding: 8px 8px;
}

.dockTab{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  cursor:pointer;
}
.dockTab.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.16);
}
.dockTab:disabled{
  opacity: .45;
  cursor: not-allowed;
}

.dockCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  font-size: 11px;
  font-weight: 950;
}

.dockSpacer{ flex: 1; }

.dockMore{ white-space: nowrap; }

.dockPanel{
  max-width: 760px;
  margin: 10px auto 0;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.64);
  backdrop-filter: blur(14px);
  padding: 10px;
  max-height: min(62vh, 760px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dockPanel::-webkit-scrollbar{ width: 8px; }
.dockPanel::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.dockGrid{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.dockRowWrap{
  display:grid;
  gap:10px;
}
.dockBrowseHint{
  padding: 0 4px;
  font-size: 11px;
  color: rgba(255,255,255,.60);
}
.dockRow{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: 6px;
}

.dockCard{
  min-width: 0;
  max-width: none;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  padding: 10px 10px;
  cursor: pointer;
}

.dockCard.placeholder{
  opacity: .65;
  filter: saturate(.85);
  border-style: dashed;
}

.dockCard.placeholder .dockCardTitle{
  opacity: .75;
}

.dockCard.placeholder{
  position: relative;
  overflow: hidden;
}
.dockCard.placeholder::after{
  content:"";
  position:absolute;
  inset:-40% -60%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent);
  transform: translateX(-30%);
  animation: rlShimmer 1.1s linear infinite;
  pointer-events:none;
}
@keyframes rlShimmer{
  from{ transform: translateX(-40%); }
  to{ transform: translateX(40%); }
}


.dockCardTitle{
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 6px;
}
.dockCardMeta{
  font-size: 12px;
  opacity: .9;
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dockCardMeta .sep{ opacity: .55; }
.dockEmpty{
  padding: 10px 8px;
  font-size: 12px;
  opacity: .8;
}

.dockSuggestHead{
  display:flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
}
.dockSuggestTitle{
  font-size: 13px;
  font-weight: 950;
}
.dockSuggestSub{
  font-size: 12px;
  opacity: .8;
}

.dockSuggestList{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 520px){
  .dockSuggestList{ grid-template-columns: repeat(1, minmax(0, 1fr)); }
}
@media (min-width: 521px) and (max-width: 900px){
  .dockSuggestList{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}


/* =========================
   Mobile/App adjustments
   ========================= */
.mobileOnly{ display:none; }



/* =========================
   RealLife v2: Active Actions Dock
   ========================= */
.dockWrap{
  position: sticky;
  top: 54px; /* topbar 높이에 맞춤 (필요하면 52~60 조정) */
  z-index: 20;
  padding: 10px 12px 0;
}

.dockBar{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.78);
  backdrop-filter: blur(14px);
  padding: 8px 8px;
}

.dockTab{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  cursor:pointer;
}
.dockTab.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.16);
}
.dockTab:disabled{
  opacity: .45;
  cursor: not-allowed;
}

.dockCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  font-size: 11px;
  font-weight: 950;
}

.dockSpacer{ flex: 1; }

.dockMore{ white-space: nowrap; }

.dockPanel{
  max-width: 760px;
  margin: 10px auto 0;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.64);
  backdrop-filter: blur(14px);
  padding: 10px;
}

.dockGrid{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.dockRow{
  display:flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.dockRow::-webkit-scrollbar{ height: 6px; }
.dockRow::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.12); border-radius: 999px; }
.dockRow::-webkit-scrollbar-track{ background: transparent; }

.dockCard{
  min-width: 190px;
  max-width: 240px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  padding: 10px 10px;
  cursor: pointer;
}
.dockCardTitle{
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 6px;
}
.dockCardMeta{
  font-size: 12px;
  opacity: .9;
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dockCardMeta .sep{ opacity: .55; }
.dockEmpty{
  padding: 10px 8px;
  font-size: 12px;
  opacity: .8;
}

.dockSuggestHead{
  display:flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
}
.dockSuggestTitle{
  font-size: 13px;
  font-weight: 950;
}
.dockSuggestSub{
  font-size: 12px;
  opacity: .8;
}

.dockSuggestList{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 520px){
  .dockSuggestList{ grid-template-columns: repeat(1, minmax(0, 1fr)); }
}
@media (min-width: 521px) and (max-width: 900px){
  .dockSuggestList{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}


/* ✅ Mobile/App: 강제 터치 모드(hover 없음 or coarse pointer) */
.mobileOnly{ display:none; }

@media (hover: none), (pointer: coarse){
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

/* ✅ Dock animations */
.dockPanel.enter{
  animation: dockIn .22s ease-out;
}
@keyframes dockIn{
  from{ opacity:0; transform: translateY(-6px) scale(.98); }
  to{ opacity:1; transform: translateY(0) scale(1); }
}
.dockCard{
  animation: cardPop .18s ease-out;
}
@keyframes cardPop{
  from{ transform: translateY(6px); opacity:.0; }
  to{ transform: translateY(0); opacity:1; }
}

/* =========================
   v2.5 Dock polish (filter + stack + animations)
   ========================= */
.dockFilterBar{
  display:flex;
  gap:8px;
  padding:10px 10px 6px;
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
}
.dockFilterBar::-webkit-scrollbar{ display:none; }
.dockPill{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: -.2px;
}
.dockPill.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 10px 24px rgba(0,0,0,.22);
}
.dockPillCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:18px;
  height:18px;
  padding:0 6px;
  border-radius:999px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.10);
  font-size: 11px;
  font-weight: 900;
}

.dockSuggestList{
  padding: 10px 12px 14px;
}
.dockSlot{
  position: relative;
}
.dockStackItem + .dockSlot{
  margin-top: 0;
}
.dockStackItem .leaving{
  animation: rl-leave .22s ease forwards;
}
@keyframes rl-leave{
  to { transform: translateY(-8px) scale(.98); opacity: 0; }
}

.dockCard.moved{
  animation: rl-moved .65s ease;
}
@keyframes rl-moved{
  0% { transform: translateY(0); box-shadow: 0 0 0 rgba(0,0,0,0); }
  35% { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(0,0,0,.35); }
  100% { transform: translateY(0); box-shadow: 0 0 0 rgba(0,0,0,0); }
}

/* 모바일: hoverAction은 숨기고(세로로 쌓임 방지), 탭/롱프레스로 메뉴 */
@media (pointer: coarse) and (max-width: 900px) and (max-width: 900px){
  .hoverActions{ display:none !important; }
}

/* =========================
   v2.6+ Dock visual polish
   ========================= */
.dockFilterBar{
  display:flex;
  gap:8px;
  padding: 10px 10px 6px;
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
}

.dockPill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.88);
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

.dockPill.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
}

.dockPillCount{
  margin-left: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  font-size: 12px;
}

/* Suggestions: 1~3 slots */
.dockSuggestList{
  display:grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 10px;
}
@media (min-width: 720px){
  .dockSuggestList{ grid-template-columns: 1fr 1fr 1fr; }
}

/* fly animation ghost */
.flyGhost{
  position: fixed;
  z-index: 99999;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(20,25,35,.94);
  box-shadow: 0 18px 46px rgba(0,0,0,.40);
  backdrop-filter: blur(14px);
  overflow: hidden;
  transition:
    left 560ms cubic-bezier(.16,1,.3,1),
    top 560ms cubic-bezier(.16,1,.3,1),
    width 560ms cubic-bezier(.16,1,.3,1),
    height 560ms cubic-bezier(.16,1,.3,1),
    border-radius 560ms cubic-bezier(.16,1,.3,1),
    box-shadow 560ms cubic-bezier(.16,1,.3,1),
    background 560ms cubic-bezier(.16,1,.3,1),
    transform 560ms cubic-bezier(.16,1,.3,1),
    opacity 520ms cubic-bezier(.2,.9,.2,1);
  opacity: 1;
}

.flyGhostInner{
  padding: 10px 12px;
}
.flyGhostTitle{
  font-weight: 900;
  font-size: 13px;
}

.flyGhostMeta{ font-size:12px; opacity:.88; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.flyGhostSub{
  margin-top: 4px;
  font-size: 12px;
  opacity: .7;
}

@keyframes rlDockPulse{
  0%{ transform: translateY(0); }
  50%{ transform: translateY(-1px); }
  100%{ transform: translateY(0); }
}
.dockWrap.dockPulse .dockPanel{
  animation: rlDockPulse 220ms cubic-bezier(.16,1,.3,1);
}

/* ===== v2.12 cinematic enhancements ===== */
.flyGhost{
  position: fixed;
  pointer-events: none;
  opacity: 0.98;
  transition:
    left 720ms cubic-bezier(.16,1,.3,1),
    top 720ms cubic-bezier(.16,1,.3,1),
    width 720ms cubic-bezier(.16,1,.3,1),
    height 720ms cubic-bezier(.16,1,.3,1),
    opacity 620ms cubic-bezier(.16,1,.3,1),
    border-radius 720ms cubic-bezier(.16,1,.3,1),
    box-shadow 720ms cubic-bezier(.16,1,.3,1),
    background 720ms cubic-bezier(.16,1,.3,1);
}

.flyGhostInner{
  width: 100%;
  height: 100%;
  animation: ghostTiltScale 720ms cubic-bezier(.16,1,.3,1) both;
  transform-origin: 70% 30%;
}

@keyframes ghostTiltScale{
  0%{ transform: rotate(-10deg) scale(1.03); }
  45%{ transform: rotate(6deg) scale(0.99); }
  100%{ transform: rotate(0deg) scale(1); }
}

/* subtle sparks */
.spark{
  position: fixed;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,.85);
  box-shadow: 0 0 10px rgba(255,255,255,.25);
  transform: translate(-50%,-50%);
  pointer-events:none;
  z-index: 10050;
  animation: sparkPop 520ms cubic-bezier(.2,.9,.2,1) both;
}
@keyframes sparkPop{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(.6) rotate(0deg); }
  15%{ opacity: 1; }
  100%{ opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.8) rotate(var(--rot)); }
}

/* placeholder shimmer */
.dockCard.placeholder{
  position: relative;
  overflow: hidden;
}
.dockCard.placeholder::after{
  content:"";
  position:absolute;
  inset:-20%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
  transform: translateX(-60%);
  animation: shimmer 900ms linear infinite;
}
@keyframes shimmer{
  0%{ transform: translateX(-60%); }
  100%{ transform: translateX(60%); }
}


/* ===== Final loop: dock visibility + unified states ===== */
.dockBar{flex-wrap:wrap;}
.dockSpacer{flex:1 1 auto;}
.dockMore{margin-left:auto;}
.dockPanel{
  max-height:min(54vh, 540px);
  overflow:auto;
  overscroll-behavior:contain;
  padding-bottom:14px;
}
.dockFilterBar{
  flex-wrap:wrap;
  overflow:visible;
  padding-bottom:0;
}
.timelineHeroStats,
.timelineFocusRow{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
}
.dockRowWrap{display:grid;gap:10px;}
.dockRow{
  display:grid !important;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:10px;
  overflow:visible;
  align-items:stretch;
}
.dockCard{
  min-width:0 !important;
  max-width:none !important;
  height:100%;
  display:flex;
  flex-direction:column;
}
.dockCardHint{
  margin-top:8px;
  min-height:32px;
  line-height:1.35;
}
.dockCardActions{
  margin-top:auto;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
}
.dockMiniBtn{
  appearance:none;
  min-width:0;
  min-height:40px;
  padding:0 12px;
  white-space:nowrap;
  border-radius:12px;
  border:1px solid color-mix(in oklab, var(--border) 86%, transparent);
  background:color-mix(in oklab, var(--surface-2) 90%, rgba(255,255,255,.03));
  color:var(--text);
  font-size:13px;
  font-weight:900;
  letter-spacing:-.01em;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
  transition:transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease;
}
.dockMiniBtn:hover{
  transform:translateY(-1px);
}
.dockMiniBtn:active{
  transform:translateY(0);
}
.dockMiniBtn--soft{
  background:color-mix(in oklab, var(--surface-2) 94%, rgba(255,255,255,.03));
}
.dockMiniBtn--primary{
  border-color:color-mix(in oklab, var(--accent) 46%, var(--border));
  background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.03));
  color:color-mix(in oklab, white 96%, var(--accent));
}
.dockMiniBtn--danger{
  border-color:color-mix(in oklab, var(--danger) 38%, var(--border));
  background:color-mix(in oklab, var(--danger) 14%, rgba(255,255,255,.03));
  color:color-mix(in oklab, white 96%, var(--danger));
}
.dockShareBtn{
  margin-top:8px;
  min-height:38px;
  width:100%;
  border-radius:12px;
  border:1px dashed color-mix(in oklab, var(--accent) 38%, var(--border));
  background:color-mix(in oklab, var(--accent) 10%, rgba(255,255,255,.03));
  color:var(--text);
  font-size:12px;
  font-weight:900;
}
.dockShareBtn:hover{background:color-mix(in oklab, var(--accent) 14%, rgba(255,255,255,.03));}
.dockTimelineHero{
  position:static;
  padding:14px;
}
.timelineFocusCard{
  border:1px solid color-mix(in oklab, var(--border) 82%, transparent);
  background: color-mix(in oklab, var(--surface-2) 78%, transparent);
  border-radius:16px;
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.timelineFocusCard[data-tone="upcoming"]{border-color: color-mix(in oklab, var(--accent) 35%, var(--border));}
.timelineFocusCard[data-tone="warn"]{border-color: color-mix(in oklab, #ffb84d 42%, var(--border));}
.timelineFocusCard[data-tone="todo"]{border-color: color-mix(in oklab, var(--success) 36%, var(--border));}
.timelineFocusLabel{font-size:11px;color:var(--muted);font-weight:800;}
.timelineFocusCard strong{font-size:24px;line-height:1;font-weight:950;}
.timelineFocusMeta{font-size:11px;color:rgba(255,255,255,.68);}
.timelineRecent{margin-top:12px;display:grid;gap:8px;}
.timelineRecentHead{font-size:11px;color:var(--muted);font-weight:900;}
.timelineRecentList{display:grid;gap:8px;}
.timelineRecentItem{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:14px;border:1px solid color-mix(in oklab, var(--border) 80%, transparent);background: color-mix(in oklab, var(--surface) 78%, transparent);}
.timelineRecentBadge{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:900;border:1px solid color-mix(in oklab, var(--border) 84%, transparent);}
.timelineRecentBadge[data-tone="done"]{background: color-mix(in oklab, var(--success) 18%, transparent);border-color: color-mix(in oklab, var(--success) 34%, var(--border));}
.timelineRecentBadge[data-tone="cancel"]{background: color-mix(in oklab, var(--danger) 14%, transparent);border-color: color-mix(in oklab, var(--danger) 34%, var(--border));}
.timelineRecentBadge[data-tone="hide"]{background: color-mix(in oklab, var(--surface-2) 76%, transparent);}
.timelineRecentBody{min-width:0;display:grid;gap:3px;}
.timelineRecentTitle{font-size:13px;font-weight:900;color:var(--text);}
.timelineRecentMeta{font-size:11px;color:var(--muted);}
.stateCardInline{max-width:760px;margin:0 auto;width:100%;padding:0 12px 12px;}
@media (max-width:900px){
  .dockWrap{top:52px;padding:8px 10px 0;}
  .dockPanel{max-height:min(52vh, 520px);}
  .timelineHeroStats,.timelineFocusRow,.timelineScanStrip{grid-template-columns:1fr;}
  .dockRow{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
  .dockBar{gap:6px;}
  .dockTab,.dockMore,.dockPill{justify-content:center;}
}
@media (max-width:640px){
  .dockWrap{top:48px;padding:8px 8px 0;}
  .dockBar{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;}
  .dockSpacer{display:none;}
  .dockMore{margin-left:0;grid-column:1 / -1;}
  .dockTab,.dockMore{width:100%;min-height:42px;}
  .dockPanel{margin-top:8px;max-height:min(46vh, 460px);padding:8px;}
  .dockFilterBar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px 2px 2px;}
  .dockPill{width:100%;}
  .timelineHeroHead{align-items:center;}
  .timelineHeroTotal{flex:0 0 auto;}
  .dockTimelineHero{padding:12px;}
  .dockRow{grid-template-columns:1fr !important;}
  .dockCard{padding:12px;}
  .dockCardActions{grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .dockMiniBtn{font-size:12px;min-height:38px;padding:0 10px;}
}


.timelineReminderCard{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-top:12px;
  padding:14px 16px;
  border-radius:18px;
  border:1px solid color-mix(in oklab,var(--accent) 26%, var(--border));
  background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%, transparent),color-mix(in oklab,var(--surface-2) 84%, transparent));
}
.timelineReminderEyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}
.timelineReminderTitle{margin-top:4px;font-size:15px;font-weight:900;line-height:1.45}
.timelineReminderMeta{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.45}
.timelineReminderActions{display:grid;gap:8px;justify-items:end}
.timelineReminderCount{font-size:12px;font-weight:800;color:color-mix(in oklab,var(--accent) 74%,white)}
.timelineReminderBtn{height:38px;padding:0 12px;border-radius:12px;border:1px solid color-mix(in oklab,var(--accent) 34%, var(--border));background:color-mix(in oklab,var(--accent) 18%, transparent);color:var(--text);font-weight:900}
.dockReminderRow{margin-top:8px;font-size:12px;line-height:1.45;color:color-mix(in oklab,var(--accent) 78%, white)}
@media (max-width: 720px){
  .timelineReminderCard{grid-template-columns:1fr;display:grid;align-items:start}
  .timelineReminderActions{justify-items:start}
}


.dockCardTimeline{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}
.dockCardTimelineHead{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .02em;
  color: var(--muted);
  margin-bottom: 8px;
}
.dockCardTimelineList{
  display:grid;
  gap: 8px;
}
.dockCardTimelineItem{
  display:grid;
  grid-template-columns: auto auto 1fr;
  align-items:center;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 86%, var(--muted));
}
.dockCardTimelineDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 70%, white);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 16%, transparent);
}
.dockCardTimelineItem[data-tone="done"] .dockCardTimelineDot{
  background: var(--success);
  box-shadow: 0 0 0 6px rgba(85, 227, 160, .14);
}
.dockCardTimelineItem[data-tone="cancel"] .dockCardTimelineDot{
  background: var(--danger);
  box-shadow: 0 0 0 6px rgba(255, 107, 125, .12);
}
.dockCardTimelineTime{
  min-width: 38px;
  font-weight: 800;
  color: var(--muted);
}
.dockCardTimelineLabel{
  font-weight: 700;
  color: var(--text);
}

</style>


<style scoped>
.timelineRecentShare{
  flex:0 0 auto;
  height:32px;
  padding:0 12px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.92);
  font-size:12px;
  font-weight:800;
}
.timelineRecentShare:hover{
  border-color:rgba(255,255,255,.22);
  background:rgba(255,255,255,.08);
}

.dockCardTimeline{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}
.dockCardTimelineHead{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .02em;
  color: var(--muted);
  margin-bottom: 8px;
}
.dockCardTimelineList{
  display:grid;
  gap: 8px;
}
.dockCardTimelineItem{
  display:grid;
  grid-template-columns: auto auto 1fr;
  align-items:center;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 86%, var(--muted));
}
.dockCardTimelineDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 70%, white);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 16%, transparent);
}
.dockCardTimelineItem[data-tone="done"] .dockCardTimelineDot{
  background: var(--success);
  box-shadow: 0 0 0 6px rgba(85, 227, 160, .14);
}
.dockCardTimelineItem[data-tone="cancel"] .dockCardTimelineDot{
  background: var(--danger);
  box-shadow: 0 0 0 6px rgba(255, 107, 125, .12);
}
.dockCardTimelineTime{
  min-width: 38px;
  font-weight: 800;
  color: var(--muted);
}
.dockCardTimelineLabel{
  font-weight: 700;
  color: var(--text);
}

</style>
