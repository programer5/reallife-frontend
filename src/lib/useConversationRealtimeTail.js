function parseTime(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? t : null;
}

export function useConversationRealtimeTail(options) {
  const {
    sse,
    conversationId,
    lockEnabled,
    unlockToken,
    items,
    readReceipts,
    editingMid,
    fetchRecentMessages,
    fetchReadReceipts,
    normalizeMessages,
    hasMessage,
    appendIncomingMessage,
    isNearBottom,
    scrollToBottom,
    touchReadDebounced,
    handleSessionSse,
    buildSessionMessageFromSession,
    cancelEdit,
    pinsStore,
  } = options;

  let offEvent = null;
  let offStatus = null;
  let wasConnected = false;

  async function syncTailAfterReconnect() {
    try {
      const res = await fetchRecentMessages?.();
      const incoming = normalizeMessages?.(res?.items || []);
      for (const message of incoming || []) {
        if (!hasMessage?.(message?.messageId)) items.value.push(message);
      }

      if (isNearBottom?.()) {
        scrollToBottom?.({ smooth: false });
        touchReadDebounced?.();
      }

      try {
        const rr = await fetchReadReceipts?.();
        readReceipts.value = rr?.items || [];
      } catch {}
    } catch {}
  }

  function onConversationRead(payload) {
    if (String(payload?.conversationId) !== String(conversationId.value)) return;

    const uid = String(payload?.userId || "");
    const at = payload?.lastReadAt || null;
    if (!uid) return;

    const arr = [...(readReceipts.value || [])];
    const idx = arr.findIndex((x) => String(x.userId) === uid);

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
  }

  function onMessageUpdated(payload) {
    if (String(payload?.conversationId) !== String(conversationId.value)) return;

    const mid = String(payload?.messageId || "");
    if (!mid) return;

    const idx = items.value.findIndex((m) => String(m.messageId) === mid);
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        content: payload?.content ?? items.value[idx].content,
        editedAt: payload?.editedAt ?? items.value[idx].editedAt,
      };
    }

    if (editingMid.value && String(editingMid.value) === mid) {
      cancelEdit?.();
    }
  }

  function onMessageCreated(payload) {
    if (String(payload?.conversationId) !== String(conversationId.value)) return;

    const mid = payload?.messageId;
    if (mid && hasMessage?.(mid)) return;

    appendIncomingMessage?.({
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      content: payload.content,
      createdAt: payload.createdAt,
      attachments: payload.attachments || [],
      pinCandidates: payload.pinCandidates || [],
    });
  }

  function setupRealtimeTail() {
    offEvent = sse.onEvent((evt) => {
      const type = evt?.type;
      const payload = evt?.data;
      if (!type) return;

      if (type === "playback-session-created") {
        const sessionMessage = buildSessionMessageFromSession?.(payload);
        if (sessionMessage && !hasMessage?.(sessionMessage.messageId)) appendIncomingMessage?.(sessionMessage);
      }
      if (handleSessionSse?.(type, payload)) return;

      if (type === "message-created") return onMessageCreated(payload);
      if (type === "message-updated") return onMessageUpdated(payload);
      if (type === "conversation-read") return onConversationRead(payload);
      if (type === "pin-created") {
        if (payload) pinsStore.ingestPinCreated?.(payload);
        return;
      }
      if (type === "pin-updated") {
        if (payload) pinsStore.ingestPinUpdated?.(payload);
      }
    });

    offStatus = sse.onStatus(({ connected }) => {
      if (connected && !wasConnected) syncTailAfterReconnect();
      wasConnected = connected;
    });
  }

  function cleanupRealtimeTail() {
    if (offEvent) offEvent();
    if (offStatus) offStatus();
    offEvent = null;
    offStatus = null;
    wasConnected = false;
  }

  return {
    setupRealtimeTail,
    cleanupRealtimeTail,
    syncTailAfterReconnect,
  };
}
