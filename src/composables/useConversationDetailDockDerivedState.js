import { computed } from "vue";

export function useConversationDetailDockDerivedState(options = {}) {
  const {
    pins,
    activeFilter,
    dockCandidates,
    items,
    conversationSearchQ,
    searchFocusPinId,
    flipPlaceholder,
    lastCreatedPinId,
    pinActivity,
  } = options;

  function classifyCandidate(c) {
    const t = c && (c.type || c.pinType || c.kind || c.category)
      ? String(c.type || c.pinType || c.kind || c.category).toUpperCase()
      : "";
    if (t.includes("PLACE")) return "PLACE";
    if (t.includes("TODO") || t.includes("TASK")) return "TODO";
    if (t.includes("PROMISE") || t.includes("APPOINT") || t.includes("MEET")) return "PROMISE";

    const text = String(c?.title || c?.content || c?.summary || "").toLowerCase();
    if (text.includes("할일") || text.includes("todo") || text.includes("task")) return "TODO";
    if (text.includes("장소") || text.includes("주소") || text.includes("place")) return "PLACE";
    return "PROMISE";
  }

  function classifyPin(p) {
    const t = p && (p.type || p.pinType || p.kind || p.category)
      ? String(p.type || p.pinType || p.kind || p.category).toUpperCase()
      : "";
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

  function pinTimelineTimeText(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).replace("T", " ").slice(0, 16);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
  }

  function pinTimelineEvents(pin) {
    const events = [];
    if (pin?.createdAt) {
      events.push({
        key: `created-${pin.pinId || pin.id || ""}`,
        time: pin.createdAt,
        label: "액션 생성",
        tone: "create",
      });
    }

    const status = String(pin?.status || "").toUpperCase();
    if (status === "DONE" && pin?.updatedAt) {
      events.push({
        key: `done-${pin.pinId || pin.id || ""}`,
        time: pin.updatedAt,
        label: "완료 처리",
        tone: "done",
      });
    } else if ((status === "CANCELED" || status === "CANCELLED") && pin?.updatedAt) {
      events.push({
        key: `cancel-${pin.pinId || pin.id || ""}`,
        time: pin.updatedAt,
        label: "취소 처리",
        tone: "cancel",
      });
    }

    return events
      .filter((event) => event.time)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  function pinPrimarySummary(pin) {
    const kind = classifyPin(pin);
    const state = pinTimelineState(pin);
    if (kind === "PROMISE") {
      if (pin?.startAt) return `${state.label} · ${pinTimeText(pin)}`;
      return "시간을 정하면 약속 흐름이 더 선명해져요";
    }
    if (kind === "TODO") {
      return pin?.remindAt ? `리마인드 예정 · ${reminderTimeText(pin)}` : "체크 전 상태예요";
    }
    return pin?.placeText ? `${pin.placeText} 저장됨` : "다음에 다시 꺼낼 장소예요";
  }

  function pinSecondarySummary(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") {
      return pin?.placeText ? "장소와 시간을 확인한 뒤 완료 또는 일정 조정" : "시간과 장소를 보강해 약속 맥락 완성";
    }
    if (kind === "TODO") {
      return pin?.startAt ? "시간에 맞춰 처리하거나 완료로 정리" : "완료 처리하거나 필요하면 리마인드 추가";
    }
    return pin?.remindAt ? "리마인드 시점 전에 다시 확인" : "필요하면 메모를 덧붙여 공유하기";
  }

  function pinCtaHint(pin) {
    const kind = classifyPin(pin);
    if (kind === "PROMISE") return "시간 변경, 완료 처리, 피드 공유까지 한 카드에서 이어갈 수 있어요";
    if (kind === "TODO") return "할 일은 완료 처리와 리마인드 정리가 가장 빠른 다음 액션이에요";
    return "장소는 수정 후 공유해 두면 나중에 다시 찾기 쉬워져요";
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
        return idx === arr.length - 2;
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

  const activeCount = computed(() => (Array.isArray(pins.value) ? pins.value.length : 0));

  const suggestionCount = computed(() => {
    const arr = items.value || [];
    return arr.reduce((acc, m) => acc + ((m?.pinCandidates && m.pinCandidates.length) ? m.pinCandidates.length : 0), 0);
  });

  const activeCounts = computed(() => {
    const res = { PROMISE: 0, TODO: 0, PLACE: 0 };
    (pins.value || []).forEach((p) => {
      const k = classifyPin(p);
      if (res[k] != null) res[k] += 1;
    });
    return res;
  });

  const nextPromisePin = computed(() => {
    const now = Date.now();
    return (pins.value || [])
      .filter((p) => classifyPin(p) === "PROMISE" && p?.startAt)
      .map((p) => ({ pin: p, ts: new Date(p.startAt).getTime() }))
      .filter((x) => x.ts && x.ts >= now)
      .sort((a, b) => a.ts - b.ts)[0]?.pin || null;
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
      return 0;
    });
    return out;
  });

  const dockActivePinsToShow = computed(() => {
    const list = Array.isArray(filteredActivePins.value) ? [...filteredActivePins.value] : [];
    const lastId = lastCreatedPinId.value ? String(lastCreatedPinId.value) : null;
    const ph = flipPlaceholder.value && flipPlaceholder.value.pinId ? flipPlaceholder.value : null;
    const hasReal = ph ? list.some((p) => String(p.pinId) === String(ph.pinId)) : false;
    const phItem = (ph && !hasReal)
      ? {
          pinId: String(ph.pinId),
          title: ph.title || "저장 중…",
          placeName: ph.place || "",
          startAt: ph.time || "",
          __placeholder: true,
          __type: ph.type || "OTHER",
        }
      : null;

    let show = list.slice(0, 10);
    if (phItem && !show.some((p) => String(p.pinId) === String(phItem.pinId))) {
      show = [phItem, ...show].slice(0, 10);
    }
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

  const dockVisibleSummary = computed(() => {
    const list = Array.isArray(dockActivePinsToShow.value)
      ? dockActivePinsToShow.value.filter((x) => !x?.__placeholder)
      : [];
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

  const recentPinActivity = computed(() => pinActivity.value.slice(0, 4));

  const timelinePrimaryMeta = computed(() => {
    if (dockTimelineSummary.value.nextLabel) return dockTimelineSummary.value.nextLabel;
    if (dockStatusSummary.value.overdue) return `시간 지난 액션 ${dockStatusSummary.value.overdue}개`;
    if (dockStatusSummary.value.todoReady) return `바로 체크 가능한 할 일 ${dockStatusSummary.value.todoReady}개`;
    if (dockStatusSummary.value.placeSaved) return `기억해둔 장소 ${dockStatusSummary.value.placeSaved}개`;
    return "새 액션이 생기면 여기서 바로 이어갈 수 있어요";
  });

  const timelinePriorityReason = computed(() => {
    if (dockStatusSummary.value.overdue) {
      return {
        title: `시간 지난 액션 ${dockStatusSummary.value.overdue}개`,
        description: "약속 시간이나 처리 시점을 다시 확인해 지금 대화를 놓치지 않게 정리하세요.",
      };
    }
    if (reminderDueSoonCount.value) {
      return {
        title: `24시간 내 리마인드 ${reminderDueSoonCount.value}개`,
        description: "곧 울릴 리마인드를 미리 보고, 필요하면 시간이나 내용을 바로 다듬는 흐름이 좋아요.",
      };
    }
    if (dockStatusSummary.value.todoReady) {
      return {
        title: `바로 할 일 ${dockStatusSummary.value.todoReady}개`,
        description: "짧게 끝낼 수 있는 할 일을 먼저 처리하면 대화 흐름이 훨씬 가벼워져요.",
      };
    }
    return {
      title: "저장된 액션 흐름 유지 중",
      description: "약속, 할 일, 장소가 정리돼 있어서 지금은 필요한 카드만 빠르게 훑으면 돼요.",
    };
  });

  const timelineActionPath = computed(() => {
    if (dockStatusSummary.value.overdue) {
      return {
        title: "카드에서 시간/상태 먼저 수정",
        description: "아래 액션 카드에서 수정이나 완료 처리를 바로 눌러 흐름을 정리할 수 있어요.",
      };
    }
    if (nextReminderPin.value) {
      return {
        title: "리마인더 카드에서 바로 확인",
        description: "다음 리마인더와 오늘 예정 수를 보고 필요한 액션으로 바로 이동하면 돼요.",
      };
    }
    return {
      title: "아래 액션 카드에서 바로 처리",
      description: "수정, 완료, 취소, 피드 공유를 카드 안에서 바로 이어갈 수 있게 정리돼 있어요.",
    };
  });

  const conversationSearchSummary = computed(() => {
    const parts = [];
    if (activeCount.value) parts.push(`액션 ${activeCount.value}`);
    if (Array.isArray(items.value) && items.value.length) parts.push(`메시지 ${items.value.length}`);
    if (String(conversationSearchQ?.value || "").trim()) parts.push(`검색어 ${String(conversationSearchQ.value).trim()}`);
    return parts.length ? parts.join(" · ") : "이 대화의 흐름을 빠르게 다시 찾을 수 있어요";
  });

  return {
    classifyCandidate,
    classifyPin,
    pinKindMeta,
    pinTimelineState,
    pinTimeText,
    reminderTimeText,
    pinActivityLabel,
    pinActivityTone,
    pinActivityMeta,
    pinTimelineTimeText,
    pinTimelineEvents,
    pinPrimarySummary,
    pinSecondarySummary,
    pinCtaHint,
    feedShareTextForPin,
    feedShareMetaForPin,
    activeCount,
    suggestionCount,
    activeCounts,
    nextPromisePin,
    dockTimelineSummary,
    filteredActivePins,
    dockActivePinsToShow,
    sortedDockCandidates,
    dockVisibleSummary,
    dockStatusSummary,
    upcomingReminderPins,
    nextReminderPin,
    reminderDueSoonCount,
    reminderTodayCount,
    recentPinActivity,
    timelinePrimaryMeta,
    timelinePriorityReason,
    timelineActionPath,
    conversationSearchSummary,
  };
}
