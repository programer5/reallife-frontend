import { computed, ref, watch } from 'vue';

export function useConversationStageDepth({
  items,
  searchFocusMid,
  isSessionMessage,
  getScrollerEl,
  nextTick,
}) {
  const messageStageMode = ref('stream');
  const stageFilter = ref('all');
  const stageDeckOpen = ref(false);
  const stageSheetTab = ref('overview');
  const messageDepthEnabled = ref(true);
  const focusedDepthMid = ref('');
  const depthPeel = ref(0);

  function messageHasAttachment(message) {
    return Array.isArray(message?.attachments) && message.attachments.length > 0;
  }

  function messageHasActionCandidate(message) {
    return Array.isArray(message?.pinCandidates) && message.pinCandidates.length > 0;
  }

  function isHighlightedMessage(message) {
    return searchFocusMid.value && String(searchFocusMid.value) === String(message?.messageId || '');
  }

  const stagePool = computed(() => {
    const source = Array.isArray(items.value) ? items.value : [];
    return source.filter((message) => {
      if (isSessionMessage(message)) return true;
      if (messageHasAttachment(message)) return true;
      if (messageHasActionCandidate(message)) return true;
      if (isHighlightedMessage(message)) return true;
      return false;
    });
  });

  function isStageCandidate(message) {
    return stagePool.value.some((item) => String(item?.messageId || '') === String(message?.messageId || ''));
  }

  const stageFilteredMessages = computed(() => {
    const source = stagePool.value;
    if (stageFilter.value === 'sessions') return source.filter((message) => isSessionMessage(message));
    if (stageFilter.value === 'media') return source.filter((message) => messageHasAttachment(message));
    if (stageFilter.value === 'actions') return source.filter((message) => messageHasActionCandidate(message));
    return source;
  });

  const stageStackCards = computed(() => {
    const source = stageFilteredMessages.value.length ? stageFilteredMessages.value : stagePool.value;
    return source.slice(-4).reverse();
  });

  const stageRailCards = computed(() => stageStackCards.value.slice(0, 3));

  const stageStats = computed(() => ({
    total: stagePool.value.length,
    sessions: stagePool.value.filter((message) => isSessionMessage(message)).length,
    media: stagePool.value.filter((message) => messageHasAttachment(message)).length,
    actions: stagePool.value.filter((message) => messageHasActionCandidate(message)).length,
  }));

  const stageHeadline = computed(() => {
    if (stageFilter.value === 'sessions') return '공동 플레이 흐름만 모아서 봐요';
    if (stageFilter.value === 'media') return '첨부와 미디어가 있는 장면만 보여드릴게요';
    if (stageFilter.value === 'actions') return '약속·할 일로 이어질 장면만 보여드릴게요';
    if (stageStats.value.total) return '지금 대화에서 다시 보기 좋은 장면만 앞에 세웠어요';
    return '아직 무대에 올릴 장면이 없어서 전체 대화를 그대로 보여드려요';
  });

  const spotlightMessage = computed(() => {
    const source = stageFilteredMessages.value;
    return source.length ? source[source.length - 1] : null;
  });

  const stageSheetTabs = computed(() => ([
    { key: 'overview', label: '개요', count: stageStats.value.total },
    { key: 'sessions', label: '세션', count: stageStats.value.sessions },
    { key: 'actions', label: '액션', count: stageStats.value.actions },
    { key: 'media', label: '미디어', count: stageStats.value.media },
  ]));

  const stageSheetSessions = computed(() => stagePool.value.filter((message) => isSessionMessage(message)).slice().reverse());
  const stageSheetActions = computed(() => stagePool.value.filter((message) => messageHasActionCandidate(message)).slice().reverse());
  const stageSheetMedia = computed(() => stagePool.value.filter((message) => messageHasAttachment(message)).slice().reverse());

  function openStageSheet(tab = 'overview') {
    stageSheetTab.value = tab;
    stageDeckOpen.value = true;
  }

  function messageElementSelector(messageId) {
    if (messageId == null) return '';
    try {
      return `[data-mid="${CSS.escape(String(messageId))}"]`;
    } catch {
      return `[data-mid="${String(messageId)}"]`;
    }
  }

  function updateMessageDepthFocus() {
    const el = getScrollerEl?.();
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('[data-mid]'));
    if (!nodes.length) {
      focusedDepthMid.value = '';
      depthPeel.value = 0;
      return;
    }
    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height * 0.46;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      const nodeCenter = r.top + r.height / 2;
      const dist = Math.abs(nodeCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }
    focusedDepthMid.value = best?.getAttribute('data-mid') || '';
    const maxTravel = Math.max(rect.height * 0.5, 1);
    depthPeel.value = Math.max(0, Math.min(1, bestDist / maxTravel));
  }

  function focusDepthMessage(messageId, { smooth = true } = {}) {
    const selector = messageElementSelector(messageId);
    if (!selector) return;
    const target = getScrollerEl?.()?.querySelector(selector) || document.querySelector(selector);
    if (!target?.scrollIntoView) return;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    focusedDepthMid.value = String(messageId);
    target.classList.add('depthSpotPulse');
    setTimeout(() => target.classList.remove('depthSpotPulse'), 1600);
  }

  function messageDepthRank(index) {
    const focusId = String(focusedDepthMid.value || '');
    if (!messageDepthEnabled.value || !focusId) return 'flat';
    const focusIndex = items.value.findIndex((item) => String(item?.messageId || '') === focusId);
    if (focusIndex < 0) return 'flat';
    const delta = index - focusIndex;
    const distance = Math.abs(delta);
    if (distance === 0) return 'focus';
    if (distance === 1) return delta < 0 ? 'near-prev' : 'near-next';
    if (distance === 2) return delta < 0 ? 'mid-prev' : 'mid-next';
    return delta < 0 ? 'far-prev' : 'far-next';
  }

  function messageDepthStyle(index) {
    if (!messageDepthEnabled.value) return {};
    const rank = messageDepthRank(index);
    const peel = depthPeel.value;
    const styles = {
      focus: { '--depth-scale': '1', '--depth-blur': '0px', '--depth-opacity': '1', '--depth-y': '0px', '--depth-z': '0px' },
      'near-prev': { '--depth-scale': '0.999', '--depth-blur': `${0.08 + peel * 0.18}px`, '--depth-opacity': `${0.992 - peel * 0.01}`, '--depth-y': '-1px', '--depth-z': '-1px' },
      'near-next': { '--depth-scale': '0.999', '--depth-blur': `${0.08 + peel * 0.18}px`, '--depth-opacity': `${0.992 - peel * 0.01}`, '--depth-y': '1px', '--depth-z': '-1px' },
      'mid-prev': { '--depth-scale': '0.996', '--depth-blur': `${0.18 + peel * 0.26}px`, '--depth-opacity': `${0.976 - peel * 0.02}`, '--depth-y': '-2px', '--depth-z': '-3px' },
      'mid-next': { '--depth-scale': '0.996', '--depth-blur': `${0.18 + peel * 0.26}px`, '--depth-opacity': `${0.978 - peel * 0.02}`, '--depth-y': '2px', '--depth-z': '-3px' },
      'far-prev': { '--depth-scale': '0.992', '--depth-blur': `${0.3 + peel * 0.32}px`, '--depth-opacity': `${0.95 - peel * 0.025}`, '--depth-y': '-3px', '--depth-z': '-5px' },
      'far-next': { '--depth-scale': '0.992', '--depth-blur': `${0.3 + peel * 0.32}px`, '--depth-opacity': `${0.954 - peel * 0.025}`, '--depth-y': '3px', '--depth-z': '-5px' },
      flat: { '--depth-scale': '1', '--depth-blur': '0px', '--depth-opacity': '1', '--depth-y': '0px', '--depth-z': '0px' },
    };
    const result = { ...(styles[rank] || styles.flat) };
    if (rank === 'near-prev' || rank === 'near-next') result['--depth-overlap'] = '0px';
    else if (rank === 'mid-prev' || rank === 'mid-next') result['--depth-overlap'] = '1px';
    else if (rank === 'far-prev' || rank === 'far-next') result['--depth-overlap'] = '1px';
    else result['--depth-overlap'] = '0px';
    return result;
  }

  watch(messageStageMode, (mode) => {
    if (mode === 'stage') stageDeckOpen.value = true;
  });

  watch(() => items.value.length, async () => {
    await nextTick();
    updateMessageDepthFocus();
  });

  watch(() => messageStageMode.value, async () => {
    await nextTick();
    updateMessageDepthFocus();
  });

  return {
    messageStageMode,
    stageFilter,
    stageDeckOpen,
    stageSheetTab,
    messageDepthEnabled,
    focusedDepthMid,
    depthPeel,
    messageHasAttachment,
    messageHasActionCandidate,
    isHighlightedMessage,
    isStageCandidate,
    stagePool,
    stageFilteredMessages,
    stageStackCards,
    stageRailCards,
    stageStats,
    stageHeadline,
    spotlightMessage,
    stageSheetTabs,
    stageSheetSessions,
    stageSheetActions,
    stageSheetMedia,
    openStageSheet,
    messageElementSelector,
    updateMessageDepthFocus,
    focusDepthMessage,
    messageDepthRank,
    messageDepthStyle,
  };
}
