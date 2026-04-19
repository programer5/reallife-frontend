import { onBeforeUnmount, onMounted, watch } from "vue";

export function useConversationBootFlow(options) {
  const {
    route,
    nextTick,
    nowTick,
    conversationId,
    convStore,
    items,
    canViewConversation,
    pendingAction,
    loadPendingAction,
    primePendingAction,
    bumpPendingHighlight,
    refreshLockState,
    loadFirst,
    loadSessions,
    loadPins,
    ensureSessionOrRedirect,
    syncSearchFocusFromRoute,
    ensureMessageVisible,
    focusPinFromSearch,
    focusCapsuleFromSearch,
    getScrollerEl,
    onScroll,
    syncComposerHeightVar,
    syncMobileViewport,
    setupRealtimeTail,
    cleanupRealtimeTail,
    detectTouchUi,
    onPinRemindHighlight,
    readNotification,
    notificationsStore,
    scrollAndFlashMessage,
    setUiModeExploreSearch,
  } = options;

  let msgTimeTimer = null;
  let msgTimeTimer2 = null;

  watch(() => route.query, () => {
    const fromSearch = String(route.query?.fromSearch || '') === '1';
    if (fromSearch) setUiModeExploreSearch?.();
  }, { immediate: true, deep: true });

  watch(() => route.query, async () => {
    const { fromSearch, targetMid, targetPinId, targetCapsuleId } = await syncSearchFocusFromRoute();
    if (!fromSearch) return;
    await nextTick();
    if (targetMid) await ensureMessageVisible(targetMid, 8);
    if (targetPinId) await focusPinFromSearch(targetPinId);
    if (targetCapsuleId) await focusCapsuleFromSearch(targetCapsuleId);
  }, { deep: true });

  onMounted(() => {
    detectTouchUi?.();
    window.addEventListener('resize', detectTouchUi);
    window.addEventListener('pin-remind-highlight', onPinRemindHighlight);
  });

  onMounted(async () => {
    const ok = await ensureSessionOrRedirect();
    if (!ok) return;

    convStore.setActiveConversation?.(conversationId.value);

    await refreshLockState();
    if (canViewConversation.value) {
      await loadFirst();
      await loadSessions();
      await loadPins();
    }

    loadPendingAction();
    let targetOk = true;
    try {
      const t = sessionStorage.getItem('reallife:pendingActionTargetConversationId');
      if (t && String(t) !== String(conversationId.value)) targetOk = false;
    } catch {}

    if (canViewConversation.value && pendingAction.value) {
      primePendingAction(true);
      if (targetOk) {
        bumpPendingHighlight();
        try { sessionStorage.removeItem('reallife:pendingActionTargetConversationId'); } catch {}
      }
    }

    const notiId = route.query?.notiId ? String(route.query.notiId) : '';
    const fromNoti = route.query?.fromNoti ? String(route.query.fromNoti) === '1' : false;
    const { fromSearch, targetMid, targetPinId, targetCapsuleId } = await syncSearchFocusFromRoute();

    if (notiId) {
      try {
        await readNotification(notiId);
        await notificationsStore.refresh?.();
      } catch {}
    }

    await nextTick();

    const scroller = getScrollerEl();
    if (scroller) scroller.addEventListener('scroll', onScroll);

    syncComposerHeightVar?.();
    syncMobileViewport?.();

    if (fromNoti) {
      if (targetMid) {
        await ensureMessageVisible(targetMid, 6);
      } else {
        const last = items.value?.length ? items.value[items.value.length - 1] : null;
        const lastMid = last?.messageId;
        if (lastMid) await scrollAndFlashMessage(lastMid, { block: 'end' });
      }
    }

    if (fromSearch) {
      if (targetMid) await ensureMessageVisible(targetMid, 8);
      if (targetPinId) await focusPinFromSearch(targetPinId);
      if (targetCapsuleId) await focusCapsuleFromSearch(targetCapsuleId);
    }

    window.addEventListener('resize', syncComposerHeightVar);
    window.addEventListener('resize', syncMobileViewport);

    setupRealtimeTail?.();

    const delay = 60000 - (Date.now() % 60000);
    msgTimeTimer = setTimeout(() => {
      nowTick.value = Date.now();
      msgTimeTimer2 = setInterval(() => {
        nowTick.value = Date.now();
      }, 60000);
    }, delay);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', detectTouchUi);
    window.removeEventListener('pin-remind-highlight', onPinRemindHighlight);
    window.removeEventListener('resize', syncComposerHeightVar);
    window.removeEventListener('resize', syncMobileViewport);

    const scroller = getScrollerEl();
    if (scroller) scroller.removeEventListener('scroll', onScroll);

    cleanupRealtimeTail?.();
    convStore.setActiveConversation?.(null);

    if (msgTimeTimer) clearTimeout(msgTimeTimer);
    if (msgTimeTimer2) clearInterval(msgTimeTimer2);
    msgTimeTimer = null;
    msgTimeTimer2 = null;
  });
}
