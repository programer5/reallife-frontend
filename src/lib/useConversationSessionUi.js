import { ref, computed } from 'vue';

export function useConversationSessionUi({
  conversationId,
  meId,
  items,
  activeCount,
  capsuleItems,
  sessions,
  activeSessions,
  recentSessions,
  spotlightMessage,
  isSessionMessage,
  sessionMessageMeta,
  openCommandDeck,
  messageStageMode,
  stageDeckOpen,
  uiMode,
  touchSessionPresence,
  createSession,
  hasMessage,
  appendIncomingMessage,
  applySessionAction,
  endSession,
  mergeSessionLocally,
  nextTick,
}) {
  const joinedSessionIds = ref([]);
  const sessionHubRef = ref(null);
  const sessionHistoryOpen = ref(false);
  const exploreTab = ref('search');

  function sessionSnapshotFromMessage(message) {
    const meta = sessionMessageMeta(message) || {};
    const sessionId = message?.sessionId || meta?.sessionId;
    if (!sessionId) return null;
    return {
      sessionId,
      conversationId: conversationId.value,
      messageId: message?.messageId || null,
      mediaKind: meta?.mediaKind || 'LINK',
      title: meta?.title || message?.content || '공동 플레이',
      sourceUrl: meta?.sourceUrl || '',
      thumbnailUrl: meta?.thumbnailUrl || null,
      status: meta?.status || 'ACTIVE',
      playbackState: meta?.playbackState || 'PAUSED',
      positionSeconds: Number(meta?.positionSeconds || 0),
      myRole: meta?.hostUserId && String(meta?.hostUserId) === meId.value ? 'HOST' : 'GUEST',
      host: meta?.hostUserId && String(meta?.hostUserId) === meId.value,
      canControl: meta?.hostUserId && String(meta?.hostUserId) === meId.value && (meta?.status || 'ACTIVE') === 'ACTIVE',
      activeParticipantCount: 0,
      participants: [],
    };
  }

  function sessionForMessage(message) {
    const snapshot = sessionSnapshotFromMessage(message);
    const sessionId = String(snapshot?.sessionId || '');
    if (!sessionId) return snapshot;
    const live = sessions.value.find((item) => String(item?.sessionId || '') === sessionId);
    return live ? { ...snapshot, ...live } : snapshot;
  }

  function buildSessionMessageFromSession(session) {
    if (!session?.sessionId || !session?.messageId) return null;
    return {
      messageId: session.messageId,
      conversationId: session.conversationId || conversationId.value,
      senderId: session.hostUserId || null,
      type: 'SESSION',
      content: (session.mediaKind === 'MUSIC' ? '같이 듣기 세션 · ' : '같이 보기 세션 · ') + (session.title || '공동 플레이'),
      metadataJson: JSON.stringify({
        kind: 'playback-session',
        sessionId: session.sessionId,
        mediaKind: session.mediaKind || 'LINK',
        title: session.title || '공동 플레이',
        sourceUrl: session.sourceUrl || '',
        thumbnailUrl: session.thumbnailUrl || null,
        status: session.status || 'ACTIVE',
        playbackState: session.playbackState || 'PAUSED',
        positionSeconds: Number(session.positionSeconds || 0),
        hostUserId: session.hostUserId || null,
      }),
      sessionId: session.sessionId,
      createdAt: session.createdAt || new Date().toISOString(),
      editedAt: null,
      attachments: [],
      pinCandidates: [],
    };
  }

  function activateSessionControls(session, { scroll = false, switchMode = true } = {}) {
    const sessionId = String(session?.sessionId || '');
    if (!sessionId) return;
    if (!joinedSessionIds.value.includes(sessionId)) {
      joinedSessionIds.value = [...joinedSessionIds.value, sessionId];
    }
    if (switchMode) uiMode.value = 'watch';
    messageStageMode.value = 'stream';
    stageDeckOpen.value = false;
    openCommandDeck('sessions');
    if (scroll) {
      nextTick(() => {
        sessionHubRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function isSessionActivated(sessionId) {
    return joinedSessionIds.value.includes(String(sessionId || ''));
  }

  const focusModeTabs = computed(() => ([
    { key: 'conversation', label: '대화', badge: items.value?.length || 0 },
    { key: 'watch', label: '세션', badge: activeSessions.value?.length || recentSessions.value?.length || 0 },
    { key: 'explore', label: '탐색', badge: activeCount.value + capsuleItems.value.length },
  ]));

  const featuredActiveSession = computed(() => {
    const list = activeSessions.value || [];
    if (!list.length) return null;
    const joined = list.find((item) => isSessionActivated(item?.sessionId));
    return joined || list[0] || null;
  });

  const currentSessionMini = computed(() => featuredActiveSession.value || activeSessions.value?.[0] || null);
  const railPrimarySession = computed(() => spotlightMessage.value && isSessionMessage(spotlightMessage.value)
    ? sessionForMessage(spotlightMessage.value)
    : currentSessionMini.value);

  function openRailSession() {
    const session = railPrimarySession.value || currentSessionMini.value;
    if (!session?.sessionId) {
      openCommandDeck('sessions');
      return;
    }
    activateSessionControls(session, { scroll: true, switchMode: false });
  }

  function setUiMode(mode) {
    uiMode.value = mode;
    if (mode === 'watch' && currentSessionMini.value?.sessionId) {
      activateSessionControls(currentSessionMini.value);
    }
  }

  function openExploreTab(tab = 'search') {
    exploreTab.value = tab;
    uiMode.value = 'explore';
  }

  const secondaryActiveSessions = computed(() => {
    const featuredId = String(featuredActiveSession.value?.sessionId || '');
    return (activeSessions.value || []).filter((item) => String(item?.sessionId || '') !== featuredId).slice(0, 3);
  });

  const visibleRecentSessions = computed(() => (
    sessionHistoryOpen.value ? recentSessions.value : recentSessions.value.slice(0, 2)
  ));

  function toggleSessionHistory() {
    sessionHistoryOpen.value = !sessionHistoryOpen.value;
  }

  async function onTouchPlaybackPresence(session) {
    if (!session?.sessionId || session?.status !== 'ACTIVE') return;
    activateSessionControls(session);
    await touchSessionPresence(session.sessionId, { silent: true });
  }

  async function onCreatePlaybackSession(form) {
    const created = await createSession(form);
    uiMode.value = 'watch';
    activateSessionControls(created, { switchMode: false });
    const sessionMessage = buildSessionMessageFromSession(created);
    if (sessionMessage && !hasMessage(sessionMessage.messageId)) appendIncomingMessage(sessionMessage);
  }

  function resolveSessionActionPayload(input, fallbackState = null) {
    const session = input?.session || input || null;
    return {
      session,
      sessionId: session?.sessionId || input?.sessionId || null,
      playbackState: String(input?.playbackState || session?.playbackState || fallbackState || 'PAUSED'),
      positionSeconds: Number(input?.positionSeconds ?? session?.positionSeconds ?? 0),
    };
  }

  async function onPlaybackPlay(input) {
    const payload = resolveSessionActionPayload(input, 'PLAYING');
    mergeSessionLocally(payload.sessionId, { playbackState: 'PLAYING', positionSeconds: payload.positionSeconds });
    await onTouchPlaybackPresence(payload.session);
    await applySessionAction(payload.sessionId, {
      playbackState: 'PLAYING',
      positionSeconds: payload.positionSeconds,
    });
  }

  async function onPlaybackPause(input) {
    const payload = resolveSessionActionPayload(input, 'PAUSED');
    mergeSessionLocally(payload.sessionId, { playbackState: 'PAUSED', positionSeconds: payload.positionSeconds });
    await onTouchPlaybackPresence(payload.session);
    await applySessionAction(payload.sessionId, {
      playbackState: 'PAUSED',
      positionSeconds: payload.positionSeconds,
    });
  }

  async function onPlaybackSeek(input) {
    const payload = resolveSessionActionPayload(input);
    mergeSessionLocally(payload.sessionId, { playbackState: payload.playbackState, positionSeconds: payload.positionSeconds + 15 });
    await onTouchPlaybackPresence(payload.session);
    await applySessionAction(payload.sessionId, {
      playbackState: payload.playbackState,
      positionSeconds: payload.positionSeconds + 15,
    });
  }

  async function onPlaybackEnd(input) {
    const payload = resolveSessionActionPayload(input);
    await onTouchPlaybackPresence(payload.session);
    await endSession(payload.sessionId, payload.positionSeconds);
  }

  function onPlaybackTelemetry(input) {
    const payload = resolveSessionActionPayload(input);
    if (!payload.sessionId) return;
    mergeSessionLocally(payload.sessionId, {
      positionSeconds: payload.positionSeconds,
      playbackState: payload.playbackState,
    });
  }

  async function onPlaybackIntent(input) {
    const payload = resolveSessionActionPayload(input);
    if (!payload.sessionId) return;
    if (payload.playbackState === 'PLAYING') {
      await onPlaybackPlay(payload);
      return;
    }
    await onPlaybackPause(payload);
  }

  return {
    joinedSessionIds,
    sessionHubRef,
    sessionHistoryOpen,
    exploreTab,
    sessionSnapshotFromMessage,
    sessionForMessage,
    buildSessionMessageFromSession,
    activateSessionControls,
    isSessionActivated,
    focusModeTabs,
    featuredActiveSession,
    currentSessionMini,
    railPrimarySession,
    openRailSession,
    setUiMode,
    openExploreTab,
    secondaryActiveSessions,
    visibleRecentSessions,
    toggleSessionHistory,
    onTouchPlaybackPresence,
    onCreatePlaybackSession,
    resolveSessionActionPayload,
    onPlaybackPlay,
    onPlaybackPause,
    onPlaybackSeek,
    onPlaybackEnd,
    onPlaybackTelemetry,
    onPlaybackIntent,
  };
}
