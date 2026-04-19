export function useConversationMessageMeta({
  items,
  isMineMessage,
  isCandidatesOpen,
  messageHasAttachment,
  getReadLabel,
}) {
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

  function isGroupWithPrev(idx) {
    if (idx <= 0) return false;
    const list = Array.isArray(items?.value) ? items.value : [];
    const cur = list[idx];
    const prev = list[idx - 1];
    if (!cur || !prev) return false;
    if (!isSameSender(cur, prev)) return false;
    return minutesBetween(prev, cur) <= 5;
  }

  function isGroupWithNext(idx) {
    const list = Array.isArray(items?.value) ? items.value : [];
    if (idx < 0 || idx >= list.length - 1) return false;
    const cur = list[idx];
    const next = list[idx + 1];
    if (!cur || !next) return false;
    if (!isSameSender(cur, next)) return false;
    return minutesBetween(cur, next) <= 5;
  }

  function hasMessageTools(message) {
    return Boolean(
      isMineMessage(message)
        || (Array.isArray(message?.pinCandidates) && message.pinCandidates.length > 0)
        || (message?.content && String(message.content).trim())
    );
  }

  function candidateToggleLabel(message) {
    const count = Array.isArray(message?.pinCandidates) ? message.pinCandidates.length : 0;
    if (count <= 0) return "후보";
    return isCandidatesOpen(message?.messageId) ? `📌 닫기 · ${count}` : `📌 보기 · ${count}`;
  }

  function messageUtilitySummary(message) {
    const parts = [];
    if (isMineMessage(message)) parts.push("✎ 가능");
    if (Array.isArray(message?.pinCandidates) && message.pinCandidates.length > 0) {
      parts.push(`📌 ${message.pinCandidates.length}`);
    }
    if (messageHasAttachment?.(message)) {
      parts.push(`🖼 ${Array.isArray(message?.attachments) ? message.attachments.length : 0}`);
    }
    return parts.join(" · ");
  }

  function shouldShowMessageMeta(message, index) {
    return Boolean(getReadLabel(message)) || !isGroupWithNext(index);
  }

  return {
    hasMessageTools,
    candidateToggleLabel,
    messageUtilitySummary,
    isGroupWithPrev,
    isGroupWithNext,
    shouldShowMessageMeta,
  };
}
