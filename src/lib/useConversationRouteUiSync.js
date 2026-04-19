import { computed, ref } from "vue";

export function useConversationRouteUiSync({
  route,
  watch,
  conversationId,
  currentSessionMini,
  uiMode,
  exploreTab,
  dockOpen,
  dockMode,
  isMobileViewport,
  suggestionCount,
  activeCount,
  loadSessions,
  syncSearchRailMode,
  setDockSheetBodyLocked,
}) {
  function syncMobileViewport() {
    if (typeof window === "undefined") return;
    isMobileViewport.value = window.innerWidth <= 720;
    syncSearchRailMode?.();
  }

  watch(() => route.query, () => {
    const hasSearchFocus = Boolean(route.query?.q || route.query?.mid || route.query?.pinId || route.query?.capsuleId);
    if (hasSearchFocus) {
      uiMode.value = "explore";
      exploreTab.value = "search";
    }
  }, { immediate: true, deep: true });

  watch(currentSessionMini, (session) => {
    if (uiMode.value === "watch" && !session) {
      uiMode.value = "conversation";
    }
  });

  const useDockSheet = computed(() => isMobileViewport.value);
  const dockSheetTitle = computed(() => dockMode.value === "suggestions" ? "액션 제안" : "액션 허브");
  const dockSheetSubtitle = computed(() => {
    if (dockMode.value === "suggestions") {
      return suggestionCount.value > 0 ? `지금 확인할 제안 ${suggestionCount.value}개` : "현재 메시지에서 제안이 없어요.";
    }
    return activeCount.value > 0 ? `진행 중 액션 ${activeCount.value}개를 빠르게 볼 수 있어요.` : "아직 활성 액션이 없어요.";
  });

  function closeDockSheet() {
    dockOpen.value = false;
  }

  watch([dockOpen, useDockSheet], ([open, sheet]) => {
    setDockSheetBodyLocked?.(open && sheet);
  }, { immediate: true });

  return {
    syncMobileViewport,
    useDockSheet,
    dockSheetTitle,
    dockSheetSubtitle,
    closeDockSheet,
  };
}

useConversationRouteUiSync.createPinInsights = function createPinInsights({
  watch,
  conversationId,
  canViewConversation,
  loadSessions,
  pins,
  classifyPin,
  pinKindMeta,
  pinTimeText,
}) {
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
    if (canViewConversation.value) loadSessions?.();
  }, { immediate: true });

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
      return ts.getFullYear() === now.getFullYear() && ts.getMonth() === now.getMonth() && ts.getDate() === now.getDate();
    }).length;
  });

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
    const nextLabel = nextReminderPin.value?.remindAt ? String(nextReminderPin.value.remindAt).replace("T", " ").slice(0, 16) : "";
    if (nextLabel) return nextLabel;
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

  return {
    pinActivity,
    syncPinActivity,
    rememberPinAction,
    dockStatusSummary,
    upcomingReminderPins,
    nextReminderPin,
    reminderDueSoonCount,
    reminderTodayCount,
    recentPinActivity,
    pinActivityLabel,
    pinActivityTone,
    pinActivityMeta,
    timelinePrimaryMeta,
    timelinePriorityReason,
    timelineActionPath,
  };
};
