import { fetchMessages, updateMessage } from "@/api/messages";

export function useConversationMessageListFlow(options) {
  const { ref, toast, conversationId, myId, lockEnabled, unlockToken, scrollToBottom, updateMessageDepthFocus } = options;

  const loading = ref(false);
  const error = ref("");
  const items = ref([]);
  const editingMid = ref(null);
  const editingText = ref("");
  const savingEdit = ref(false);
  const nextCursor = ref(null);
  const hasNext = ref(false);

  function normalizeMessage(message) {
    const m = message || {};
    return {
      ...m,
      attachments: Array.isArray(m.attachments) ? m.attachments : [],
      pinCandidates: Array.isArray(m.pinCandidates) ? m.pinCandidates : [],
    };
  }

  function normalizeMessages(list) {
    return Array.isArray(list) ? list.map(normalizeMessage) : [];
  }

  function sortByCreatedAtAsc(list) {
    return [...list].sort((a, b) => {
      const at = new Date(a?.createdAt || 0).getTime();
      const bt = new Date(b?.createdAt || 0).getTime();
      if (at !== bt) return at - bt;
      return String(a?.messageId || "").localeCompare(String(b?.messageId || ""));
    });
  }

  function hasMessage(messageId) {
    const mid = String(messageId || "");
    if (!mid) return false;
    return items.value.some((item) => String(item?.messageId || "") === mid);
  }

  function appendIncomingMessage(message) {
    if (!message?.messageId) return;
    if (hasMessage(message.messageId)) {
      upsertServerMessage(message.messageId, message);
      return;
    }
    items.value = sortByCreatedAtAsc([...items.value, normalizeMessage(message)]);
  }

  function upsertServerMessage(tempId, serverMessage) {
    const normalized = normalizeMessage(serverMessage);
    const tempKey = String(tempId || "");
    const realKey = String(normalized?.messageId || "");
    const tempIdx = tempKey ? items.value.findIndex((item) => String(item?.messageId || "") === tempKey) : -1;
    const realIdx = realKey ? items.value.findIndex((item) => String(item?.messageId || "") === realKey) : -1;

    if (tempIdx >= 0) {
      items.value[tempIdx] = { ...items.value[tempIdx], ...normalized, _status: normalized?._status || undefined };
      if (realIdx >= 0 && realIdx != tempIdx) {
        items.value.splice(realIdx, 1);
      }
      items.value = sortByCreatedAtAsc(items.value);
      return;
    }

    if (realIdx >= 0) {
      items.value[realIdx] = { ...items.value[realIdx], ...normalized };
      items.value = sortByCreatedAtAsc(items.value);
      return;
    }

    items.value = sortByCreatedAtAsc([...items.value, normalized]);
  }

  function isMineMessage(m) {
    if (!myId.value) return false;
    return String(m?.senderId) === String(myId.value);
  }

  function startEdit(m) {
    if (!m || !isMineMessage(m)) return;
    editingMid.value = String(m.messageId);
    editingText.value = (m.content ?? "").toString();
  }

  function cancelEdit() {
    editingMid.value = null;
    editingText.value = "";
  }

  async function saveEdit(m) {
    if (!m || !isMineMessage(m)) return;

    const mid = String(m.messageId);
    const nextText = (editingText.value ?? "").toString().trim();

    if (!nextText) {
      toast.error?.("수정 실패", "내용을 입력해 주세요.");
      return;
    }
    if (nextText.length > 5000) {
      toast.error?.("수정 실패", "최대 5000자까지 입력할 수 있어요.");
      return;
    }

    const idx = items.value.findIndex((x) => String(x.messageId) === mid);
    const prev = idx >= 0 ? { ...items.value[idx] } : null;

    savingEdit.value = true;
    try {
      if (idx >= 0) {
        items.value[idx] = {
          ...items.value[idx],
          content: nextText,
          editedAt: new Date().toISOString(),
        };
      }

      const res = await updateMessage(conversationId.value, mid, nextText);
      if (idx >= 0) {
        items.value[idx] = {
          ...items.value[idx],
          content: res?.content ?? nextText,
          editedAt: res?.editedAt ?? items.value[idx].editedAt,
        };
      }
      cancelEdit();
    } catch (e) {
      if (idx >= 0 && prev) items.value[idx] = prev;
      const msg = e?.response?.data?.message || (e?.response?.status ? `요청 실패 (status=${e.response.status})` : "네트워크 오류");
      toast.error?.("수정 실패", msg);
    } finally {
      savingEdit.value = false;
    }
  }

  async function loadFirst() {
    if (!conversationId.value || loading.value) return;
    loading.value = true;
    error.value = "";
    try {
      const payload = await fetchMessages({
        conversationId: conversationId.value,
        size: 30,
        unlockToken: lockEnabled?.value ? unlockToken?.value : null,
      });
      items.value = normalizeMessages(payload?.items);
      nextCursor.value = payload?.nextCursor ?? null;
      hasNext.value = !!payload?.hasNext;
      updateMessageDepthFocus?.();
      scrollToBottom?.({ smooth: false });
    } catch (e) {
      error.value = e?.response?.data?.message || "메시지를 불러오지 못했어요.";
    } finally {
      loading.value = false;
    }
  }

  async function loadMore() {
    if (loading.value || !hasNext.value || !nextCursor.value || !conversationId.value) return;
    loading.value = true;
    error.value = "";
    try {
      const payload = await fetchMessages({
        conversationId: conversationId.value,
        size: 30,
        cursor: nextCursor.value,
        unlockToken: lockEnabled?.value ? unlockToken?.value : null,
      });
      const incoming = normalizeMessages(payload?.items);
      const existing = new Set(items.value.map((item) => String(item?.messageId || "")));
      const merged = [...incoming.filter((item) => !existing.has(String(item?.messageId || ""))), ...items.value];
      items.value = sortByCreatedAtAsc(merged);
      nextCursor.value = payload?.nextCursor ?? null;
      hasNext.value = !!payload?.hasNext;
      updateMessageDepthFocus?.();
    } catch (e) {
      error.value = e?.response?.data?.message || "이전 메시지를 더 불러오지 못했어요.";
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    items,
    editingMid,
    editingText,
    savingEdit,
    nextCursor,
    hasNext,
    normalizeMessages,
    hasMessage,
    appendIncomingMessage,
    upsertServerMessage,
    isMineMessage,
    startEdit,
    cancelEdit,
    saveEdit,
    loadFirst,
    loadMore,
  };
}
