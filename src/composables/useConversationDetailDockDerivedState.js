import { computed } from "vue";

export function useConversationDetailDockDerivedState({
  pins,
  items,
  capsuleItems,
  activeCount,
}) {
  const conversationSearchSummary = computed(() => {
    const parts = [];
    if (activeCount?.value) parts.push(`액션 ${activeCount.value}`);
    if (capsuleItems?.value?.length) parts.push(`캡슐 ${capsuleItems.value.length}`);
    if (items?.value?.length) parts.push(`메시지 ${items.value.length}`);
    return parts.length ? parts.join(" · ") : "이 대화의 흐름을 빠르게 다시 찾을 수 있어요";
  });

  function classifyCandidate(candidate) {
    const t = candidate && (candidate.type || candidate.pinType || candidate.kind || candidate.category)
      ? String(candidate.type || candidate.pinType || candidate.kind || candidate.category).toUpperCase()
      : "";
    if (t.includes("PLACE")) return "PLACE";
    if (t.includes("TODO") || t.includes("TASK")) return "TODO";
    if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";

    const text = String(candidate?.title || candidate?.content || candidate?.summary || "").toLowerCase();
    if (text.includes("할일") || text.includes("todo") || text.includes("task")) return "TODO";
    if (text.includes("장소") || text.includes("주소") || text.includes("place")) return "PLACE";
    return "PROMISE";
  }

  function classifyPin(pin) {
    const t = pin && (pin.type || pin.pinType || pin.kind || pin.category)
      ? String(pin.type || pin.pinType || pin.kind || pin.category).toUpperCase()
      : "";
    if (t.includes("PLACE")) return "PLACE";
    if (t.includes("TODO") || t.includes("TASK")) return "TODO";
    if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";
    if (pin?.startAt) return "PROMISE";
    if (pin?.placeText) return "PLACE";
    return "TODO";
  }

  function pinKindMeta(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") return { emoji: "📅", label: "약속" };
    if (kind === "TODO") return { emoji: "✅", label: "할일" };
    return { emoji: "📍", label: "장소" };
  }

  function pinTimelineState(pin) {
    const kind = classifyPin(pin);
    const now = Date.now();
    const startTs = pin?.startAt ? new Date(pin.startAt).getTime() : 0;

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

  function pinTimeText(pin) {
    const s = pin?.startAt ? String(pin.startAt) : "";
    if (!s) return "미정";
    return s.replace("T", " ").slice(0, 16);
  }

  function reminderTimeText(pin) {
    const remind = pin?.remindAt ? new Date(pin.remindAt).getTime() : 0;
    if (!remind) return "리마인드 없음";
    const startText = pin?.startAt ? ` · 일정 ${pinTimeText(pin)}` : "";
    return `${String(pin.remindAt).replace("T", " ").slice(0, 16)}${startText}`;
  }

  return {
    conversationSearchSummary,
    classifyCandidate,
    classifyPin,
    pinKindMeta,
    pinTimelineState,
    pinTimeText,
    reminderTimeText,
  };
}
