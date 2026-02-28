<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, onMounted, ref, nextTick, onBeforeUnmount } from "vue";
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
import sse from "@/lib/sse";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const convStore = useConversationsStore();
const auth = useAuthStore();
const pinsStore = useConversationPinsStore();

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

// pin edit place
const pinEditOpen = ref(false);
const pinEditPin = ref(null);
const pinEditPlace = ref("");
const pinEditLoading = ref(false);

function openPinEditPlace(pin) {
  pinEditPin.value = pin;
  pinEditPlace.value = pin?.placeText || "";
  pinEditOpen.value = true;
}
function closePinEditPlace() {
  if (pinEditLoading.value) return;
  pinEditOpen.value = false;
  pinEditPin.value = null;
  pinEditPlace.value = "";
}
async function submitPinEditPlace() {
  const p = pinEditPin.value;
  if (!p?.pinId) return;

  pinEditLoading.value = true;
  try {
    await pinUpdate(p.pinId, { placeText: pinEditPlace.value });
    await loadPins();
    toast.success?.("저장 완료", "장소를 업데이트했습니다.");
    closePinEditPlace();
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

function hasMessage(messageId) {
  if (!messageId) return false;
  return items.value.some((m) => String(m.messageId) === String(messageId));
}
function normalizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}
function scrollToBottom({ smooth = false } = {}) {
  nextTick(() => {
    const el = scrollerRef.value;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
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

  items.value.push(payload);

  const hasCandidates = Array.isArray(payload?.pinCandidates) && payload.pinCandidates.length > 0;

  if (isNearBottom()) {
    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });
    if (hasCandidates) nextTick(() => scrollToBottom({ smooth: true }));
  } else {
    newMsgCount.value += 1;
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

    convStore.setActiveConversation?.(conversationId.value);
    convStore.softSyncSoon?.();

    if (keepScroll) {
      nextTick(() => {
        const el = scrollerRef.value;
        if (!el) return;
        const newHeight = el.scrollHeight;
        el.scrollTop += newHeight - prevScrollHeight;
      });
    } else {
      scrollToBottom();
    }
  } catch (e) {
    const msg = e?.response?.data?.message || "메시지를 불러오지 못했습니다.";
    error.value = msg;

    if (e?.response?.status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || !nextCursor.value) return;
  if (!canViewConversation.value) return;

  const prevScrollHeight = scrollerRef.value?.scrollHeight ?? 0;

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
    const el = scrollerRef.value;
    if (!el) return;
    const newHeight = el.scrollHeight;
    el.scrollTop += newHeight - prevScrollHeight;
  });
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

  sending.value = true;
  try {
    const msg = await sendMessage({
      conversationId: conversationId.value,
      content: text,
      attachmentIds: [],
      unlockToken: lockEnabled.value ? unlockToken.value : null,
    });

    if (msg?.messageId && !hasMessage(msg.messageId)) {
      items.value.push(msg);
    }

    content.value = "";

    convStore.ingestMessageCreated?.({
      conversationId: conversationId.value,
      content: msg?.content,
      createdAt: msg?.createdAt,
    });

    newMsgCount.value = 0;

    const hasCandidates = Array.isArray(msg?.pinCandidates) && msg.pinCandidates.length > 0;
    scrollToBottom({ smooth: true });
    if (hasCandidates) nextTick(() => scrollToBottom({ smooth: true }));
  } catch (e) {
    if (e?.response?.status === 423) {
      lockEnabled.value = true;
      unlocked.value = false;
      clearToken();
      toast.error?.("전송 실패", "이 대화는 잠금 상태입니다. 먼저 잠금을 해제하세요.");
      return;
    }
    toast.error?.("전송 실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    sending.value = false;
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

  nextTick(() => {
    if (scrollerRef.value) scrollerRef.value.addEventListener("scroll", onScroll);
  });

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
  if (scrollerRef.value) scrollerRef.value.removeEventListener("scroll", onScroll);
  if (offEvent) offEvent();
  convStore.setActiveConversation?.(null);

  for (const t of savedBadgeTimers.values()) clearTimeout(t);
  savedBadgeTimers.clear();
});
</script>

<template>
  <div class="page">
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
                <RlButton size="sm" variant="ghost" @click="openPinEditPlace(p)">장소 추가</RlButton>
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
            :class="{ mine: isMineMessage(m) }"
        >
          <div class="bubble">
            <!-- ✅ 저장됨 배지 -->
            <span v-if="isSavedBadgeOn(m.messageId)" class="savedBadge" aria-live="polite">저장됨</span>

            <div class="text">{{ m.content }}</div>
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

    <button v-if="newMsgCount > 0" class="newBanner" type="button" @click="jumpToNewest">
      새 메시지 {{ newMsgCount }}개 · 아래로
    </button>

    <div class="composerWrap" v-if="canViewConversation">
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
        title="📍 장소 수정"
        subtitle="약속 장소를 입력해 주세요."
        :blockClose="pinEditLoading"
        :closeOnBackdrop="!pinEditLoading"
        @close="closePinEditPlace"
    >
      <div class="pinEditBody">
        <input
            class="pinEditInput"
            v-model="pinEditPlace"
            placeholder="예: 홍대입구 3번출구 / 회사 앞 / ○○ 술집"
            :disabled="pinEditLoading"
        />
      </div>

      <template #actions>
        <RlButton block variant="primary" :loading="pinEditLoading" @click="submitPinEditPlace">저장</RlButton>
        <RlButton block variant="ghost" :disabled="pinEditLoading" @click="closePinEditPlace">닫기</RlButton>
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
.page{
  height: calc(100dvh - 72px);
  display:flex;
  flex-direction:column;
  min-height:0;
  overflow:hidden;
  position: relative;
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
.pinnedWrap--flash{
  animation: pinnedFlash 0.8s ease;
}
@keyframes pinnedFlash{
  0%   { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent);
    background: color-mix(in oklab, var(--surface) 100%, transparent); }
  30%  { box-shadow: 0 0 0 10px color-mix(in oklab, var(--accent) 28%, transparent);
    background: color-mix(in oklab, var(--accent) 10%, var(--surface)); }
  100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 0%, transparent);
    background: color-mix(in oklab, var(--surface) 100%, transparent); }
}
/* ✅ PIN_REMIND badge dot */
.pinRemindDot{
  display:inline-block;
  width:8px;
  height:8px;
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
.pinnedTitle{
  font-weight: 950;
  font-size: 13px;
  opacity: .92;
}
.pinList{
  display:grid;
  gap: 8px;
}
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
.pinName{
  font-weight: 950;
  font-size: 13px;
}
.pinActions{
  display:flex;
  gap: 6px;
  flex: 0 0 auto;
}
.pinMeta{
  display:grid;
  gap: 4px;
}
.pinRow{
  font-size: 12px;
  opacity: .92;
}
.muted{
  opacity: .55;
}

/* pin modal body */
.pinModalBody{
  display:flex;
  flex-direction:column;
  gap: 8px;
  padding: 10px 0 2px;
}
.pinModalLine{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  font-size: 12px;
}
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

/* 스크롤 */
.scroller{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px;
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
  position: relative; /* ✅ 배지 위치 기준 */
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

.candidates{
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.bottomSpacer{height:10px}

.newBanner{
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 86px;
  z-index: 50;

  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 14%, var(--bg));
  color: var(--text);
  font-weight: 950;
}

/* composer */
.composerWrap{
  padding: 10px 12px 14px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
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
</style>