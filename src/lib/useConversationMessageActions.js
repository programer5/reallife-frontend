import { ref } from "vue";

export function useConversationMessageActions({
  conversationId,
  items,
  closeMsgMenu,
  openMsgMenu,
  startEdit,
  openSuggestionsDock,
  toast,
  sendMessage,
  canViewConversation,
  myId,
  lockEnabled,
  unlocked,
  unlockToken,
  clearToken,
  upsertServerMessage,
  newMsgCount,
  scrollToBottom,
  pinsStore,
  triggerDockPulse,
  nextTick,
  confirmPinFromMessage,
  rectOf,
  formatCandidateTime,
  safeText,
  classifyCandidate,
  makeCandidateGhostHtml,
  enqueueDockToActiveFly,
  dockJustMovedPinId,
  onBubbleFocus = null,
}) {
  const isTouchUi = ref(false);
  const _lpTimer = ref(null);
  const _lastTouch = ref({ x: 0, y: 0, el: null });

  const savedBadgeByMessageId = ref({});
  const savedBadgeTimers = new Map();
  const confirmBusyByMessageId = ref({});
  const savingCandidateId = ref(null);

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
    onBubbleFocus?.(m);
    if (!isTouchUi.value) return;
    const t = e?.target;
    if (t?.closest?.("button, a, textarea, input, select, .hoverActions")) return;
    openMsgMenu(e, m);
  }

  async function copyMessage(m) {
    if (!m) return;
    closeMsgMenu();
    await navigator.clipboard.writeText(m.content || "");
    toast?.success?.("복사됨", "메시지를 클립보드에 복사했어요.");
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

  async function retrySend(m) {
    if (!m || m._status !== "failed") return;

    if (!canViewConversation.value) {
      toast.error?.("재시도 실패", "잠금이 해제되어야 전송할 수 있어요.");
      return;
    }

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

    const _cid = payload?.candidateId ?? payload?.id ?? null;
    if (_cid) savingCandidateId.value = String(_cid);

    let flyDraft = null;
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
        const type = classifyCandidate(payload);
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
        overrideRemindMinutes:
          payload && Object.prototype.hasOwnProperty.call(payload, "overrideRemindMinutes")
            ? payload.overrideRemindMinutes
            : 60,
      });

      if (created?.pinId) {
        pinsStore.appendPin(conversationId.value, created);
        triggerDockPulse();
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

  function onDismissCandidate(message, candidate) {
    if (!message) return;
    if (!Array.isArray(message.pinCandidates)) return;

    message.pinCandidates = message.pinCandidates.filter(
      (c) => String(c?.candidateId) !== String(candidate?.candidateId)
    );
  }

  function confirmCandidate(m, cand) {
    onConfirmCandidate(m, cand);
  }

  function dismissCandidate(m, cand) {
    onDismissCandidate(m, cand);
  }

  return {
    isTouchUi,
    detectTouchUi,
    onBubbleTouchStart,
    onBubbleTouchEnd,
    onBubbleClick,
    copyMessage,
    startEditFromMenu,
    toggleCandidatesFromMenu,
    retrySend,
    isSavedBadgeOn,
    isConfirmBusy,
    savingCandidateId,
    confirmCandidate,
    dismissCandidate,
  };
}
