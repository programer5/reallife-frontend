import { useConversationRouteUiSync } from "@/lib/useConversationRouteUiSync";

export function useConversationPinDock({
  ref,
  computed,
  watch,
  nextTick,
  router,
  conversationId,
  canViewConversation,
  pins,
  items,
  loadSessions,
  pinsStore,
  dockMode,
  dockOpen,
  activeFilter,
  dockSourceMsg,
  dockCandidates,
  isPinnedHighlight,
  pinTimeText,
  openCommandDeck,
  closeCommandDeck,
}) {
  const dockPulseOn = ref(false);
  const dockAnimating = ref(false);

  function canViewNow() {
    try {
      if (typeof canViewConversation === "function") return Boolean(canViewConversation());
      return Boolean(canViewConversation?.value);
    } catch {
      return false;
    }
  }

  function triggerDockPulse() {
    dockPulseOn.value = true;
    setTimeout(() => { dockPulseOn.value = false; }, 240);
  }

  function classifyCandidate(c) {
    const t = c && (c.type || c.pinType || c.kind || c.category) ? String(c.type || c.pinType || c.kind || c.category).toUpperCase() : "";
    if (t.includes("PLACE")) return "PLACE";
    if (t.includes("TODO") || t.includes("TASK")) return "TODO";
    if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";
    const text = String(c?.title || c?.content || c?.summary || "").toLowerCase();
    if (text.includes("할일") || text.includes("todo") || text.includes("task")) return "TODO";
    if (text.includes("장소") || text.includes("주소") || text.includes("place")) return "PLACE";
    return "PROMISE";
  }

  function classifyPin(p) {
    const t = (p && (p.type || p.pinType || p.kind || p.category)) ? String(p.type || p.pinType || p.kind || p.category).toUpperCase() : "";
    if (t.includes("PLACE")) return "PLACE";
    if (t.includes("TODO") || t.includes("TASK")) return "TODO";
    if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";
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
    if (kind === "PLACE") return { stage: "saved", label: "저장됨", tone: "stable", progress: 34 };
    if (kind === "TODO") return { stage: "working", label: "진행 준비", tone: "active", progress: 58 };
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

  const activeCounts = computed(() => {
    const res = { PROMISE: 0, TODO: 0, PLACE: 0 };
    (pins.value || []).forEach((p) => {
      const k = classifyPin(p);
      if (res[k] != null) res[k] += 1;
    });
    return res;
  });

  const dockTimelineSummary = computed(() => ({
    total: Array.isArray(pins.value) ? pins.value.length : 0,
    promises: activeCounts.value.PROMISE || 0,
    todos: activeCounts.value.TODO || 0,
    places: activeCounts.value.PLACE || 0,
    nextLabel: nextPromisePin.value ? pinTimeText(nextPromisePin.value) : "",
    nextTitle: nextPromisePin.value?.title || "",
  }));

  const filteredActivePins = computed(() => {
    const list = Array.isArray(pins.value) ? [...pins.value] : [];
    const f = activeFilter.value;
    const out = f === "ALL" ? list : list.filter((p) => classifyPin(p) === f);
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
      return new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    });
    return out;
  });

  const activeCount = computed(() => (Array.isArray(pins.value) ? pins.value.length : 0));
  const suggestionCount = computed(() => (items.value || []).reduce((acc, m) => acc + ((m?.pinCandidates && m.pinCandidates.length) ? m.pinCandidates.length : 0), 0));
  const lastCreatedPinId = ref(null);
  const flipPlaceholder = ref(null);

  const dockActivePinsToShow = computed(() => {
    const list = Array.isArray(filteredActivePins.value) ? [...filteredActivePins.value] : [];
    const lastId = lastCreatedPinId.value ? String(lastCreatedPinId.value) : null;
    const ph = flipPlaceholder.value && flipPlaceholder.value.pinId ? flipPlaceholder.value : null;
    const hasReal = ph ? list.some((p) => String(p.pinId) === String(ph.pinId)) : false;
    const phItem = (ph && !hasReal) ? { pinId: String(ph.pinId), title: ph.title || "저장 중…", placeName: ph.place || "", startAt: ph.time || "", __placeholder: true, __type: ph.type || "OTHER" } : null;
    let show = list.slice(0, 10);
    if (phItem && !show.some((p) => String(p.pinId) === String(phItem.pinId))) show = [phItem, ...show].slice(0, 10);
    if (lastId && !show.some((p) => String(p.pinId) === lastId)) {
      const found = list.find((p) => String(p.pinId) === lastId);
      if (found) show = [found, ...show].slice(0, 10);
    }
    return show;
  });

  const sortedDockCandidates = computed(() => {
    const list = Array.isArray(dockCandidates.value) ? [...dockCandidates.value] : [];
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

  function openActiveDock() {
    dockAnimating.value = true;
    setTimeout(() => (dockAnimating.value = false), 220);
    dockMode.value = "active";
    dockOpen.value = !dockOpen.value;
  }

  async function openSuggestionsDock(message) {
    if (!message || !message.pinCandidates || !message.pinCandidates.length) return;
    const mid = String(message.messageId);
    const curMid = dockSourceMsg.value ? String(dockSourceMsg.value.messageId) : null;
    const sameTarget = dockOpen.value && dockMode.value === "suggestions" && curMid === mid;
    if (sameTarget) {
      dockOpen.value = false;
      closeCommandDeck?.();
      return;
    }
    dockMode.value = "suggestions";
    dockOpen.value = true;
    dockSourceMsg.value = message;
    dockCandidates.value = Array.isArray(message.pinCandidates) ? message.pinCandidates : [];
    openCommandDeck?.("actions");
    await nextTick();
    const target = typeof document !== "undefined" ? document.querySelector(`[data-message-id="${mid}"]`) : null;
    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  function isCandidatesOpen(messageId) {
    return dockOpen.value && dockMode.value === "suggestions" && dockSourceMsg.value && String(dockSourceMsg.value.messageId) === String(messageId);
  }

  function toggleCandidates(messageId) {
    const mid = String(messageId);
    const msg = (items.value || []).find((x) => String(x?.messageId) === mid);
    if (!msg || !msg.pinCandidates || !msg.pinCandidates.length) return;
    openSuggestionsDock(msg);
  }

  function onPinRemindHighlight(e) {
    const cid = e?.detail?.conversationId;
    if (!cid || String(cid) !== String(conversationId.value)) return;
    isPinnedHighlight.value = true;
    setTimeout(() => (isPinnedHighlight.value = false), 800);
  }

  function reminderTimeText(pin) {
    const remind = pin?.remindAt ? new Date(pin.remindAt).getTime() : 0;
    if (!remind) return "리마인드 없음";
    const startText = pin?.startAt ? ` · 일정 ${pinTimeText(pin)}` : "";
    return `${String(pin.remindAt).replace("T", " ").slice(0, 16)}${startText}`;
  }

  function openReminderPins(pin) {
    if (!conversationId.value) return;
    const q = pin?.pinId ? `?pinId=${encodeURIComponent(String(pin.pinId))}` : "";
    router.push(`/inbox/conversations/${encodeURIComponent(String(conversationId.value))}/pins${q}`);
  }

  function pinPrimarySummary(pin) {
    const kind = classifyPin(pin);
    const state = pinTimelineState(pin);
    if (kind === "PROMISE") return pin?.startAt ? `${state.label} · ${pinTimeText(pin)}` : "시간을 정하면 약속 흐름이 더 선명해져요";
    if (kind === "TODO") return pin?.remindAt ? `리마인드 예정 · ${reminderTimeText(pin)}` : "체크 전 상태예요";
    return pin?.placeText ? `${pin.placeText} 저장됨` : "다음에 다시 꺼낼 장소예요";
  }

  function pinSecondarySummary(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") return pin?.placeText ? "장소와 시간을 확인한 뒤 완료 또는 일정 조정" : "시간과 장소를 보강해 약속 맥락 완성";
    if (kind === "TODO") return pin?.startAt ? "시간에 맞춰 처리하거나 완료로 정리" : "완료 처리하거나 필요하면 리마인드 추가";
    return pin?.remindAt ? "리마인드 시점 전에 다시 확인" : "필요하면 메모를 덧붙여 공유하기";
  }

  function pinCtaHint(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") return "시간 변경, 완료 처리, 피드 공유까지 한 카드에서 이어갈 수 있어요";
    if (kind === "TODO") return "할 일은 완료 처리와 리마인드 정리가 가장 빠른 다음 액션이에요";
    return "장소는 수정 후 공유해 두면 나중에 다시 찾기 쉬워져요";
  }

  function pinTimelineEvents(pin) {
    const events = [];
    if (pin?.createdAt) events.push({ key: `created-${pin.pinId || pin.id || ""}`, time: pin.createdAt, label: "액션 생성", tone: "create" });
    const status = String(pin?.status || "").toUpperCase();
    if (status === "DONE" && pin?.updatedAt) events.push({ key: `done-${pin.pinId || pin.id || ""}`, time: pin.updatedAt, label: "완료 처리", tone: "done" });
    else if ((status === "CANCELED" || status === "CANCELLED") && pin?.updatedAt) events.push({ key: `cancel-${pin.pinId || pin.id || ""}`, time: pin.updatedAt, label: "취소 처리", tone: "cancel" });
    return events.filter((event) => event.time).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  function pinTimelineTimeText(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
  }

  async function loadPins() {
    if (!conversationId.value || !canViewNow()) return;
    await pinsStore.refresh(conversationId.value, { size: 10 });
  }

  const insights = useConversationRouteUiSync.createPinInsights({
    watch,
    conversationId,
    canViewConversation: { get value() { return canViewNow(); } },
    loadSessions,
    pins,
    classifyPin,
    pinKindMeta,
    pinTimeText,
  });

  return {
    dockPulseOn,
    dockAnimating,
    triggerDockPulse,
    classifyCandidate,
    classifyPin,
    pinKindMeta,
    pinTimelineState,
    nextPromisePin,
    dockTimelineSummary,
    activeCounts,
    filteredActivePins,
    dockActivePinsToShow,
    sortedDockCandidates,
    activeCount,
    suggestionCount,
    openActiveDock,
    openSuggestionsDock,
    isCandidatesOpen,
    toggleCandidates,
    onPinRemindHighlight,
    reminderTimeText,
    openReminderPins,
    pinPrimarySummary,
    pinSecondarySummary,
    pinCtaHint,
    pinTimelineEvents,
    pinTimelineTimeText,
    loadPins,
    ...insights,
  };
}
