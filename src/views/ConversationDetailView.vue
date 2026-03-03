<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, onBeforeUnmount, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import RlModal from "@/components/ui/RlModal.vue";
import PinCandidateCard from "@/components/pins/PinCandidateCard.vue";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
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

function onPinRemindHighlight(e) {
  const cid = e?.detail?.conversationId;
  if (!cid) return;

  // 현재 보고 있는 대화방만 하이라이트
  if (String(cid) !== String(conversationId.value)) return;

  isPinnedHighlight.value = true;
  setTimeout(() => (isPinnedHighlight.value = false), 800);
}

onMounted(() => {
  window.addEventListener("pin-remind-highlight", onPinRemindHighlight);
});
onBeforeUnmount(() => {
  window.removeEventListener("pin-remind-highlight", onPinRemindHighlight);
});
const myId = computed(() => auth.me?.id || null);

/** 상대(목록 데이터 기반) */
const peer = computed(() => {
  const cid = conversationId.value;
  const row = convStore.items?.find((c) => String(c.conversationId) === String(cid));
  return row?.peerUser || null;
});

const peerName = computed(() => {
  return peer.value?.nickname || peer.value?.name || "대화";
});
const peerHandle = computed(() => {
  return peer.value?.handle || "";
});
const hasPeer = computed(() => !!peer.value);

function peerInitial() {
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
const nextCursor = ref(null);
const hasNext = ref(false);

const content = ref("");
const sending = ref(false);

const scrollerRef = ref(null);
const newMsgCount = ref(0);

const pageRef = ref(null);
const composerRef = ref(null);

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

function messageTimeText(m) {
  const s = m?.createdAt ? String(m.createdAt) : "";
  if (!s) return "";
  // hh:mm
  return s.replace("T", " ").slice(11, 16);
}

function appendIncomingMessage(payload) {
  if (!payload?.messageId) return;
  if (hasMessage(payload.messageId)) return;

  const el = scrollerRef.value;
  const shouldAutoScroll = el ? isNearBottom(el) : true;

  items.value.push(payload);

  const hasCandidates =
      Array.isArray(payload?.pinCandidates) && payload.pinCandidates.length > 0;

  if (shouldAutoScroll) {
    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });

    // pinCandidates 렌더로 높이 늘 수 있어서 한 번 더
    if (hasCandidates) {
      nextTick(() => scrollToBottom({ smooth: true }));
    }
  } else {
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

  // ✅ NEW: fetch 끝난 뒤 어떤 스크롤을 할지 "예약"만 해둠
  let shouldScrollToBottom = !keepScroll;
  let shouldKeepScroll = keepScroll;

  try {
    const res = await fetchMessages({
      conversationId: conversationId.value,
      size: 20,
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    items.value = normalizeMessages(res.items);
    nextCursor.value = res.nextCursor ?? null;
    hasNext.value = !!res.hasNext;

    await markConversationRead(conversationId.value);
    convStore.markRead?.(conversationId.value); // ✅ NEW: 목록 unread 즉시 0 반영
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
  } finally {
    loading.value = false;

    // ✅ 핵심: DOM 렌더 1번 + 레이아웃 확정(rAF 2번) 이후 스크롤을 맞춘다
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollerRef.value;
          if (!el) return;

          if (shouldKeepScroll) {
            const newHeight = el.scrollHeight;
            el.scrollTop += newHeight - prevScrollHeight;
          } else if (shouldScrollToBottom) {
            // scrollTo보다 이게 더 확실하게 "맨 아래"에 붙는 경우가 많음
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
  if (!text || sending.value) return;

  if (!conversationId.value) {
    toast.error?.("전송 실패", "대화방 ID가 없습니다.");
    return;
  }
  if (!canViewConversation.value) {
    toast.error?.("전송 실패", "잠금이 해제되어야 전송할 수 있어요.");
    return;
  }

  // ✅ NEW: temp 메시지 먼저 넣기
  const tempId = makeTempId();
  const tempMsg = {
    messageId: tempId,
    content: text,
    createdAt: new Date().toISOString(),
    pinCandidates: [],
    _status: "sending",
  };

  items.value.push(tempMsg);
  content.value = "";
  newMsgCount.value = 0;
  scrollToBottom({smooth: true});

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

    convStore.ingestMessageCreated?.({
      conversationId: conversationId.value,
      content: msg?.content,
      createdAt: msg?.createdAt,
    });

    const hasCandidates = Array.isArray(msg?.pinCandidates) && msg.pinCandidates.length > 0;
    scrollToBottom({smooth: true});
    if (hasCandidates) nextTick(() => scrollToBottom({smooth: true}));
  } catch (e) {
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.message;
    const url = e?.config?.url;

    // ✅ 401/403은 사실상 "로그인/권한 문제"
    if (status === 401) {
      toast.error?.("전송 실패", "로그인이 만료됐어요. 다시 로그인해 주세요.");
      // 선택: 로그인 페이지가 있으면 이동
      // router.push("/login");
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
      // ✅ 여기서 status를 같이 보여주면 원인 파악이 바로 됨
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
    nextTick(syncComposerHeightVar); // ✅ 추가
  }
}
async function retrySend(m) {
  // 실패 상태 메시지만 재시도
  if (!m || m._status !== "failed") return;

  // 잠금이면 재시도 막기
  if (!canViewConversation.value) {
    toast.error?.("재시도 실패", "잠금이 해제되어야 전송할 수 있어요.");
    return;
  }

  // 다시 sending 상태로
  m._status = "sending";

  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: m.content,
      attachmentIds: [],
      unlockToken: lockEnabled.value && unlocked.value ? unlockToken.value : null,
    });

    // 성공하면 temp를 실제 메시지로 교체
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
      toast.success?.("핀 생성", "Pinned에 저장했어요.");
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

onMounted(async () => {
  const ok = await ensureSessionOrRedirect();
  if (!ok) return;

  convStore.setActiveConversation?.(conversationId.value);

  await refreshLockState();
  if (canViewConversation.value) {
    await loadFirst();
    await loadPins();
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

    if (type === "pin-created") {
      if (payload) pinsStore.ingestPinCreated?.(payload);
      return;
    }

    if (type === "pin-updated") {
      if (payload) pinsStore.ingestPinUpdated?.(payload);
      return;
    }
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncComposerHeightVar); // ✅ 추가

  if (scrollerRef.value) scrollerRef.value.removeEventListener("scroll", onScroll);
  if (offEvent) offEvent();
  convStore.setActiveConversation?.(null);

  for (const t of savedBadgeTimers.values()) clearTimeout(t);
  savedBadgeTimers.clear();
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
          <div class="peerHandle" v-if="peerHandle">@{{ peerHandle }}</div>
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

    <!-- ✅ Pinned -->
    <div class="pinnedWrap" :class="{ 'pinnedWrap--flash': isPinnedHighlight }">
      <div v-if="showPinned" class="pinned">
        <div class="pinnedHead">
          <div class="pinnedTitle" @click="clearPinRemindBadge" style="cursor:pointer;">
            📌 Pinned
            <span v-if="hasPinRemindBadge" class="pinRemindDot" title="리마인드 도착"></span>
          </div>

          <RlButton
              size="sm"
              variant="ghost"
              @click="
              clearPinRemindBadge();
              router.push(`/inbox/conversations/${conversationId}/pins`)
            "
          >
            더보기
          </RlButton>
        </div>

        <div class="pinList">
          <div v-for="p in pins.slice(0, 3)" :key="p.pinId" class="pinCard">
            <div class="pinTop">
              <div class="pinName">{{ p.title || "약속" }}</div>

              <div class="pinActions">
                <RlButton size="sm" variant="soft" :loading="pinActionLoading" @click="openPinActionModal('DONE', p)">완료</RlButton>
                <RlButton size="sm" variant="danger" :loading="pinActionLoading" @click="openPinActionModal('CANCELED', p)">취소</RlButton>
                <RlButton size="sm" variant="ghost" :loading="pinActionLoading" @click="openPinActionModal('DISMISSED', p)">숨김</RlButton>
              </div>
            </div>

            <div class="pinMeta">
              <div v-if="p.placeText" class="pinRow">📍 {{ p.placeText }}</div>
              <div v-if="p.startAt" class="pinRow">🕒 {{ pinTimeText(p) }}</div>
              <div v-else class="pinRow muted">
                📍 장소 미정
                <RlButton size="sm" variant="ghost" @click="openPinEdit(p)">수정</RlButton>
              </div>
            </div>
          </div>
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

    <div v-else-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <!-- ✅ 메시지 스크롤 -->
    <div v-else ref="scrollerRef" class="scroller rl-scroll rl-scroll--premium">
      <div class="inner">
        <div class="more">
          <button v-if="hasNext" class="moreBtn" type="button" @click="loadMore">
            이전 메시지 더 보기
          </button>
        </div>

        <div
            v-for="m in items"
            :key="m.messageId"
            class="msg"
            :class="{ mine: isMineMessage(m), 'msg--flash': flashMid === String(m.messageId) }"
            :data-mid="m.messageId"
        >
          <div class="bubble">
            <!-- ✅ 저장됨 배지 -->
            <span v-if="isSavedBadgeOn(m.messageId)" class="savedBadge" aria-live="polite">저장됨</span>

            <div class="text">{{ m.content }}</div>

            <!-- ✅ optimistic send 상태 -->
            <div v-if="m._status" class="sendState" :data-status="m._status">
              <template v-if="m._status === 'sending'">전송 중…</template>

              <template v-else-if="m._status === 'failed'">
                전송 실패
                <button class="retryBtn" type="button" @click="retrySend(m)">재시도</button>
              </template>
            </div>
          </div>

          <div v-if="m.pinCandidates && m.pinCandidates.length" class="candidates">
            <PinCandidateCard
                v-for="c in m.pinCandidates"
                :key="c.candidateId"
                :candidate="c"
                :busy="isConfirmBusy(m.messageId)"
                @confirm="confirmCandidate(m, $event)"
                @dismiss="dismissCandidate(m, $event)"
            />
          </div>

          <div class="time">{{ messageTimeText(m) }}</div>
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
          <span class="k">장소</span>
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
          <div class="pinEditLabel">장소</div>
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

.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

/* ✅ Pinned */
.pinnedWrap--flash{ animation: pinnedFlash 0.8s ease; }
@keyframes pinnedFlash{
  0%   { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent);
    background: color-mix(in oklab, var(--surface) 100%, transparent); }
  30%  { box-shadow: 0 0 0 10px color-mix(in oklab, var(--accent) 28%, transparent);
    background: color-mix(in oklab, var(--accent) 10%, var(--surface)); }
  100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent);
    background: color-mix(in oklab, var(--surface) 100%, transparent); }
}
.pinRemindDot{
  display:inline-block;
  width:8px;height:8px;
  margin-left:8px;
  border-radius:999px;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
  vertical-align: middle;
}
.pinned{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  padding: 0 12px 8px;
}
.pinnedHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom: 8px;
}
.pinnedTitle{ font-weight: 950; font-size: 13px; opacity: .92; }
.pinList{ display:grid; gap: 8px; }
.pinCard{
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: 16px;
  padding: 10px 12px;
}
.pinTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.pinName{ font-weight: 950; font-size: 13px; }
.pinActions{ display:flex; gap: 6px; flex: 0 0 auto; }
.pinMeta{ display:grid; gap: 4px; }
.pinRow{ font-size: 12px; opacity: .92; }
.muted{ opacity: .55; }

/* pin modal body */
.pinModalBody{ display:flex; flex-direction:column; gap: 8px; padding: 10px 0 2px; }
.pinModalLine{ display:flex; justify-content:space-between; gap: 10px; font-size: 12px; }
.pinModalLine .k{ color: var(--muted); font-weight: 800; }
.pinModalLine .v{ color: var(--text); font-weight: 900; }

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
</style>