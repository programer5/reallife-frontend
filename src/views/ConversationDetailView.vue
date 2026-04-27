<!-- src/views/ConversationDetailView.vue -->
<script setup>
import { computed, ref, nextTick, watch } from "vue";
import { ensureSessionOrRedirect as ensureSessionOrRedirectGuard } from "@/lib/authGuard";
import { useRoute, useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import SseStatusBanner from "@/components/SseStatusBanner.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import ConversationCapsulePanel from "@/components/chat/ConversationCapsulePanel.vue";
import CapsuleComposerModal from "@/components/chat/CapsuleComposerModal.vue";
import ConversationPendingBridge from "@/components/chat/ConversationPendingBridge.vue";
import ConversationSessionComposer from "@/components/chat/ConversationSessionComposer.vue";
import ConversationSessionCard from "@/components/chat/ConversationSessionCard.vue";
import LensHeader from "@/components/conversation/LensHeader.vue";
import LensTabs from "@/components/conversation/LensTabs.vue";
import StageSheet from "@/components/conversation/StageSheet.vue";
import SessionHub from "@/components/conversation/SessionHub.vue";
import ActivePinDock from "@/components/conversation/ActivePinDock.vue";
import ConversationMessageListRail from "@/components/conversation/ConversationMessageListRail.vue";
import ConversationSearchPanel from "@/components/conversation/ConversationSearchPanel.vue";
import ComposerUtilityBar from "@/components/conversation/ComposerUtilityBar.vue";
import ConversationComposerShell from "@/components/conversation/ConversationComposerShell.vue";
import ConversationMessageMenuOverlay from "@/components/conversation/ConversationMessageMenuOverlay.vue";
import ConversationLockModal from "@/components/conversation/ConversationLockModal.vue";
import ConversationPinActionModal from "@/components/conversation/ConversationPinActionModal.vue";
import ConversationPinEditModal from "@/components/conversation/ConversationPinEditModal.vue";
import ConversationAiAssist from "@/components/conversation/ConversationAiAssist.vue";
import { executeConversationAiAction } from "@/api/conversationAi";

import { fetchMessages, sendMessage } from "@/api/messages";
import { markConversationRead } from "@/api/conversations";
import { fetchConversationReadState } from "@/api/conversations";
import { pinDone, pinCancel, pinDismiss, pinUpdate } from "@/api/pinsActions";
import { confirmPinFromMessage } from "@/api/pins";

import { useToastStore } from "@/stores/toast";
import { useConversationsStore } from "@/stores/conversations";
import { useAuthStore } from "@/stores/auth";
import { useConversationPinsStore } from "@/stores/conversationPins";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { readNotification } from "@/api/notifications";
import { useNotificationsStore } from "@/stores/notifications";
import { uploadFiles, uploadFilesDetailed } from "@/api/files";
import sse from "@/lib/sse";
import { useConversationCapsuleFlow } from "@/lib/useConversationCapsuleFlow";
import { useMessageContextMenu } from "@/lib/useMessageContextMenu";
import { useConversationComposer } from "@/lib/useConversationComposer";
import { useConversationSessions } from "@/lib/useConversationSessions";
import { useConversationSessionUi } from "@/lib/useConversationSessionUi";
import { useConversationSearchFocus } from "@/lib/useConversationSearchFocus";
import { useConversationMessageVisuals } from "@/lib/useConversationMessageVisuals";
import { useConversationMessageMeta } from "@/lib/useConversationMessageMeta";
import { useConversationMessageActions } from "@/lib/useConversationMessageActions";
import { useConversationScrollRail } from "@/lib/useConversationScrollRail";
import { useConversationRealtimeTail } from "@/lib/useConversationRealtimeTail";
import { useConversationLockAccess } from "@/lib/useConversationLockAccess";
import { useConversationBootFlow } from "@/lib/useConversationBootFlow";
import { useConversationRouteUiSync } from "@/lib/useConversationRouteUiSync";
import { useConversationPinDock } from "@/lib/useConversationPinDock";
import { useConversationPinUi } from "@/lib/useConversationPinUi";
import { useConversationMessageListFlow } from "@/lib/useConversationMessageListFlow";
import { useConversationHeaderInfo } from "@/lib/useConversationHeaderInfo";
import { useConversationDockFly } from "@/lib/useConversationDockFly";
import { useConversationMessageFocus } from "@/lib/useConversationMessageFocus";

const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const convStore = useConversationsStore();
const auth = useAuthStore();
const pinsStore = useConversationPinsStore();
const notificationsStore = useNotificationsStore();
const pageRef = ref(null);
const composerRef = ref(null);
const nowTick = ref(Date.now());
const { setLocked: setDockSheetBodyLocked } = useBodyScrollLock();

function syncComposerHeightVar() {
  try {
    const el = composerRef.value;
    const h = Math.max(0, Math.round(el?.offsetHeight || 0));
    document.documentElement.style.setProperty("--conversation-composer-h", `${h}px`);
  } catch {}
}
const {
  scrollerRef,
  unreadDividerMid,
  newMsgCount,
  getScrollerEl,
  getScrollAnchor,
  restoreScrollAnchor,
  scrollToBottom,
  isNearBottom,
  computeUnreadDividerMid,
  jumpToFirstUnread,
} = useConversationScrollRail({ nextTick });
const { menu, closeMsgMenu, openMsgMenu } = useMessageContextMenu();

const uiMode = ref("conversation");
const commandDeckOpen = ref(false);
const commandDeckTab = ref("search");
const messageStageMode = ref("stream");
const stageDeckOpen = ref(false);
const stageSheetTab = ref("overview");
const messageDepthEnabled = ref(true);
const focusedDepthMid = ref("");

function openCommandDeck(tab = "search") {
  commandDeckTab.value = tab;
  commandDeckOpen.value = true;
  uiMode.value = "explore";
}

function closeCommandDeck() {
  commandDeckOpen.value = false;
}
const conversationId = computed(() => String(route.params.conversationId || ""));
const meId = computed(() => String(auth.me?.id || ""));
const isPinnedHighlight = ref(false);
const isMobileViewport = ref(false);
const dockMode = ref("active"); // 'active' | 'suggestions'
const dockOpen = ref(false);
const activeFilter = ref("ALL"); // ALL | PROMISE | TODO | PLACE
const dockSourceMsg = ref(null);
const dockCandidates = ref([]);
const pins = computed(() => pinsStore.getPins(conversationId.value));
const {
  flashMid,
  ensureMessageVisible,
  scrollAndFlashMessage,
} = useConversationMessageFocus({ nextTick, getScrollerEl });

const {
  conversationSearchQ,
  searchRailExpanded,
  searchFocusTerm,
  searchFocusMid,
  searchFocusPinId,
  searchFocusCapsuleId,
  conversationSearchSummary,
  hasSearchFocus,
  searchFocusSummary,
  syncSearchRailMode,
  toggleSearchRail,
  openConversationSearch,
  openGlobalSearch,
  renderMessageHtml,
  clearSearchFocus,
  refocusSearchTarget,
  focusPinFromSearch,
  focusCapsuleFromSearch,
  syncSearchFocusFromRoute,
} = useConversationSearchFocus({
  route,
  router,
  conversationId,
  items: computed(() => items.value),
  activeCount: computed(() => activeCount.value),
  capsuleItems: computed(() => capsuleItems.value),
  isMobileViewport,
  ensureMessageVisible,
  nextTick,
  dockMode,
  dockOpen,
});

function sessionMessageMeta(message) {
  if (!message?.metadataJson || typeof message.metadataJson !== "string") return null;
  try { return JSON.parse(message.metadataJson); } catch { return null; }
}

function isSessionMessage(message) {
  const type = String(message?.type || "").toUpperCase();
  return type === "SESSION" || sessionMessageMeta(message)?.kind === "playback-session";
}

function messageHasAttachment(message) {
  return Array.isArray(message?.attachments) && message.attachments.length > 0;
}

function messageHasActionCandidate(message) {
  return Array.isArray(message?.pinCandidates) && message.pinCandidates.length > 0;
}

const {
  sessions,
  activeSessions,
  recentSessions,
  loadingSessions,
  sessionError,
  sessionModalOpen,
  sessionBusy,
  openSessionModal,
  closeSessionModal,
  loadSessions,
  createSession,
  applySessionAction,
  touchSessionPresence,
  endSession,
  isActionBusy,
  handleSessionSse,
  mergeSessionLocally,
} = useConversationSessions({ conversationId, meId, toast });

const {
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
  onPlaybackPlay,
  onPlaybackPause,
  onPlaybackSeek,
  onPlaybackEnd,
  onPlaybackTelemetry,
  onPlaybackIntent,
} = useConversationSessionUi({
  conversationId,
  meId,
  items: computed(() => items.value),
  activeCount: computed(() => activeCount.value),
  capsuleItems: computed(() => capsuleItems.value),
  sessions,
  activeSessions,
  recentSessions,
  spotlightMessage: computed(() => spotlightMessage.value),
  isSessionMessage,
  sessionMessageMeta,
  openCommandDeck,
  messageStageMode,
  stageDeckOpen,
  uiMode,
  touchSessionPresence,
  createSession,
  hasMessage: (...args) => hasMessage(...args),
  appendIncomingMessage: (...args) => appendIncomingMessage(...args),
  applySessionAction,
  endSession,
  mergeSessionLocally,
  nextTick,
});

const readReceipts = ref([]); // [{ userId, lastReadAt }]

// ✅ RealLife v2: Dock(상단)에서 액션/제안 관리
const dockJustMovedPinId = ref(null);
const {
  syncMobileViewport,
  useDockSheet,
  dockSheetTitle,
  dockSheetSubtitle,
  closeDockSheet,
} = useConversationRouteUiSync({
  route,
  watch,
  conversationId,
  currentSessionMini,
  uiMode,
  exploreTab,
  dockOpen,
  dockMode,
  isMobileViewport,
  suggestionCount: computed(() => suggestionCount.value),
  activeCount: computed(() => activeCount.value),
  loadSessions: (...args) => loadSessions(...args),
  syncSearchRailMode,
  setDockSheetBodyLocked,
});

const {
  flyLayer,
  rectOf,
  safeText,
  formatCandidateTime,
  formatCandidatePlace,
  makeCandidateGhostHtml,
  enqueueDockToActiveFly,
} = useConversationDockFly({
  ref,
  nextTick,
  dockMode,
  dockOpen,
  pins,
  activeFilter,
  classifyPin: (...args) => classifyPin(...args),
});

const {
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
  pinTimelineTimeText: dockPinTimelineTimeText,
  loadPins,
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
} = useConversationPinDock({
  ref,
  computed,
  watch,
  nextTick,
  router,
  conversationId,
  canViewConversation: () => canViewConversation.value,
  pins,
  items: computed(() => items.value),
  loadSessions: (...args) => loadSessions(...args),
  pinsStore,
  dockMode,
  dockOpen,
  activeFilter,
  dockSourceMsg,
  dockCandidates,
  isPinnedHighlight,
  pinTimeText: (...args) => pinTimeText(...args),
  openCommandDeck: (...args) => openCommandDeck(...args),
  closeCommandDeck: (...args) => closeCommandDeck(...args),
});

const myId = computed(() => auth.me?.id || null);

const {
  currentConversation,
  isGroupConversation,
  peer,
  peerName,
  peerHandle,
  hasPeer,
  peerInitial,
  peerSubtitle,
  openPeerProfile,
} = useConversationHeaderInfo({
  computed,
  router,
  conversationId,
  convStore,
});


/** ====== DM 잠금 ====== */
const {
  lockEnabled,
  unlocked,
  lockGatePw,
  lockModalOpen,
  lockModalMode,
  lockPw1,
  lockPw2,
  unlockToken,
  clearToken,
  canViewConversation,
  refreshLockState,
  handleUnlockGate,
  openLockModal,
  closeLockModal,
  submitLockModal,
} = useConversationLockAccess({
  conversationId,
  router,
  toast,
  loadSessions,
  loadPins,
});

const {
  content,
  sending,
  attachedFiles,
  attachmentUploading,
  attachmentProgress,
  attachmentError,
  fileInputRef,
  pendingAction,
  pendingActionPrimed,
  pendingHighlight,
  openAttachmentPicker,
  removeAttachedFile,
  clearAttachments,
  onPickFiles,
  loadPendingAction,
  clearPendingAction,
  pendingKindLabel,
  pendingSourceRoute,
  pendingSourceMeta,
  pendingSourcePreview,
  goPendingSource,
  primePendingAction,
  quickSendPendingAction,
  bumpPendingHighlight,
  onSend,
} = useConversationComposer({
  conversationId,
  canViewConversation,
  myId,
  composerRef,
  toast,
  router,
  uploadFiles,
  uploadFilesDetailed,
  sendMessage,
  lockEnabled,
  unlocked,
  unlockToken,
  clearToken,
  convStore,
  items: computed(() => items.value),
  newMsgCount,
  scrollToBottom,
  syncComposerHeightVar,
  openSuggestionsDock: (...args) => openSuggestionsDock(...args),
  triggerDockPulse: (...args) => triggerDockPulse(...args),
  hasMessage: (...args) => hasMessage(...args),
  upsertServerMessage: (...args) => upsertServerMessage(...args),
});

const {
  capsuleItems,
  capsuleLoading,
  capsuleModalOpen,
  capsuleTitle,
  capsuleUnlockAt,
  capsuleSaving,
  refreshCapsules,
  deleteCapsuleItem,
  relayFromCapsule,
  openCapsuleModal,
  closeCapsuleModal,
  createTimeCapsuleFromDraft,
} = useConversationCapsuleFlow({
  getConversationId: () => conversationId.value,
  getContentRef: () => content,
  getAttachedFilesRef: () => attachedFiles,
  getAttachmentUploadingRef: () => attachmentUploading,
  getAttachmentProgressRef: () => attachmentProgress,
  getAttachmentErrorRef: () => attachmentError,
  clearAttachments: () => clearAttachments,
  uploadFiles: () => uploadFiles,
  sendMessage: () => sendMessage,
  getLockEnabledRef: () => lockEnabled,
  getUnlockedRef: () => unlocked,
  getUnlockTokenRef: () => unlockToken,
  toast,
  getPendingActionRef: () => pendingAction,
  getPendingActionPrimedRef: () => pendingActionPrimed,
  primePendingAction: () => primePendingAction,
  bumpPendingHighlight: () => bumpPendingHighlight,
});

/** ====== Pins (Pinned) ====== */
// ✅ NEW: PIN_REMIND 배지
function clearPinRemindBadge() {
  pinsStore.clearRemindBadge?.(conversationId.value);
}

const showPinned = computed(() => {
  const arr = pins.value;
  return canViewConversation.value && Array.isArray(arr) && arr.length > 0;
});


const {
  pinModalOpen,
  pinModalAction,
  pinModalPin,
  pinActionLoading,
  pinModalTitle,
  pinModalSubtitle,
  pinModalConfirmText,
  pinModalConfirmVariant,
  pinEditOpen,
  pinEditTitle,
  pinEditPlaceText,
  pinEditStartAtLocal,
  pinEditRemindMinutes,
  pinEditLoading,
  REMIND_OPTIONS,
  pinTimeText,
  pinTimelineTimeText,
  openPinActionModal,
  closePinActionModal,
  confirmPinAction,
  sharePinToFeed,
  sharePinActivityToFeed,
  openPinEdit,
  closePinEdit,
  submitPinEdit,
} = useConversationPinUi({
  ref,
  computed,
  router,
  toast,
  conversationId,
  pinsStore,
  loadPins,
  pinDone,
  pinCancel,
  pinDismiss,
  pinUpdate,
  rememberPinAction,
  pinKindMeta,
  reminderTimeText,
  useDockSheet,
  dockOpen,
});

/** ====== 메시지 영역 ====== */
const {
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
} = useConversationMessageListFlow({
  ref,
  toast,
  conversationId,
  myId,
  lockEnabled,
  unlockToken,
  scrollToBottom,
  updateMessageDepthFocus: (...args) => updateMessageDepthFocus(...args),
});

const visibleMessages = computed(() => items.value || []);

const aiAssistMessage = computed(() => {
  const source = [...(items.value || [])].reverse();
  return (
    source.find((message) => !isMineMessage(message) && String(message?.content || "").trim()) ||
    source.find((message) => String(message?.content || "").trim()) ||
    null
  );
});

const aiAssistText = computed(() => String(aiAssistMessage.value?.content || "").trim());
const aiAssistMessageId = computed(() => String(aiAssistMessage.value?.messageId || aiAssistMessage.value?.id || ""));

function shouldAutoReminderFromReply(text) {
  const v = String(text || "").trim();
  return /이따|나중|잠시 후|조금 이따|다시 얘기|답할게/.test(v);
}

async function quickSendAiReply(reply) {
  const text = String(reply || "").trim();
  if (!text || sending.value) return;
  const autoReminder = shouldAutoReminderFromReply(text);
  content.value = text;
  await nextTick();
  syncComposerHeightVar();
  await onSend();

  if (autoReminder && conversationId.value) {
    try {
      const result = await executeConversationAiAction({
        conversationId: conversationId.value,
        messageId: aiAssistMessageId.value || null,
        type: "reminder",
        text,
        payload: {
          title: "이따 이어가기",
          source: text,
          remindMinutes: 30,
        },
      });
      toast.success?.(result?.message || "이따 다시 볼 알림을 만들었어요");
      if (result?.targetUrl?.startsWith?.("/")) {
        // 화면을 강제로 밀지 않고 핀/알림 상태만 새로 받아온다.
        loadPins?.();
      }
    } catch (e) {
      toast.error?.("알림 생성에 실패했어요");
    }
  }
}

function handleAiActionDone(result) {
  const message = result?.message || "액션을 처리했어요";
  toast.success?.(message);
  const targetUrl = String(result?.targetUrl || "");
  if (targetUrl.startsWith("/")) {
    router.push(targetUrl);
  }
}

const stagePool = computed(() => (items.value || []).filter((message) => isSessionMessage(message) || messageHasAttachment(message) || messageHasActionCandidate(message) || (searchFocusMid.value && String(searchFocusMid.value) === String(message?.messageId || ""))));
const stageFilteredMessages = computed(() => {
  const source = stagePool.value;
  if (stageSheetTab.value === "sessions") return source.filter((message) => isSessionMessage(message));
  if (stageSheetTab.value === "actions") return source.filter((message) => messageHasActionCandidate(message));
  if (stageSheetTab.value === "media") return source.filter((message) => messageHasAttachment(message));
  return source;
});
const stageRailCards = computed(() => stageFilteredMessages.value.slice(-3).reverse());
const spotlightMessage = computed(() => stageFilteredMessages.value.length ? stageFilteredMessages.value[stageFilteredMessages.value.length - 1] : null);
const stageStats = computed(() => ({
  total: stagePool.value.length,
  sessions: stagePool.value.filter((message) => isSessionMessage(message)).length,
  actions: stagePool.value.filter((message) => messageHasActionCandidate(message)).length,
  media: stagePool.value.filter((message) => messageHasAttachment(message)).length,
}));
const stageSheetTabs = computed(() => ([
  { key: "overview", label: "개요", count: stageStats.value.total },
  { key: "sessions", label: "세션", count: stageStats.value.sessions },
  { key: "actions", label: "액션", count: stageStats.value.actions },
  { key: "media", label: "미디어", count: stageStats.value.media },
]));
const stageSheetSessions = computed(() => stagePool.value.filter((message) => isSessionMessage(message)).slice().reverse());
const stageSheetActions = computed(() => stagePool.value.filter((message) => messageHasActionCandidate(message)).slice().reverse());
const stageSheetMedia = computed(() => stagePool.value.filter((message) => messageHasAttachment(message)).slice().reverse());

function openStageSheet(tab = "overview") {
  stageSheetTab.value = tab;
  stageDeckOpen.value = true;
}

function updateMessageDepthFocus() {}
function messageDepthStyle() { return {}; }

function getReadLabel(message) {
  const senderId = String(message?.senderId || "");
  if (!senderId) return "";
  const seen = (readReceipts.value || []).filter((row) => String(row?.userId || "") !== senderId && row?.lastReadAt && new Date(row.lastReadAt).getTime() >= new Date(message?.createdAt || 0).getTime());
  return seen.length ? `읽음 ${seen.length}` : "";
}

function messageTimeText(message) {
  const raw = String(message?.createdAt || "").replace(" ", "T");
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const {
  hasMessageTools,
  candidateToggleLabel,
  messageUtilitySummary,
  isGroupWithPrev,
  isGroupWithNext,
  shouldShowMessageMeta,
} = useConversationMessageMeta({
  items,
  isMineMessage,
  isCandidatesOpen,
  messageHasAttachment,
  getReadLabel,
});

const {
  messageShellClass,
  messageBubbleClass,
  messageBodyClass,
  messageSessionBlockClass,
  shouldShowMessageEyebrow,
  messageEyebrowLabel,
  messageEyebrowHint,
  hasMessageAttachmentBlock,
  hasMessageSendState,
  shouldRenderMessageFooter,
  messageMetaRowClass,
  messageFooterClass,
} = useConversationMessageVisuals({
  messageDepthEnabled,
  focusedDepthMid,
  messageStageMode,
  stageDeckOpen,
  messageDepthRank: () => "flat",
  isMineMessage,
  isGroupWithPrev,
  isGroupWithNext,
  isStageCandidate: (message) => stagePool.value.some((item) => String(item?.messageId || "") === String(message?.messageId || "")),
  sessionForMessage,
  flashMid,
  searchFocusMid,
});

let touchReadTimer = null;
function touchReadDebounced() {
  clearTimeout(touchReadTimer);
  touchReadTimer = setTimeout(async () => {
    if (!conversationId.value || !canViewConversation.value) return;
    try { await markConversationRead(conversationId.value); } catch {}
  }, 180);
}

function onScroll() {
  if (isNearBottom()) {
    newMsgCount.value = 0;
    touchReadDebounced();
  }
}

async function ensureSessionOrRedirect() {
  return ensureSessionOrRedirectGuard(router);
}

const commandDeckTabs = computed(() => ([
  { key: "search", label: "검색", badge: visibleMessages.value.length || 0 },
  { key: "actions", label: "액션", badge: suggestionCount.value || 0 },
  { key: "capsules", label: "캡슐", badge: capsuleItems.value?.length || 0 },
  { key: "sessions", label: "세션", badge: activeSessions.value?.length || recentSessions.value?.length || 0 },
]));

const {
  isTouchUi,
  detectTouchUi,
  onBubbleTouchStart,
  onBubbleTouchEnd,
  onBubbleClick,
  copyMessage,
  startEditFromMenu,
  toggleCandidatesFromMenu,
  retrySend,
  isSavedBadgeOn,
  isConfirmBusy,
  savingCandidateId,
  confirmCandidate,
  dismissCandidate,
} = useConversationMessageActions({
  conversationId,
  items,
  closeMsgMenu,
  openMsgMenu,
  startEdit,
  openSuggestionsDock,
  toast,
  sendMessage,
  canViewConversation,
  myId,
  lockEnabled,
  unlocked,
  unlockToken,
  clearToken,
  upsertServerMessage,
  newMsgCount,
  scrollToBottom,
  pinsStore,
  triggerDockPulse,
  nextTick,
  confirmPinFromMessage,
  rectOf,
  formatCandidateTime,
  safeText,
  classifyCandidate,
  makeCandidateGhostHtml,
  enqueueDockToActiveFly,
  dockJustMovedPinId,
  onBubbleFocus: (message) => {
    focusedDepthMid.value = String(message?.messageId || "");
  },
});

const { setupRealtimeTail, cleanupRealtimeTail } = useConversationRealtimeTail({
  sse,
  conversationId,
  lockEnabled,
  unlockToken,
  items,
  readReceipts,
  editingMid,
  fetchRecentMessages: async () => await fetchMessages({
    conversationId: conversationId.value,
    size: 20,
    unlockToken: lockEnabled.value ? unlockToken.value : null,
  }),
  fetchReadReceipts: async () => await import("@/api/conversations").then(({ fetchConversationReadReceipts }) => fetchConversationReadReceipts(conversationId.value)),
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
});

watch(() => commandDeckOpen.value, async (open) => {
  if (open) return;
  await nextTick();
  updateMessageDepthFocus();
});


useConversationBootFlow({
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
  setUiModeExploreSearch: () => {
    uiMode.value = 'explore';
    exploreTab.value = 'search';
  },
});

</script>

<template>
  <div ref="pageRef" class="page">
    <div class="topbar">
      <RlButton size="sm" variant="soft" @click="router.back()">←</RlButton>

      <button class="peer" type="button" @click="openPeerProfile" :disabled="!hasPeer">
        <div class="peerAva" aria-hidden="true">{{ peerInitial() }}</div>
        <div class="peerMeta">
          <div class="peerName">{{ peerName }}</div>
          <div class="peerHandle">{{ peerSubtitle }}</div>
        </div>
      </button>

      <div class="right">
        <RlButton
            size="sm"
            variant="soft"
            :title="lockEnabled ? '잠금 해제' : '잠금 설정'"
            @click="lockEnabled ? openLockModal('disable') : openLockModal('set')"
        >
          {{ lockEnabled ? "🔒" : "🔓" }}
        </RlButton>
      </div>
    </div>

    <SseStatusBanner />

<!-- ✅ 잠금 게이트 -->
    <div v-if="lockEnabled && !unlocked" class="lockGate">
      <div class="lockCard">
        <div class="lockTitle">🔒 잠금된 대화</div>
        <div class="lockSub">비밀번호를 입력해야 대화를 볼 수 있어요.</div>

        <input
            v-model="lockGatePw"
            class="lockInput"
            type="password"
            placeholder="비밀번호 입력"
            @keydown.enter.prevent="handleUnlockGate"
        />

        <div class="lockActions">
          <button class="lockBtn" type="button" @click="handleUnlockGate">열기</button>
          <button class="lockBtn soft" type="button" @click="router.back()">뒤로</button>
        </div>
      </div>
    </div>

    <AsyncStatePanel
      v-else-if="loading"
      icon="⏳"
      title="대화를 불러오는 중이에요"
      description="메시지와 액션 흐름을 연결하고 있어요."
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="대화를 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="뒤로 가기"
      @primary="loadFirst"
      @secondary="() => router.back()"
    />

    <!-- ✅ 메시지 스크롤 -->
    <ConversationMessageListRail
      v-else
      ref="scrollerRef"
      :can-view-conversation="canViewConversation"
      :has-search-focus="hasSearchFocus"
      :search-focus-term="searchFocusTerm"
      :has-next="hasNext"
      :visible-messages="visibleMessages"
      :unread-divider-mid="unreadDividerMid"
      :editing-mid="editingMid"
      :editing-text="editingText"
      :saving-edit="savingEdit"
      :flash-mid="flashMid"
      :search-focus-mid="searchFocusMid"
      :message-shell-class="messageShellClass"
      :message-depth-style="messageDepthStyle"
      :message-bubble-class="messageBubbleClass"
      :message-body-class="messageBodyClass"
      :message-session-block-class="messageSessionBlockClass"
      :has-message-tools="hasMessageTools"
      :is-mine-message="isMineMessage"
      :candidate-toggle-label="candidateToggleLabel"
      :is-saved-badge-on="isSavedBadgeOn"
      :should-show-message-eyebrow="shouldShowMessageEyebrow"
      :message-eyebrow-label="messageEyebrowLabel"
      :message-eyebrow-hint="messageEyebrowHint"
      :is-session-message="isSessionMessage"
      :render-message-html="renderMessageHtml"
      :session-for-message="sessionForMessage"
      :is-action-busy="isActionBusy"
      :me-id="meId"
      :message-has-action-candidate="messageHasActionCandidate"
      :message-utility-summary="messageUtilitySummary"
      :should-render-message-footer="shouldRenderMessageFooter"
      :message-footer-class="messageFooterClass"
      :has-message-attachment-block="hasMessageAttachmentBlock"
      :has-message-send-state="hasMessageSendState"
      :should-show-message-meta="shouldShowMessageMeta"
      :message-meta-row-class="messageMetaRowClass"
      :get-read-label="getReadLabel"
      :is-group-with-next="isGroupWithNext"
      :message-time-text="messageTimeText"
      :new-msg-count="newMsgCount"
      @refocus-search-target="refocusSearchTarget"
      @repeat-search="openConversationSearch(searchFocusTerm)"
      @clear-search-focus="clearSearchFocus"
      @load-more="loadMore"
      @update:editing-text="editingText = $event"
      @open-msg-menu="openMsgMenu"
      @bubble-touch-start="onBubbleTouchStart"
      @bubble-touch-end="onBubbleTouchEnd"
      @bubble-click="onBubbleClick"
      @copy-message="copyMessage"
      @start-edit="startEdit"
      @toggle-candidates="toggleCandidates"
      @cancel-edit="cancelEdit"
      @save-edit="saveEdit"
      @activate-session="activateSessionControls($event, { scroll: true })"
      @play="onPlaybackPlay"
      @pause="onPlaybackPause"
      @seek="onPlaybackSeek"
      @end="onPlaybackEnd"
      @playback-intent="onPlaybackIntent"
      @position-sampled="onPlaybackTelemetry"
      @touch-presence="onTouchPlaybackPresence"
      @retry-send="retrySend"
      @jump-to-newest="jumpToNewest"
    />

    <!-- ✅ composer (항상 화면 하단에 보이게 CSS에서 sticky 처리) -->
    <div ref="composerRef" class="composerWrap" v-if="canViewConversation">
      <StageSheet
        v-model:open="stageDeckOpen"
        v-model:tab="stageSheetTab"
        :tabs="stageSheetTabs"
        :spotlight-message="spotlightMessage"
        :rail-cards="stageRailCards"
        :sessions="stageSheetSessions"
        :actions="stageSheetActions"
        :media="stageSheetMedia"
        :resolve-session-title="(message) => sessionForMessage(message)?.title || ''"
        :message-type-icon="(message) => isSessionMessage(message) ? '▶' : messageHasAttachment(message) ? '🖼' : messageHasActionCandidate(message) ? '📌' : '💬'"
        @jump-to-message="(messageId) => ensureMessageVisible(messageId, 4)"
        @open-session="(message) => activateSessionControls(sessionForMessage(message), { scroll: true })"
      />
      <ConversationPendingBridge
        v-if="pendingAction"
        :pending-action="pendingAction"
        :primed="pendingActionPrimed"
        :highlight="pendingHighlight"
        :source-meta="pendingSourceMeta()"
        :source-preview="pendingSourcePreview()"
        :can-open-source="!!pendingSourceRoute()"
        @quick-send="quickSendPendingAction"
        @prime="() => { primePendingAction(false, true); bumpPendingHighlight(); }"
        @open-source="goPendingSource"
        @close="clearPendingAction"
      />

    <ConversationAiAssist
      :conversation-id="conversationId"
      :message-id="aiAssistMessageId"
      :source-text="aiAssistText"
      @quick-send="quickSendAiReply"
      @action-done="handleAiActionDone"
    />

    <ConversationComposerShell
      v-model:content="content"
      :sending="sending"
      :attachment-uploading="attachmentUploading"
      :attachment-progress="attachmentProgress"
      :attachment-error="attachmentError"
      :attached-files="attachedFiles"
      @pick-files="onPickFiles"
      @remove-attached-file="removeAttachedFile"
      @clear-attachments="clearAttachments"
      @open-capsule-modal="openCapsuleModal"
      @open-session-modal="openSessionModal"
      @send="onSend"
    >
      <template #utility>
        <ComposerUtilityBar
          :lens-badge="commandDeckTabs.find((tab) => tab.key === commandDeckTab)?.badge || 0"
          :stage-total="stageStats.total"
          :message-depth-enabled="messageDepthEnabled"
          :rail-primary-session="railPrimarySession"
          @open-lens="openCommandDeck('search')"
          @open-stage="openStageSheet('overview')"
          @toggle-depth="messageDepthEnabled = !messageDepthEnabled"
          @open-rail-session="openRailSession"
          @open-session-modal="openSessionModal()"
        />
      </template>
    </ConversationComposerShell>

    <teleport to="body">
      <div v-if="canViewConversation && commandDeckOpen" class="commandDeckBackdrop" @click.self="closeCommandDeck">
        <section class="commandDeck rl-cardish">
          <div class="commandDeck__grab"></div>
          <LensHeader
            eyebrow="Lens"
            :title="commandDeckTabs.find((tab) => tab.key === commandDeckTab)?.label || '검색'"
            close-label="렌즈 닫기"
            @close="closeCommandDeck"
          />
          <LensTabs v-model="commandDeckTab" :tabs="commandDeckTabs" />

          <section v-if="commandDeckTab === 'search'" class="commandDeck__panel">
            <ConversationSearchPanel
              v-model="conversationSearchQ"
              :summary="conversationSearchSummary"
              @submit="openConversationSearch()"
              @search-appointments="openConversationSearch('약속')"
              @search-capsules="openConversationSearch('캡슐')"
              @open-global="openGlobalSearch()"
            />
          </section>

          <section v-else-if="commandDeckTab === 'capsules'" class="commandDeck__panel">
            <ConversationCapsulePanel :items="capsuleItems" :loading="capsuleLoading" @refresh="refreshCapsules" @relay="relayFromCapsule" @delete="deleteCapsuleItem" :highlight-capsule-id="searchFocusCapsuleId" />
          </section>

          <section v-else-if="commandDeckTab === 'actions'" class="commandDeck__panel commandDeck__panel--actions">
            <ActivePinDock
              :dock-pulse-on="dockPulseOn"
              :dock-mode="dockMode"
              :suggestion-count="suggestionCount"
              :active-count="activeCount"
              :active-filter="activeFilter"
              :active-counts="activeCounts"
              :active-pins="dockActivePinsToShow"
              :pin-kind-meta="pinKindMeta"
              :pin-primary-summary="pinPrimarySummary"
              :source-message="dockSourceMsg"
              :candidates="sortedDockCandidates"
              :saving-candidate-id="savingCandidateId"
              :is-confirm-busy="isConfirmBusy"
              @update:dock-mode="(value) => { dockMode = value; dockOpen = true; }"
              @update:active-filter="(value) => { activeFilter = value; }"
              @confirm-candidate="({ message, payload }) => confirmCandidate(message, payload)"
              @dismiss-candidate="({ message, candidate }) => dismissCandidate(message, candidate)"
              @open-all="() => { clearPinRemindBadge(); router.push(`/inbox/conversations/${conversationId}/pins`); closeCommandDeck(); }"
            />
          </section>

          <section v-else class="commandDeck__panel">
            <SessionHub
              ref="sessionHubRef"
              :loading-sessions="loadingSessions"
              :session-error="sessionError"
              :active-sessions="activeSessions"
              :recent-sessions="recentSessions"
              :featured-active-session="featuredActiveSession"
              :secondary-active-sessions="secondaryActiveSessions"
              :visible-recent-sessions="visibleRecentSessions"
              :session-history-open="sessionHistoryOpen"
              :me-id="meId"
              :is-action-busy="isActionBusy"
              :is-session-activated="isSessionActivated"
              @open-session-modal="openSessionModal"
              @toggle-session-history="toggleSessionHistory"
              @activate-session="({ session, options }) => activateSessionControls(session, options || {})"
              @play="onPlaybackPlay"
              @pause="onPlaybackPause"
              @seek="onPlaybackSeek"
              @end="onPlaybackEnd"
              @playback-intent="onPlaybackIntent"
              @position-sampled="onPlaybackTelemetry"
              @touch-presence="onTouchPlaybackPresence"
            />
          </section>
        </section>
      </div>
    </teleport>

    <ConversationSessionComposer
      :open="sessionModalOpen"
      :busy="sessionBusy"
      @close="closeSessionModal"      @submit="onCreatePlaybackSession"
    />

    <CapsuleComposerModal
      :open="capsuleModalOpen"
      :title-text="capsuleTitle"
      :unlock-at="capsuleUnlockAt"
      :saving="capsuleSaving"
      @close="closeCapsuleModal"
      @update:title-text="capsuleTitle = $event"
      @update:unlock-at="capsuleUnlockAt = $event"
      @save="createTimeCapsuleFromDraft"
    />

    <ConversationPinActionModal
      :open="pinModalOpen"
      :title="pinModalTitle"
      :subtitle="pinModalSubtitle"
      :pin="pinModalPin"
      :time-text="pinTimeText(pinModalPin)"
      :confirm-variant="pinModalConfirmVariant"
      :confirm-text="pinModalConfirmText"
      :loading="pinActionLoading"
      @close="closePinActionModal"
      @confirm="confirmPinAction"
    />

    <ConversationPinEditModal
      :open="pinEditOpen"
      :loading="pinEditLoading"
      :title-text="pinEditTitle"
      :start-at-local="pinEditStartAtLocal"
      :remind-minutes="pinEditRemindMinutes"
      :place-text="pinEditPlaceText"
      :remind-options="REMIND_OPTIONS"
      @close="closePinEdit"
      @save="submitPinEdit"
      @update:title-text="pinEditTitle = $event"
      @update:start-at-local="pinEditStartAtLocal = $event"
      @update:remind-minutes="pinEditRemindMinutes = $event"
      @update:place-text="pinEditPlaceText = $event"
    />

  </div>
  </div>
  <Teleport to="body">
    <ConversationMessageMenuOverlay
      :open="menu.open"
      :top="menu.top"
      :left="menu.left"
      :message="menu.msg"
      :can-edit="!!(menu.msg && isMineMessage(menu.msg))"
      :has-candidates="!!(menu.msg && menu.msg.pinCandidates && menu.msg.pinCandidates.length)"
      @close="closeMsgMenu"
      @copy="copyMessage(menu.msg)"
      @edit="startEditFromMenu(menu.msg)"
      @toggle-candidates="toggleCandidatesFromMenu(menu.msg)"
    />

    <ConversationLockModal
      v-model:open="lockModalOpen"
      :mode="lockModalMode"
      :is-narrow="isNarrow"
      v-model:password="lockPw1"
      v-model:confirm-password="lockPw2"
      @submit="submitLockModal"
      @close="closeLockModal"
    />
  </Teleport>
</template>

<style>
/* =========================
   핵심: 화면 고정 레이아웃
   ========================= */
.page{
  /* ✅ window(바디) 스크롤이 생기지 않게, 화면을 고정 */
  position: fixed;
  left: 0;
  right: 0;

  /* ✅ AppHeader에 가리지 않게 */
  top: var(--app-header-h, 64px);

  /* ✅ 하단 탭바가 있다면 이 값만큼 비워둠(기본 72px) */
  bottom: var(--app-bottombar-h, 72px);

  display:flex;
  flex-direction:column;
  min-height:0;
  overflow:hidden;
  background: transparent;
}

/* 상단바 */
.topbar{
  padding: 12px 12px 10px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:10px;
}

.peer{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  border:1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 84%, transparent);
  padding:8px 10px;
  border-radius: 16px;
  cursor:pointer;
  text-align:left;
}
.peer:disabled{opacity:.7;cursor:default}
.peer:hover{border-color: color-mix(in oklab, var(--accent) 28%, var(--border));}
.peerAva{
  width:34px;height:34px;border-radius:50%;
  display:grid;place-items:center;
  background:
      radial-gradient(12px 12px at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(135deg, color-mix(in oklab, var(--accent) 76%, white), color-mix(in oklab, var(--success) 68%, white));
  color:#0b0f14;
  font-weight:950;
  flex:0 0 auto;
}
.peerMeta{min-width:0;display:flex;flex-direction:column;gap:2px}
.peerName{font-weight:950;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.peerHandle{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.right{display:flex;justify-content:flex-end}

.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}

.pinRemindDot{
  display:inline-block;
  width:8px;height:8px;
  margin-left:8px;
  border-radius:999px;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
  vertical-align: middle;
}

/* 잠금 게이트 */
.lockGate{
  flex:1;
  display:grid;
  place-items:center;
  padding: 0 14px 18px;
}
.lockCard{
  max-width: 420px;
  width: 100%;
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  box-shadow:
      0 18px 60px rgba(0,0,0,.28),
      0 1px 0 rgba(255,255,255,.06) inset;
  border-radius: var(--r-lg);
  padding: 16px;
  backdrop-filter: blur(14px);
}
.lockTitle{font-weight:950;font-size:16px}
.lockSub{margin-top:6px;color:var(--muted);font-size:12px}
.lockInput{
  width:100%;
  margin-top:12px;
  height:44px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface-2) 88%,transparent);
  padding:0 12px;
  color:var(--text);
}
.lockActions{display:flex;gap:8px;margin-top:12px}
.lockBtn{
  flex:1;
  height:44px;
  border-radius:16px;
  border:1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background:color-mix(in oklab, var(--accent) 16%, transparent);
  font-weight:950;
  color:var(--text);
}
.lockBtn.soft{
  border:1px solid var(--border);
  background:transparent;
}

/* =========================
   메시지 스크롤 영역
   ========================= */
.scroller{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px;

  /* ✅ composer가 sticky로 떠도 마지막 메시지가 가려지지 않게 */
  padding-bottom: calc(var(--composer-h, 82px) + 18px);
}
.inner{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  flex-direction:column;
  gap:10px;
  padding-bottom: 12px;
}

.more{display:grid;place-items:center}
.moreBtn{
  height:40px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text);
  font-weight:900;
}

.msg{display:flex;flex-direction:column;align-items:flex-start;--msg-gap:10px;--msg-meta-gap:6px}
.msg.mine{align-items:flex-end}
.msg--plain{--msg-gap:10px}
.msg--action,.msg--media{--msg-gap:9px}
.msg--session{--msg-gap:8px;--msg-meta-gap:5px}
.msg + .msg{margin-top:var(--msg-gap)}
.msg--session + .msg:not(.msg--session){margin-top:9px}
.msg:not(.msg--session) + .msg--session{margin-top:12px}

.bubble{
  position: relative;
  overflow: visible;
  max-width:75%;
  padding:10px 14px;
  border-radius:18px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  border:1px solid var(--border);
  font-size:13.5px;
  line-height:1.45;
  white-space:pre-wrap;
}
.msg.mine .bubble{
  background:color-mix(in oklab,var(--accent) 16%,transparent);
  border-color:color-mix(in oklab,var(--accent) 40%,var(--border));
}
.text{white-space:pre-wrap}
.messageFooter{
  display:grid;
  gap:8px;
  margin-top:10px;
  padding-top:10px;
  border-top:1px solid color-mix(in oklab, var(--border) 70%, transparent);
}
.messageFooter--session{border-top-color:color-mix(in oklab, var(--accent) 20%, var(--border));}
.messageFooter--action{border-top-color:color-mix(in oklab, #ffd98a 18%, var(--border));}
.messageFooter--media{border-top-color:color-mix(in oklab, #86f5d4 18%, var(--border));}
.messageFooter--focus{border-top-color:color-mix(in oklab, var(--accent) 16%, var(--border));}
.messageMetaRow{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:var(--msg-meta-gap,6px);
  padding-inline:4px;
  min-height:16px;
  color:var(--muted);
}
.messageMetaRow--mine{justify-content:flex-end;}
.messageMetaRow--stacked{margin-top:4px;}
.time,.readReceipt{font-size:11px;color:inherit;line-height:1.2;}
.time{opacity:.8;}
.readReceipt{font-weight:900;opacity:.76;}
.candidates{ margin-top: 10px; display: grid; gap: 8px; }
.bottomSpacer{height:10px}

/* ✅ 새 메시지 배너: composer 위에 안정적으로 */
.newBanner{
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--composer-h, 82px) + 16px);
  z-index: 50;

  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 14%, var(--bg));
  color: var(--text);
  font-weight: 950;
}

/* =========================
   composer: 항상 하단 고정
   ========================= */
.composerWrap{
  position: sticky;
  bottom: 0;
  z-index: 60;

  padding: 10px 12px 14px;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;

  background: color-mix(in oklab, var(--bg) 92%, transparent);
  border-top: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  backdrop-filter: blur(10px);
}

.timelineHeroHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.timelineHeroEyebrow{
  font-size:11px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:rgba(255,255,255,.46);
}
.timelineHeroTitle{
  margin-top:4px;
  font-size:15px;
  font-weight:900;
  letter-spacing:-.02em;
}
.timelineHeroTotal{
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  color:rgba(255,255,255,.92);
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);
}
.dockTimelineHero{
  margin-bottom:12px;
  padding:14px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
    color-mix(in oklab, var(--surface) 90%, rgba(10,18,40,.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}
.timelineHeroStats{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
  margin-top:12px;
}
.timelineStat{
  display:grid;
  gap:4px;
  padding:10px 11px;
  border-radius:14px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
}
.timelineStatK{
  font-size:12px;
  color:rgba(255,255,255,.66);
}
.timelineStat strong{
  font-size:18px;
  line-height:1;
}
.timelineStatSub{
  font-size:11px;
  color:rgba(255,255,255,.54);
}
.timelineScanStrip{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
  margin-top:12px;
}
.timelineScanCard{
  display:grid;
  gap:6px;
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.03);
}
.timelineScanCard[data-tone="accent"]{
  border-color:color-mix(in oklab, var(--accent) 32%, rgba(255,255,255,.08));
}
.timelineScanCard[data-tone="warn"]{
  border-color:color-mix(in oklab, var(--warning) 36%, rgba(255,255,255,.08));
}
.timelineScanCard[data-tone="soft"]{
  border-color:color-mix(in oklab, var(--success) 30%, rgba(255,255,255,.08));
}
.timelineScanLabel{
  font-size:11px;
  font-weight:900;
  color:rgba(255,255,255,.6);
}
.timelineScanCard strong{
  font-size:14px;
  line-height:1.35;
}
.timelineScanMeta{
  font-size:12px;
  line-height:1.45;
  color:rgba(255,255,255,.72);
}
.timelineHeroNext{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  margin-top:12px;
  padding-top:12px;
  border-top:1px solid rgba(255,255,255,.06);
}
.timelineHeroNextLabel{
  font-size:12px;
  color:rgba(255,255,255,.58);
}
.timelineHeroNextTitle{
  font-size:13px;
  font-weight:800;
}
.timelineHeroNextTime{
  font-size:12px;
  color:rgba(255,255,255,.72);
}
.dockCardTopline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:8px;
}
.dockTypePill,
.dockStatePill{
  display:inline-flex;
  align-items:center;
  height:24px;
  padding:0 9px;
  border-radius:999px;
  font-size:11px;
  font-weight:800;
  border:1px solid rgba(255,255,255,.08);
}
.dockTypePill{
  color:rgba(255,255,255,.86);
  background:rgba(255,255,255,.035);
}
.dockStatePill{
  color:rgba(255,255,255,.88);
  background:rgba(255,255,255,.03);
}
.dockStatePill[data-tone="accent"]{
  background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--accent) 42%, rgba(255,255,255,.08));
}
.dockStatePill[data-tone="active"]{
  background:color-mix(in oklab, var(--success) 16%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--success) 34%, rgba(255,255,255,.08));
}
.dockStatePill[data-tone="warn"]{
  background:color-mix(in oklab, var(--warning) 18%, rgba(255,255,255,.03));
  border-color:color-mix(in oklab, var(--warning) 40%, rgba(255,255,255,.08));
}
.dockProgress{
  height:7px;
  margin-top:10px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
  overflow:hidden;
}
.dockProgressFill{
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg, color-mix(in oklab, var(--accent) 88%, white), color-mix(in oklab, var(--success) 72%, white));
}
.dockCardSummary{
  display:grid;
  gap:8px;
  margin-top:10px;
  padding:10px 11px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.06);
  background:rgba(255,255,255,.025);
}
.dockCardSummaryLine{
  display:grid;
  gap:3px;
}
.dockCardSummaryLabel{
  font-size:11px;
  font-weight:800;
  color:rgba(255,255,255,.56);
}
.dockCardSummaryText{
  font-size:12px;
  line-height:1.45;
  color:rgba(255,255,255,.9);
}
.dockCardHint{
  margin-top:8px;
  font-size:11px;
  color:rgba(255,255,255,.58);
}
@media (max-width: 900px){
  .dockPanel{
    max-height: none;
  }
  .dockRow{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px){
  .timelineHeroStats{
    grid-template-columns:1fr;
  }
  .dockCardTopline{
    align-items:flex-start;
    flex-direction:column;
  }
  .dockRow{
    grid-template-columns: 1fr;
  }
}

.composerInner{
  display:flex;
  gap: 10px;
  align-items:center;
}
.input{
  flex:1;
  height: 44px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color: var(--text);
  padding: 0 12px;
}
.btn{
  height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border));
  background: color-mix(in oklab, var(--accent) 16%, transparent);
  color: var(--text);
  font-weight: 950;
}

/* ✅ 저장됨 배지 */
.savedBadge{
  position:absolute;
  top:-10px;
  right:8px;
  padding:4px 8px;
  border-radius:999px;
  font-size:11px;
  font-weight:800;
  letter-spacing:-0.2px;
  background: color-mix(in oklab, var(--accent) 22%, transparent);
  border: 1px solid color-mix(in oklab, var(--accent) 55%, transparent);
  backdrop-filter: blur(6px);
  opacity: 0;
  transform: translateY(2px);
  animation: savedBadgeIn 0.12s ease-out forwards;
}
@keyframes savedBadgeIn{
  to { opacity: 1; transform: translateY(0); }
}

/* 기존 모달 스타일(유지) */
.modalBackdrop{
  position:fixed;
  inset:0;
  background: rgba(0,0,0,.56);
  backdrop-filter: blur(10px);
  display:grid;
  place-items:center;
  padding: 20px;
  z-index: 120;
}
.modal{
  width: min(520px, calc(100% - 24px));
  border-radius: 22px;
  border: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  box-shadow: 0 28px 80px rgba(0,0,0,.42);
  padding: 16px;
}
.modalGrab{
  width: 52px;
  height: 5px;
  border-radius: 999px;
  margin: 0 auto 12px;
  background: color-mix(in oklab, var(--text) 20%, transparent);
}
.mTitle{font-weight:950}
.mSub{margin-top:6px;color:var(--muted);font-size:12px}
.mBody{margin-top:10px;display:grid;gap:8px}
.mInput{
  height:44px;border-radius:14px;border:1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  color:var(--text);padding:0 12px;
}
.mActions{margin-top:12px;display:flex;gap:8px}
.mBtn{
  flex:1;height:44px;border-radius:14px;border:1px solid var(--border);
  background: transparent;color:var(--text);font-weight:950;
}
.mBtn.soft{opacity:.85}
.sendState{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:20px;
  font-size: 12px;
  color: var(--muted);
}
.sendState[data-status="sending"]{ opacity: .9; }
.sendState[data-status="failed"]{
  color: color-mix(in oklab, var(--danger) 70%, var(--text));
}
.retryBtn{
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--danger) 35%, var(--border));
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.retryBtn:hover{
  border-color: color-mix(in oklab, var(--danger) 55%, var(--border));
}

@media (max-width: 640px){
  .modalBackdrop{
    place-items:end center;
    padding: 12px 12px calc(env(safe-area-inset-bottom) + var(--app-bottombar-h, 56px) + 12px);
  }
  .modal,
  .modal--sheet{
    width: 100%;
    border-radius: 22px;
    padding: 16px 14px;
  }
  .mActions{
    flex-direction: column;
  }
  .mBtn{
    height: 48px;
  }
}

/* ===== Mobile / Narrow ===== */
@media (max-width: 520px) {
  /* 모바일에서는 탭바 높이가 더 작을 수도 있어서 기본값 조정(필요시 수정) */
  .page{
    bottom: var(--app-bottombar-h, 56px);
  }

  .topbar{
    padding: 10px 10px 8px;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "back peer"
      "lock lock";
    gap: 8px;
  }
  .topbar > :first-child { grid-area: back; }
  .peer { grid-area: peer; }
  .right { grid-area: lock; justify-content: flex-start; }

  .peer{ padding: 8px 10px; border-radius: 14px; }
  .peerAva{ width: 32px; height: 32px; }
  .peerName{ font-size: 12.5px; }

  .pinActions{
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .composerWrap{
    padding: 10px 10px 12px;
  }
  .composerInner{
    gap: 8px;
  }
  .composerInner .input{
    height: 44px;
    font-size: 16px; /* iOS 자동 줌 방지 */
  }
  .composerInner .btn{
    min-width: 72px;
    height: 44px;
  }

  .newBanner{
    left: 10px;
    right: 10px;
    width: auto;
    transform: none;
  }

  .dockWrap{
    top: 50px;
    padding: 10px 10px 0;
  }
  .dockBar{
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
  }
  .dockTab{
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
    min-height: 40px;
  }
  .dockMore{
    width: 100%;
  }
  .dockFilterBar{
    padding-left: 0;
    padding-right: 0;
  }
}

/* ===== Custom Scrollbar (ConversationDetailView scroller) ===== */
.scroller::-webkit-scrollbar { width: 8px; }
.scroller::-webkit-scrollbar-track { background: transparent; }
.scroller::-webkit-scrollbar-thumb {
  background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--accent) 60%, transparent),
      color-mix(in oklab, var(--accent) 40%, transparent)
  );
  border-radius: 999px;
  transition: background 0.2s ease;
}
.scroller::-webkit-scrollbar-thumb:hover { background: var(--accent); }
/* Firefox */
.scroller { scrollbar-width: thin; scrollbar-color: var(--accent) transparent; }
.msg--flash .bubble{
  outline: 2px solid color-mix(in oklab, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 15%, transparent);
  transition: outline .2s ease, box-shadow .2s ease;
}
.unreadDivider{
  margin: 14px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: .8;
}
.unreadDivider::before,
.unreadDivider::after{
  content: "";
  flex: 1;
  height: 1px;
  background: color-mix(in oklab, var(--border) 80%, transparent);
}
.unreadDivider span{
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 92%, transparent);
}
/* ✅ 같은 그룹(이전 메시지와 이어짐)이면 위 간격을 줄여서 '붙어보이게' */
.msg.msg--groupPrev {
  margin-top: -6px;
}

/* ✅ 버블 라운드도 살짝 다듬기: 그룹이면 위/아래 모서리를 덜 둥글게 */
.msg.msg--groupPrev:not(.mine) .bubble {
  border-top-left-radius: 10px;
}
.msg.msg--groupNext:not(.mine) .bubble {
  border-bottom-left-radius: 10px;
}

.msg.msg--groupPrev.mine .bubble {
  border-top-right-radius: 10px;
}
.msg.msg--groupNext.mine .bubble {
  border-bottom-right-radius: 10px;
}
.editTrigger{
  margin-top: 6px;
  font-size: 11px;
  font-weight: 800;
  opacity: .65;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: right;
  width: 100%;
}

/* ===== 편집 UI (bubble 안에서 자연스럽게) ===== */
.editBox{
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1.45;
  padding: 4px 0;
}

.editActions{
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.editBtn{
  padding: 5px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  cursor: pointer;
}

.editBtn--primary{
  border: 1px solid rgba(80,160,255,.55);
  background: rgba(80,160,255,.18);
}

/* “수정됨”은 줄바꿈 말고 옆에 살짝 */
.editedMark{
  margin-left: 6px;
  font-size: 11px;
  opacity: .55;
}
/* ===== 메시지 ⋯ 메뉴 (개선) ===== */
/* 메뉴 래퍼: bubble 우상단 고정 */
.msgMenuWrap{
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 50;
}

/* 메뉴 버튼: 항상 "살짝" 보이게 (hover 없어도 어색하지 않게) */
.msgMenuBtn{
  width: 28px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,.85);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: .35;                 /* ✅ 0 → 0.35로 (항상 살짝 보임) */
  transition: opacity .15s ease, transform .15s ease, background .15s ease;
}

/* hover 시만 보이게 (모바일은 터치라 클릭하면 보임) */
.msg:hover .msgMenuBtn{
  opacity: .95;
}

.msgMenuBtn:active{
  transform: scale(.98);
}

/* 메뉴: 레이아웃을 밀지 않도록 "absolute"로 띄우기 */
.msgMenu{
  position: absolute;           /* ✅ 핵심 */
  top: 30px;
  right: 0;
  min-width: 120px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(20,25,35,.95);
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  overflow: hidden;
  z-index: 60;
}

.msgMenuItem{
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor: pointer;
}

.msgMenuItem:hover{
  background: rgba(255,255,255,.08);
}
@media (hover: none){
  /* 모바일에서는 hover UI 숨기고 ⋯만 사용 */
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

@media (pointer: coarse) and (max-width: 900px) and (max-width: 900px){
  /* 일부 WebView는 hover:none 판정이 불안정 → 터치 디바이스 강제 */
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

/* legacy */
@media (hover: none){
  .msgMenuBtn{ opacity: .6; }
}
/* ✅ 버블 안 액션 버튼 (⋯) */
.msg .bubble{ position: relative; overflow: visible; }

.msgActionBtn{
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,.9);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: .25;
  transition: opacity .15s ease, transform .15s ease;
}

.msg:hover .msgActionBtn{ opacity: .95; }
@media (hover: none){ .msgActionBtn{ opacity: .55; } }
.msgActionBtn:active{ transform: scale(.98); }

/* ✅ Teleport 메뉴 */
.msgMenuOverlay{
  position: fixed;
  inset: 0;
  z-index: var(--z-lightbox);
}

.msgMenuPopover{
  position: fixed;
  min-width: 140px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(20,25,35,.95);
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  overflow: hidden;
}

.msgMenuItem{
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.92);
  cursor: pointer;
}

.msgMenuItem:hover{
  background: rgba(255,255,255,.08);
}
/* =========================
   RealLife v1: Hover Actions
   ========================= */

.bubble {
  position: relative;
  overflow: visible;
}

/* 기본은 안 보이게, hover 시 보이게 */
.msgMenuTrigger{
  position:absolute;
  top:8px;
  right:8px;
  width:26px;
  height:26px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:none;
  border-radius:10px;
  background:color-mix(in oklab, var(--panel) 76%, transparent);
  color:rgba(255,255,255,.62);
  cursor:pointer;
  opacity:.42;
  transition:opacity .15s ease, background .15s ease, color .15s ease;
}
.msg:hover .msgMenuTrigger,
.msg:focus-within .msgMenuTrigger{
  opacity:.92;
  background:color-mix(in oklab, var(--panel) 88%, rgba(255,255,255,.06));
  color:rgba(255,255,255,.9);
}

.hoverActions{
  position: absolute;
  top: 8px;
  right: 40px;
  display: flex;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity .15s ease, transform .15s ease;
}

.msg:hover .hoverActions,
.msg:focus-within .hoverActions{
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.haBtn{
  min-width: 32px;
  height: 28px;
  padding: 0 9px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--border) 82%, rgba(255,255,255,.14));
  background: color-mix(in oklab, var(--panel) 86%, rgba(255,255,255,.05));
  color: rgba(255,255,255,.86);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.haBtn__icon{font-size:12px; line-height:1;}
.haBtn__label{font-size:11px; font-weight:700; letter-spacing:.01em;}
.haBtn--accent{
  border-color:color-mix(in oklab, var(--accent) 30%, var(--border));
  color:color-mix(in oklab, white 84%, var(--accent));
}

.haBtn:hover,
.msgMenuTrigger:hover{
  background: color-mix(in oklab, var(--panel) 72%, rgba(255,255,255,.08));
}

.messageToolSummary{
  display:flex;
  align-items:center;
  flex-wrap:wrap;
}
.msg--action .messageToolSummary{margin-top:-2px}
.msg--action .messageToolSummary small{background:rgba(255,210,118,.08);border-color:rgba(255,210,118,.12);color:rgba(255,238,206,.78)}

.messageToolSummary{
  margin-top:10px;
  display:flex;
  align-items:center;
  gap:8px;
}
.messageToolSummary small{
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-height:22px;
  padding:0 8px;
  border-radius:999px;
  border:1px solid color-mix(in oklab, var(--border) 86%, rgba(255,255,255,.08));
  background:color-mix(in oklab, var(--panel) 88%, transparent);
  color:var(--muted);
}

/* 모바일에서는 hover 액션 숨김 */
@media (hover: none) {
  .hoverActions{
    display:none;
  }
  .msgMenuTrigger{
    opacity:.78;
  }
}


/* =========================
   Mobile/App adjustments
   ========================= */
.mobileOnly{ display:none; }



/* =========================
   RealLife v2: Active Actions Dock
   ========================= */
.dockWrap{
  position: sticky;
  top: 54px; /* topbar 높이에 맞춤 (필요하면 52~60 조정) */
  z-index: 20;
  padding: 10px 12px 0;
}

.dockBar{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.78);
  backdrop-filter: blur(14px);
  padding: 8px 8px;
}

.dockTab{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  cursor:pointer;
}
.dockTab.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.16);
}
.dockTab:disabled{
  opacity: .45;
  cursor: not-allowed;
}

.dockCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  font-size: 11px;
  font-weight: 950;
}

.dockSpacer{ flex: 1; }

.dockMore{ white-space: nowrap; }

.dockPanel{
  max-width: 760px;
  margin: 10px auto 0;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.64);
  backdrop-filter: blur(14px);
  padding: 10px;
  max-height: min(62vh, 760px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dockPanel::-webkit-scrollbar{ width: 8px; }
.dockPanel::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.dockGrid{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.dockRowWrap{
  display:grid;
  gap:10px;
}
.dockBrowseHint{
  padding: 0 4px;
  font-size: 11px;
  color: rgba(255,255,255,.60);
}
.dockRow{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: 6px;
}

.dockCard{
  min-width: 0;
  max-width: none;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  padding: 10px 10px;
  cursor: pointer;
}

.dockCard.placeholder{
  opacity: .65;
  filter: saturate(.85);
  border-style: dashed;
}

.dockCard.placeholder .dockCardTitle{
  opacity: .75;
}

.dockCard.placeholder{
  position: relative;
  overflow: hidden;
}
.dockCard.placeholder::after{
  content:"";
  position:absolute;
  inset:-40% -60%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent);
  transform: translateX(-30%);
  animation: rlShimmer 1.1s linear infinite;
  pointer-events:none;
}
@keyframes rlShimmer{
  from{ transform: translateX(-40%); }
  to{ transform: translateX(40%); }
}


.dockCardTitle{
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 6px;
}
.dockCardMeta{
  font-size: 12px;
  opacity: .9;
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dockCardMeta .sep{ opacity: .55; }
.dockEmpty{
  padding: 10px 8px;
  font-size: 12px;
  opacity: .8;
}

.dockSuggestHead{
  display:flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
}
.dockSuggestTitle{
  font-size: 13px;
  font-weight: 950;
}
.dockSuggestSub{
  font-size: 12px;
  opacity: .8;
}

.dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 520px){
  .dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{ grid-template-columns: repeat(1, minmax(0, 1fr)); }
}
@media (min-width: 521px) and (max-width: 900px){
  .dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}


/* =========================
   Mobile/App adjustments
   ========================= */
.mobileOnly{ display:none; }



/* =========================
   RealLife v2: Active Actions Dock
   ========================= */
.dockWrap{
  position: sticky;
  top: 54px; /* topbar 높이에 맞춤 (필요하면 52~60 조정) */
  z-index: 20;
  padding: 10px 12px 0;
}

.dockBar{
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  display:flex;
  align-items:center;
  gap: 8px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.78);
  backdrop-filter: blur(14px);
  padding: 8px 8px;
}

.dockTab{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  cursor:pointer;
}
.dockTab.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.16);
}
.dockTab:disabled{
  opacity: .45;
  cursor: not-allowed;
}

.dockCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  font-size: 11px;
  font-weight: 950;
}

.dockSpacer{ flex: 1; }

.dockMore{ white-space: nowrap; }

.dockPanel{
  max-width: 760px;
  margin: 10px auto 0;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(18,22,30,.64);
  backdrop-filter: blur(14px);
  padding: 10px;
}

.dockGrid{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.dockRow{
  display:flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.dockRow::-webkit-scrollbar{ height: 6px; }
.dockRow::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.12); border-radius: 999px; }
.dockRow::-webkit-scrollbar-track{ background: transparent; }

.dockCard{
  min-width: 190px;
  max-width: 240px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  padding: 10px 10px;
  cursor: pointer;
}
.dockCardTitle{
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 6px;
}
.dockCardMeta{
  font-size: 12px;
  opacity: .9;
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dockCardMeta .sep{ opacity: .55; }
.dockEmpty{
  padding: 10px 8px;
  font-size: 12px;
  opacity: .8;
}

.dockSuggestHead{
  display:flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
}
.dockSuggestTitle{
  font-size: 13px;
  font-weight: 950;
}
.dockSuggestSub{
  font-size: 12px;
  opacity: .8;
}

.dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 520px){
  .dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{ grid-template-columns: repeat(1, minmax(0, 1fr)); }
}
@media (min-width: 521px) and (max-width: 900px){
  .dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}


/* ✅ Mobile/App: 강제 터치 모드(hover 없음 or coarse pointer) */
.mobileOnly{ display:none; }

@media (hover: none), (pointer: coarse){
  .hoverActions{ display:none !important; }
  .mobileOnly{ display:inline-flex; }
}

/* ✅ Dock animations */
.dockPanel.enter{
  animation: dockIn .22s ease-out;
}
@keyframes dockIn{
  from{ opacity:0; transform: translateY(-6px) scale(.98); }
  to{ opacity:1; transform: translateY(0) scale(1); }
}
.dockCard{
  animation: cardPop .18s ease-out;
}
@keyframes cardPop{
  from{ transform: translateY(6px); opacity:.0; }
  to{ transform: translateY(0); opacity:1; }
}

/* =========================
   v2.5 Dock polish (filter + stack + animations)
   ========================= */
.dockFilterBar{
  display:flex;
  gap:8px;
  padding:10px 10px 6px;
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
}
.dockFilterBar::-webkit-scrollbar{ display:none; }
.dockPill{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: -.2px;
}
.dockPill.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
  box-shadow: 0 10px 24px rgba(0,0,0,.22);
}
.dockPillCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:18px;
  height:18px;
  padding:0 6px;
  border-radius:999px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.10);
  font-size: 11px;
  font-weight: 900;
}

.dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{
  padding: 10px 12px 14px;
}
.dockSlot{
  position: relative;
}
.dockStackItem + .dockSlot{
  margin-top: 0;
}
.dockStackItem .leaving{
  animation: rl-leave .22s ease forwards;
}
@keyframes rl-leave{
  to { transform: translateY(-8px) scale(.98); opacity: 0; }
}

.dockCard.moved{
  animation: rl-moved .65s ease;
}
@keyframes rl-moved{
  0% { transform: translateY(0); box-shadow: 0 0 0 rgba(0,0,0,0); }
  35% { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(0,0,0,.35); }
  100% { transform: translateY(0); box-shadow: 0 0 0 rgba(0,0,0,0); }
}

/* 모바일: hoverAction은 숨기고(세로로 쌓임 방지), 탭/롱프레스로 메뉴 */
@media (pointer: coarse) and (max-width: 900px) and (max-width: 900px){
  .hoverActions{ display:none !important; }
}

/* =========================
   v2.6+ Dock visual polish
   ========================= */
.dockFilterBar{
  display:flex;
  gap:8px;
  padding: 10px 10px 6px;
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
}

.dockPill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.88);
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

.dockPill.on{
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
}

.dockPillCount{
  margin-left: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  font-size: 12px;
}

/* Suggestions: 1~3 slots */
.dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{
  display:grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 10px;
}
@media (min-width: 720px){
  .dockSuggestList{
  display:grid;
  gap:10px;
}
.dockSlot{display:grid}
.dockSlot .wrap[data-compact="true"]{margin-top:0}

.dockSuggestList{ grid-template-columns: 1fr 1fr 1fr; }
}

/* fly animation ghost */
.flyGhost{
  position: fixed;
  z-index: 99999;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(20,25,35,.94);
  box-shadow: 0 18px 46px rgba(0,0,0,.40);
  backdrop-filter: blur(14px);
  overflow: hidden;
  transition:
    left 560ms cubic-bezier(.16,1,.3,1),
    top 560ms cubic-bezier(.16,1,.3,1),
    width 560ms cubic-bezier(.16,1,.3,1),
    height 560ms cubic-bezier(.16,1,.3,1),
    border-radius 560ms cubic-bezier(.16,1,.3,1),
    box-shadow 560ms cubic-bezier(.16,1,.3,1),
    background 560ms cubic-bezier(.16,1,.3,1),
    transform 560ms cubic-bezier(.16,1,.3,1),
    opacity 520ms cubic-bezier(.2,.9,.2,1);
  opacity: 1;
}

.flyGhostInner{
  padding: 10px 12px;
}
.flyGhostTitle{
  font-weight: 900;
  font-size: 13px;
}

.flyGhostMeta{ font-size:12px; opacity:.88; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.flyGhostSub{
  margin-top: 4px;
  font-size: 12px;
  opacity: .7;
}

@keyframes rlDockPulse{
  0%{ transform: translateY(0); }
  50%{ transform: translateY(-1px); }
  100%{ transform: translateY(0); }
}
.dockWrap.dockPulse .dockPanel{
  animation: rlDockPulse 220ms cubic-bezier(.16,1,.3,1);
}

/* ===== v2.12 cinematic enhancements ===== */
.flyGhost{
  position: fixed;
  pointer-events: none;
  opacity: 0.98;
  transition:
    left 720ms cubic-bezier(.16,1,.3,1),
    top 720ms cubic-bezier(.16,1,.3,1),
    width 720ms cubic-bezier(.16,1,.3,1),
    height 720ms cubic-bezier(.16,1,.3,1),
    opacity 620ms cubic-bezier(.16,1,.3,1),
    border-radius 720ms cubic-bezier(.16,1,.3,1),
    box-shadow 720ms cubic-bezier(.16,1,.3,1),
    background 720ms cubic-bezier(.16,1,.3,1);
}

.flyGhostInner{
  width: 100%;
  height: 100%;
  animation: ghostTiltScale 720ms cubic-bezier(.16,1,.3,1) both;
  transform-origin: 70% 30%;
}

@keyframes ghostTiltScale{
  0%{ transform: rotate(-10deg) scale(1.03); }
  45%{ transform: rotate(6deg) scale(0.99); }
  100%{ transform: rotate(0deg) scale(1); }
}

/* subtle sparks */
.spark{
  position: fixed;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,.85);
  box-shadow: 0 0 10px rgba(255,255,255,.25);
  transform: translate(-50%,-50%);
  pointer-events:none;
  z-index: 10050;
  animation: sparkPop 520ms cubic-bezier(.2,.9,.2,1) both;
}
@keyframes sparkPop{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(.6) rotate(0deg); }
  15%{ opacity: 1; }
  100%{ opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.8) rotate(var(--rot)); }
}

/* placeholder shimmer */
.dockCard.placeholder{
  position: relative;
  overflow: hidden;
}
.dockCard.placeholder::after{
  content:"";
  position:absolute;
  inset:-20%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
  transform: translateX(-60%);
  animation: shimmer 900ms linear infinite;
}
@keyframes shimmer{
  0%{ transform: translateX(-60%); }
  100%{ transform: translateX(60%); }
}


/* ===== Final loop: dock visibility + unified states ===== */
.dockBar{flex-wrap:wrap;}
.dockSpacer{flex:1 1 auto;}
.dockMore{margin-left:auto;}
.dockPanel{
  max-height:min(54vh, 540px);
  overflow:auto;
  overscroll-behavior:contain;
  padding-bottom:14px;
}
.dockFilterBar{
  flex-wrap:wrap;
  overflow:visible;
  padding-bottom:0;
}
.timelineHeroStats,
.timelineFocusRow{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
}
.dockRowWrap{display:grid;gap:10px;}
.dockRow{
  display:grid !important;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:10px;
  overflow:visible;
  align-items:stretch;
}
.dockCard{
  min-width:0 !important;
  max-width:none !important;
  height:100%;
  display:flex;
  flex-direction:column;
}
.dockCardHint{
  margin-top:8px;
  min-height:32px;
  line-height:1.35;
}
.dockCardActions{
  margin-top:auto;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
}
.dockMiniBtn{
  appearance:none;
  min-width:0;
  min-height:40px;
  padding:0 12px;
  white-space:nowrap;
  border-radius:12px;
  border:1px solid color-mix(in oklab, var(--border) 86%, transparent);
  background:color-mix(in oklab, var(--surface-2) 90%, rgba(255,255,255,.03));
  color:var(--text);
  font-size:13px;
  font-weight:900;
  letter-spacing:-.01em;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
  transition:transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease;
}
.dockMiniBtn:hover{
  transform:translateY(-1px);
}
.dockMiniBtn:active{
  transform:translateY(0);
}
.dockMiniBtn--soft{
  background:color-mix(in oklab, var(--surface-2) 94%, rgba(255,255,255,.03));
}
.dockMiniBtn--primary{
  border-color:color-mix(in oklab, var(--accent) 46%, var(--border));
  background:color-mix(in oklab, var(--accent) 18%, rgba(255,255,255,.03));
  color:color-mix(in oklab, white 96%, var(--accent));
}
.dockMiniBtn--danger{
  border-color:color-mix(in oklab, var(--danger) 38%, var(--border));
  background:color-mix(in oklab, var(--danger) 14%, rgba(255,255,255,.03));
  color:color-mix(in oklab, white 96%, var(--danger));
}
.dockShareBtn{
  margin-top:8px;
  min-height:38px;
  width:100%;
  border-radius:12px;
  border:1px dashed color-mix(in oklab, var(--accent) 38%, var(--border));
  background:color-mix(in oklab, var(--accent) 10%, rgba(255,255,255,.03));
  color:var(--text);
  font-size:12px;
  font-weight:900;
}
.dockShareBtn:hover{background:color-mix(in oklab, var(--accent) 14%, rgba(255,255,255,.03));}
.dockTimelineHero{
  position:static;
  padding:14px;
}
.timelineFocusCard{
  border:1px solid color-mix(in oklab, var(--border) 82%, transparent);
  background: color-mix(in oklab, var(--surface-2) 78%, transparent);
  border-radius:16px;
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.timelineFocusCard[data-tone="upcoming"]{border-color: color-mix(in oklab, var(--accent) 35%, var(--border));}
.timelineFocusCard[data-tone="warn"]{border-color: color-mix(in oklab, #ffb84d 42%, var(--border));}
.timelineFocusCard[data-tone="todo"]{border-color: color-mix(in oklab, var(--success) 36%, var(--border));}
.timelineFocusLabel{font-size:11px;color:var(--muted);font-weight:800;}
.timelineFocusCard strong{font-size:24px;line-height:1;font-weight:950;}
.timelineFocusMeta{font-size:11px;color:rgba(255,255,255,.68);}
.timelineRecent{margin-top:12px;display:grid;gap:8px;}
.timelineRecentHead{font-size:11px;color:var(--muted);font-weight:900;}
.timelineRecentList{display:grid;gap:8px;}
.timelineRecentItem{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:14px;border:1px solid color-mix(in oklab, var(--border) 80%, transparent);background: color-mix(in oklab, var(--surface) 78%, transparent);}
.timelineRecentBadge{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:900;border:1px solid color-mix(in oklab, var(--border) 84%, transparent);}
.timelineRecentBadge[data-tone="done"]{background: color-mix(in oklab, var(--success) 18%, transparent);border-color: color-mix(in oklab, var(--success) 34%, var(--border));}
.timelineRecentBadge[data-tone="cancel"]{background: color-mix(in oklab, var(--danger) 14%, transparent);border-color: color-mix(in oklab, var(--danger) 34%, var(--border));}
.timelineRecentBadge[data-tone="hide"]{background: color-mix(in oklab, var(--surface-2) 76%, transparent);}
.timelineRecentBody{min-width:0;display:grid;gap:3px;}
.timelineRecentTitle{font-size:13px;font-weight:900;color:var(--text);}
.timelineRecentMeta{font-size:11px;color:var(--muted);}
.stateCardInline{max-width:760px;margin:0 auto;width:100%;padding:0 12px 12px;}
@media (max-width:900px){
  .dockWrap{top:52px;padding:8px 10px 0;}
  .dockPanel{max-height:min(52vh, 520px);}
  .timelineHeroStats,.timelineFocusRow,.timelineScanStrip{grid-template-columns:1fr;}
  .dockRow{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
  .dockBar{gap:6px;}
  .dockTab,.dockMore,.dockPill{justify-content:center;}
}
@media (max-width:640px){
  .dockWrap{top:48px;padding:8px 8px 0;}
  .dockBar{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;}
  .dockSpacer{display:none;}
  .dockMore{margin-left:0;grid-column:1 / -1;}
  .dockTab,.dockMore{width:100%;min-height:42px;}
  .dockPanel{margin-top:8px;max-height:min(46vh, 460px);padding:8px;}
  .dockFilterBar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px 2px 2px;}
  .dockPill{width:100%;}
  .timelineHeroHead{align-items:center;}
  .timelineHeroTotal{flex:0 0 auto;}
  .dockTimelineHero{padding:12px;}
  .dockRow{grid-template-columns:1fr !important;}
  .dockCard{padding:12px;}
  .dockCardActions{grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .dockMiniBtn{font-size:12px;min-height:38px;padding:0 10px;}
}


.timelineReminderCard{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-top:12px;
  padding:14px 16px;
  border-radius:18px;
  border:1px solid color-mix(in oklab,var(--accent) 26%, var(--border));
  background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%, transparent),color-mix(in oklab,var(--surface-2) 84%, transparent));
}
.timelineReminderEyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}
.timelineReminderTitle{margin-top:4px;font-size:15px;font-weight:900;line-height:1.45}
.timelineReminderMeta{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.45}
.timelineReminderActions{display:grid;gap:8px;justify-items:end}
.timelineReminderCount{font-size:12px;font-weight:800;color:color-mix(in oklab,var(--accent) 74%,white)}
.timelineReminderBtn{height:38px;padding:0 12px;border-radius:12px;border:1px solid color-mix(in oklab,var(--accent) 34%, var(--border));background:color-mix(in oklab,var(--accent) 18%, transparent);color:var(--text);font-weight:900}
.dockReminderRow{margin-top:8px;font-size:12px;line-height:1.45;color:color-mix(in oklab,var(--accent) 78%, white)}
@media (max-width: 720px){
  .timelineReminderCard{grid-template-columns:1fr;display:grid;align-items:start}
  .timelineReminderActions{justify-items:start}
}


.dockCardTimeline{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}
.dockCardTimelineHead{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .02em;
  color: var(--muted);
  margin-bottom: 8px;
}
.dockCardTimelineList{
  display:grid;
  gap: 8px;
}
.dockCardTimelineItem{
  display:grid;
  grid-template-columns: auto auto 1fr;
  align-items:center;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in oklab, var(--text) 86%, var(--muted));
}
.dockCardTimelineDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 70%, white);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent) 16%, transparent);
}
.dockCardTimelineItem[data-tone="done"] .dockCardTimelineDot{
  background: var(--success);
  box-shadow: 0 0 0 6px rgba(85, 227, 160, .14);
}
.dockCardTimelineItem[data-tone="cancel"] .dockCardTimelineDot{
  background: var(--danger);
  box-shadow: 0 0 0 6px rgba(255, 107, 125, .12);
}
.dockCardTimelineTime{
  min-width: 38px;
  font-weight: 800;
  color: var(--muted);
}
.dockCardTimelineLabel{
  font-weight: 700;
  color: var(--text);
}



/* Final Creative Conversation Polish */
.hiddenFileInput{display:none}
.messageAttachmentBlock{margin-top:0}
.messageBody{display:grid;gap:10px}
.messageBody--grouped{gap:8px}
.messageBody--session{gap:10px}
.messageBody--session.messageBody--grouped{gap:8px}
.messageEyebrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.messageEyebrow__tag{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:0 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:rgba(232,238,255,.82);font-size:10px;font-weight:800;letter-spacing:.14em}
.messageEyebrow__hint{color:var(--sub);font-size:11px;line-height:1.35}
.messageTextBlock{display:grid;gap:6px;color:inherit}
.messageTextBlock--session{gap:5px}
.messageSessionBlock{display:grid;gap:8px}
.messageSessionBlock--compact{gap:6px}
.messageSessionBlock--grouped{gap:5px}
.messageInlineMeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--sub)}
.messageInlineMeta--action{gap:6px;align-items:flex-start}
.messageInlineMeta__chip{display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:11px;font-weight:700;color:rgba(238,242,255,.84)}
.messageInlineMeta--action small{font-size:11px;line-height:1.45;color:rgba(255,236,196,.74)}
.messageInlineMeta--action .messageInlineMeta__chip{background:rgba(255,210,118,.12);border-color:rgba(255,210,118,.16);color:rgba(255,233,182,.92)}
.messageSessionBlock .sessionMessageCard{margin-top:0;padding:10px 12px;border-radius:16px;gap:8px;box-shadow:none}
.messageSessionBlock--compact .sessionMessageCard__head{gap:10px}
.messageSessionBlock--compact .sessionMessageCard__head strong{font-size:13px;line-height:1.34}
.messageSessionBlock--compact .sessionMessageCard__state{min-height:22px;padding:0 8px;font-size:10px}
.messageSessionBlock--compact .sessionMessageCard__meta{gap:6px;font-size:10.5px}
.messageSessionBlock--compact .sessionMessageCard__actions{gap:6px}
.messageSessionBlock--compact .sessionMessageCard__primary,.messageSessionBlock--compact .sessionMessageCard__ghost,.messageSessionBlock--compact .sessionMessageCard__link{min-height:30px;padding:0 10px;font-size:11px}
.messageSessionBlock--compact .sessionMessageCard__sync{font-size:10.5px;line-height:1.4}
.messageSessionBlock--compact .sessionMessageCard__notice{font-size:10.5px;line-height:1.45}
.messageSessionBlock--grouped .sessionMessageCard{padding:9px 11px;border-radius:15px}
.messageBodyTone--session .messageEyebrow__tag{background:rgba(122,140,255,.14);border-color:rgba(122,140,255,.2);color:rgba(223,228,255,.96)}
.messageBodyTone--action .messageEyebrow__tag{background:rgba(255,210,118,.12);border-color:rgba(255,210,118,.18);color:rgba(255,233,182,.92)}
.messageBodyTone--media .messageEyebrow__tag{background:rgba(122,255,216,.11);border-color:rgba(122,255,216,.16);color:rgba(204,255,241,.92)}
.messageBodyTone--focus .messageEyebrow__tag{background:rgba(138,156,255,.12);border-color:rgba(138,156,255,.18);color:rgba(228,234,255,.96)}
.page{
  position:relative;
  top:auto;left:auto;right:auto;bottom:auto;
  height:calc(100dvh - var(--app-header-h, 64px) - var(--app-bottombar-h, 72px));
  max-height:calc(100dvh - var(--app-header-h, 64px) - var(--app-bottombar-h, 72px));
  overflow:hidden;
  isolation:isolate;
}
.topbar,.dockWrap,.composerWrap,.capsulePanel{max-width:760px;margin-left:auto;margin-right:auto;width:100%}
.topbar{
  position:sticky;
  top:0;
  z-index:35;
  padding-top:10px;
  background:linear-gradient(180deg, rgba(4,8,18,.92), rgba(4,8,18,.78) 78%, rgba(4,8,18,0));
  backdrop-filter:blur(16px);
}
.scroller{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  padding:8px 14px calc(var(--composer-h, 152px) + env(safe-area-inset-bottom) + 28px);
  overscroll-behavior:contain;
}
.thread{max-width:760px;margin:0 auto}
.dockWrap{
  position:sticky;
  top:0;
  z-index:24;
  padding:4px 0 0;
}
.dockBar{
  gap:8px;
  padding:8px;
  border-radius:18px;
  backdrop-filter:blur(14px);
  background:color-mix(in oklab, var(--surface) 84%, transparent);
}
.dockMore{min-width:76px}
.dockPanel{
  margin-top:8px;
  max-height:min(30dvh,280px)!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  border-radius:18px;
}
.dockWrapSheet{z-index:40}
.dockSheetPortal{position:fixed;inset:0;z-index:var(--z-sheet);background:linear-gradient(180deg, rgba(5,8,18,.98), rgba(4,7,16,.98));}
.dockSheetBackdrop{
  position:fixed;
  inset:0;
  z-index:var(--z-sheet-backdrop);
  background:rgba(3,6,16,.18);
  backdrop-filter:blur(2px);
}
.dockPanelSheet{
  position:fixed !important;
  inset:max(8px, calc(env(safe-area-inset-top) + 8px)) max(8px, env(safe-area-inset-right)) max(8px, calc(env(safe-area-inset-bottom) + 8px)) max(8px, env(safe-area-inset-left));
  z-index:calc(var(--z-sheet) + 1);
  margin-top:0 !important;
  max-height:none !important;
  min-height:0;
  border-radius:28px;
  box-shadow:0 32px 96px rgba(0,0,0,.48);
  display:flex;
  flex-direction:column;
  overflow:hidden !important;
  background:linear-gradient(180deg, rgba(8,12,24,.995), rgba(7,11,22,.985));
}
.dockSheetHead{
  position:sticky;
  top:0;
  z-index:4;
  display:grid;
  grid-template-columns:1fr auto;
  gap:10px;
  align-items:center;
  padding:12px 14px;
  margin:0 0 12px;
  border-bottom:1px solid color-mix(in oklab, var(--border) 74%, transparent);
  background:linear-gradient(180deg, rgba(9,13,26,.98), rgba(9,13,26,.94));
  backdrop-filter:blur(14px);
}
.dockSheetGrab{
  grid-column:1 / -1;
  width:52px;
  height:5px;
  border-radius:999px;
  margin:0 auto 2px;
  background:rgba(255,255,255,.18);
}
.dockSheetMeta{min-width:0}
.dockSheetTitle{font-size:14px;font-weight:900;color:var(--text)}
.dockSheetSub{margin-top:3px;font-size:12px;color:var(--muted);line-height:1.35}
.dockSheetClose{
  height:34px;
  padding:0 12px;
  border-radius:999px;
  border:1px solid color-mix(in oklab, var(--border) 78%, transparent);
  background:rgba(255,255,255,.05);
  color:var(--text);
  font-size:12px;
  font-weight:900;
}
.dockRow{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}
.composerWrap{
  position:sticky;
  bottom:0;
  z-index:60;
  padding:10px 14px calc(14px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg, rgba(4,8,18,0), rgba(4,8,18,.82) 18%, rgba(4,8,18,.96) 100%);
  border-top:1px solid color-mix(in oklab, var(--border) 82%, transparent);
  box-shadow:0 -18px 40px rgba(0,0,0,.18);
}
.composerInner--stack{display:grid;gap:8px}
.composerRow{
  display:grid;
  grid-template-columns:auto auto minmax(0,1fr) auto;
  gap:8px;
  align-items:center;
  padding:8px;
  border-radius:20px;
  border:1px solid color-mix(in oklab,var(--border) 82%, transparent);
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.02));
  box-shadow:0 10px 24px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.03);
}
.input{min-width:0;height:46px;border-radius:16px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 92%, transparent)}
.miniBtn{width:40px;height:40px;border-radius:14px;border:1px solid color-mix(in oklab,var(--border) 82%, transparent);background:color-mix(in oklab,var(--surface) 92%, transparent);color:var(--text);font-size:16px;font-weight:900}
.composerHint{font-size:11px;line-height:1.35;color:var(--muted);padding:0 4px}
.uploadState,.uploadError{font-size:12px;font-weight:800}
.uploadError{color:color-mix(in oklab,var(--danger) 80%, white)}
.timelineRecentShare{
  flex:0 0 auto;
  height:32px;
  padding:0 12px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.92);
  font-size:12px;
  font-weight:800;
}
.timelineRecentShare:hover{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.08)}
.dockPanelSheet .dockGrid{
  flex:1;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  padding:0 12px calc(156px + env(safe-area-inset-bottom));
}
.dockPanelSheet .dockFilterBar{
  position:sticky;
  top:0;
  z-index:3;
  padding:4px 0 12px;
  background:linear-gradient(180deg, rgba(8,12,24,1), rgba(8,12,24,.96) 72%, rgba(8,12,24,0));
}
.dockPanelSheet .dockEmpty{margin:12px 0 0}
@media (max-width:900px){.dockRow{grid-template-columns:1fr!important}}

.conversationSearchRail{margin:10px 12px 4px;padding:16px 18px;border-radius:22px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(18,22,38,.92),rgba(10,13,24,.9));display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,1fr);gap:16px;align-items:center}
.conversationSearchRail__copy{display:grid;gap:6px}.conversationSearchRail__eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(145,170,255,.78)}.conversationSearchRail__copy strong{font-size:18px}.conversationSearchRail__copy p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.6}.conversationSearchRail__controls{display:grid;gap:10px}.conversationSearchRail__inputWrap{display:flex;gap:8px}.conversationSearchRail__input{flex:1;min-height:46px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;padding:0 14px;outline:none}.conversationSearchRail__input:focus{border-color:rgba(126,154,255,.48);box-shadow:0 0 0 4px rgba(126,154,255,.14)}.conversationSearchRail__submit{min-width:84px;border:none;border-radius:16px;background:linear-gradient(135deg,#6e85ff,#8c6bff);color:#fff;font-weight:900;padding:0 16px}.conversationSearchRail__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.conversationSearchRail__summary{font-size:12px;color:rgba(255,255,255,.62)}.conversationSearchRail__actions{display:flex;gap:8px;flex-wrap:wrap}.conversationSearchRail__chip{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#fff;font-size:12px;font-weight:800}

@media (max-width:720px){
  .page{height:calc(100dvh - var(--app-header-h, 64px) - var(--app-bottombar-h, 64px));max-height:calc(100dvh - var(--app-header-h, 64px) - var(--app-bottombar-h, 64px))}
  .topbar,.dockWrap,.composerWrap,.capsulePanel,.thread{max-width:none}
  .topbar{grid-template-columns:auto 1fr;gap:8px;padding-left:12px;padding-right:12px}
  .right{grid-column:1 / -1;justify-content:flex-start}
  .dockBar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center}
  .dockBarSheet{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center}

  .dockWrap{top:44px;padding:4px 8px 0;}
  .dockBar{min-height:38px;padding:0;}
  .dockTab{min-height:38px;padding:0 10px;border-radius:12px;font-size:13px;}
  .dockCount{min-width:18px;height:18px;font-size:11px;}
  .dockMore{border-radius:12px;font-size:12px;}
  .dockFilterBar{display:flex;gap:6px;padding:2px 0 8px;overflow-x:auto;grid-template-columns:none;}
  .dockPill{flex:0 0 auto;min-height:34px;padding:0 12px;border-radius:999px;font-size:12px;}
  .dockSpacer{display:none}
  .dockMore{grid-column:auto;width:auto;min-height:36px;justify-self:end;padding-inline:12px}
  .dockPanel{max-height:min(18dvh,132px)!important}
  .dockSheetBackdrop{display:none;}
  .dockPanelSheet{
    inset:0 !important;
    max-height:none !important;
    min-height:100dvh;
    border-radius:0;
    box-shadow:none;
    padding-bottom:0;
  }
  .dockSheetHead{
    padding:calc(10px + env(safe-area-inset-top)) 14px 12px;
    border-radius:0;
    background:linear-gradient(180deg, rgba(6,10,20,1), rgba(6,10,20,.96));
  }
  .dockTimelineHero, .timelineRecent{display:none !important;}
  .dockPanelSheet .dockGrid{padding:0 12px calc(28px + env(safe-area-inset-bottom));}
  .dockPanelSheet .dockFilterBar{top:0;padding-bottom:10px;}
  .dockCard{scroll-margin-top:92px;padding-bottom:12px;}
  .dockCard.searchHit{border-color:rgba(126,154,255,.54);box-shadow:0 0 0 1px rgba(126,154,255,.28),0 0 0 8px rgba(126,154,255,.10);}
  .dockCardActions{position:static;z-index:auto;padding-top:0;background:none;margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
  .dockShareBtn{margin-top:10px;height:42px;position:static;}
  .scroller{padding-left:12px;padding-right:12px;padding-bottom:calc(var(--composer-h, 148px) + env(safe-area-inset-bottom) + 20px)}
  .composerWrap{padding:8px 12px calc(10px + env(safe-area-inset-bottom))}
  .conversationSearchRail{grid-template-columns:1fr;margin:10px 12px 2px;padding:14px}
  .conversationSearchRail__inputWrap{flex-direction:column}
  .conversationSearchRail__submit{width:100%;min-height:42px}
}


.conversationSearchRail{display:grid;gap:12px;padding:14px 16px;border-radius:24px;background:linear-gradient(180deg,rgba(11,16,30,.94),rgba(7,11,22,.88));border:1px solid rgba(255,255,255,.08)}
.conversationSearchRail.compact{padding:10px 12px;border-radius:18px;gap:8px}
.conversationSearchRail__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.conversationSearchRail__copy{display:grid;gap:4px;min-width:0}
.conversationSearchRail__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}
.conversationSearchRail__copy strong{font-size:18px;line-height:1.2}
.conversationSearchRail.compact .conversationSearchRail__copy strong{font-size:15px}
.conversationSearchRail__copy p{margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,.72)}
.conversationSearchRail__controls{display:grid;gap:10px}
.conversationSearchRail__inputWrap{display:flex;gap:10px}
.conversationSearchRail__input{flex:1;min-height:48px;border-radius:18px;border:1px solid rgba(255,255,255,.10);background:rgba(9,13,24,.82);color:#fff;padding:0 14px;outline:none}
.conversationSearchRail__submit{min-width:96px;min-height:48px;border-radius:18px;border:0;background:linear-gradient(135deg,#7a8cff,#8e66ff);color:#fff;font-weight:900}
.conversationSearchRail__meta{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.conversationSearchRail__summary{font-size:12px;color:rgba(255,255,255,.62)}
.conversationSearchRail__focusPill{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(255,220,120,.12);border:1px solid rgba(255,220,120,.18);font-size:11px;font-weight:800;color:rgba(255,236,170,.96)}
.conversationSearchRail__actions,.conversationSearchRail__topActions{display:flex;gap:8px;flex-wrap:wrap}
.conversationSearchRail__chip{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#fff;font-size:12px;font-weight:800}
.conversationSearchRail__chip--ghost{background:transparent}
.searchReturnBar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 12px;padding:12px 14px;border-radius:20px;border:1px solid rgba(122,140,255,.22);background:rgba(79,101,255,.10)}
.searchReturnBar__copy{display:grid;gap:4px}
.searchReturnBar__eyebrow{font-size:11px;font-weight:900;letter-spacing:.1em;color:rgba(145,170,255,.82);text-transform:uppercase}
.searchReturnBar__copy p{margin:0;font-size:12px;color:rgba(255,255,255,.72)}
.searchReturnBar__actions{display:flex;gap:8px;flex-wrap:wrap}
.messageSearchHitBadge{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:0 8px;margin-bottom:8px;border-radius:999px;background:rgba(122,140,255,.18);border:1px solid rgba(122,140,255,.28);color:#dfe5ff;font-size:11px;font-weight:900;letter-spacing:.02em}
.conversationSearchRail__chip--accent{background:rgba(122,140,255,.22);border-color:rgba(122,140,255,.34)}
.msg--searchFocus .bubble{box-shadow:0 0 0 1px rgba(122,140,255,.42),0 0 0 8px rgba(122,140,255,.12)}
.msgSearchMark{padding:0 .18em;border-radius:.42em;background:rgba(255,220,120,.88);color:#1f1605}

.dockCardTitleRow{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dockSearchBadge,.searchReturnBar__chipPill{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;background:rgba(255,214,102,.14);border:1px solid rgba(255,214,102,.26);font-size:11px;font-weight:900;color:#ffd666;white-space:nowrap}
.searchReturnBar__chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}


.sessionHub{display:grid;gap:12px;margin:0 0 14px;padding:14px 16px;border-radius:24px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(11,16,30,.94),rgba(7,11,22,.88))}
.sessionHub__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionHub__head p{margin:4px 0 0;font-size:12px;line-height:1.55;color:rgba(255,255,255,.68)}.sessionHub__eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(145,170,255,.82)}.sessionHub__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.sessionHub__compactList{display:grid;gap:10px}.sessionHub__empty{padding:12px 0;font-size:13px;color:rgba(255,255,255,.68)}

.searchAnchorPulse{animation:searchAnchorPulse 1.8s ease}
@keyframes searchAnchorPulse{0%{box-shadow:0 0 0 0 rgba(122,140,255,.42)}70%{box-shadow:0 0 0 12px rgba(122,140,255,0)}100%{box-shadow:0 0 0 0 rgba(122,140,255,0)}}
@media (max-width:720px){
  .conversationSearchRail{gap:10px}
  .conversationSearchRail__copy strong{font-size:16px}
  .conversationSearchRail__inputWrap{flex-direction:column}
  .conversationSearchRail__submit{width:100%}
  .searchReturnBar{display:grid}
  .messageSearchHitBadge{margin-bottom:6px}
  .searchReturnBar__actions{width:100%}
}


.sessionHub__stack{display:grid;gap:16px}.sessionHub__section{display:grid;gap:10px}.sessionHub__section--featured{padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.06)}.sessionHub__sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sessionHub__sectionHead strong{font-size:14px}.sessionHub__sectionHead span{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:11px;font-weight:800;color:rgba(255,255,255,.72)}.sessionHub__historyActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sessionHub__sectionCopy{margin:4px 0 0;font-size:12px;line-height:1.5;color:rgba(255,255,255,.62)}



.messageOrbitBar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;margin-top:8px;border-radius:16px;background:linear-gradient(180deg,rgba(10,14,34,.84),rgba(8,11,24,.78));border:1px solid rgba(122,140,255,.10)}
.messageOrbitBar__lens,.messageOrbitBar__chip,.messageStagePanel__mode,.messageStagePanel__filter,.messageSpotlight__jump{border:none;cursor:pointer;font:inherit}
.messageOrbitBar__lens{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 16px;border-radius:999px;background:linear-gradient(135deg,rgba(124,92,255,.92),rgba(89,149,255,.86));color:#fff;font-weight:900;box-shadow:0 14px 28px rgba(70,53,146,.24)}
.messageOrbitBar__lensBadge{display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.18);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.messageOrbitBar__chips{display:flex;flex-wrap:wrap;gap:6px}
.messageOrbitBar__chip{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.82);font-weight:800;border:1px solid rgba(255,255,255,.06);font-size:12px}
.messageOrbitBar__chip small{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.66)}
.messageOrbitBar__chip.on{background:rgba(122,140,255,.18);border-color:rgba(122,140,255,.32);color:#fff}
.messageOrbitBar__chip--accent{background:rgba(122,140,255,.18);border-color:rgba(122,140,255,.32)}
.messageOrbitBar__sessionPill{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);cursor:pointer;max-width:220px;color:#fff}
.messageOrbitBar__sessionPill strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.messageOrbitBar__floatingTag{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:24px;padding:0 8px;border-radius:999px;background:rgba(122,140,255,.18);color:#fff;font-size:11px;font-weight:900}
.messageStageRailSlim{display:grid;gap:8px;padding:8px 10px;margin:4px 0 10px;border-radius:16px;background:linear-gradient(180deg,rgba(8,11,25,.62),rgba(8,10,20,.44));border:1px solid rgba(122,140,255,.08);position:relative;z-index:2;backdrop-filter:blur(8px);overflow:hidden}
.messageStageRailSlim__main{display:flex;align-items:center;justify-content:space-between;gap:10px}
.messageStageRailSlim__eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(164,177,255,.68);font-weight:800}
.messageStageRailSlim__copy strong{display:block;font-size:13px;line-height:1.3;color:#fff}
.messageStageRailSlim__actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.messageStageRailSlim__pill{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#eef3ff;font-weight:800;font-size:12px}
.messageStageRailSlim__pill.on{background:rgba(122,140,255,.18);border-color:rgba(122,140,255,.34)}
.messageStageRailSlim__lane{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
.messageStageRailSlim__lane--minimal{grid-template-columns:minmax(0,1fr) auto}
.messageStageRailSlim__stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.messageStageRailSlim__stat{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);font-size:11px;font-weight:800;color:rgba(236,241,255,.76)}
.messageStageRailSlim__focus{display:grid;gap:4px;min-width:0;padding:12px 14px;border-radius:16px;border:1px solid rgba(122,140,255,.16);background:linear-gradient(180deg,rgba(16,21,39,.96),rgba(9,13,26,.92));color:#fff;text-align:left}
.messageStageRailSlim__focusTag,.messageStageRailSlim__stackTag{display:inline-flex;align-items:center;justify-content:center;width:max-content;min-width:58px;height:20px;padding:0 8px;border-radius:999px;background:rgba(122,140,255,.16);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#edf1ff}
.messageStageRailSlim__focus strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.messageStageRailSlim__stack{position:relative;min-width:118px;height:62px;padding-right:74px}
.messageStageRailSlim__stackCard{position:absolute;top:0;right:var(--stack-shift);display:grid;gap:4px;width:112px;padding:8px 10px;border-radius:14px;border:1px solid rgba(122,140,255,.14);background:linear-gradient(180deg,rgba(18,24,45,.96),rgba(10,15,29,.94));transform:translateX(calc(var(--stack-shift) * -1)) scale(var(--stack-scale));transform-origin:right center;color:#fff;text-align:left;box-shadow:0 12px 24px rgba(4,7,17,.18)}
.messageStageRailSlim__stackCard strong{font-size:12px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.messageStagePanel.compact{padding:10px 12px}
.messageStagePanel.expanded{padding:12px 14px 14px}
.messageStagePanel__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.messageStagePanel__eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(164,177,255,.7);font-weight:800}
.messageStagePanel__head strong{display:block;font-size:16px;line-height:1.3}
.messageStagePanel__head p{margin:4px 0 0;color:rgba(226,232,255,.68);font-size:12px;line-height:1.45}
.messageStagePanel__actions{display:flex;gap:8px}
.messageStagePanel__mode{min-height:32px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.75);font-weight:800;border:1px solid rgba(255,255,255,.06)}
.messageStagePanel__mode.on{background:rgba(122,140,255,.18);border-color:rgba(122,140,255,.34);color:#fff}
.messageStagePanel__mode--primary{background:linear-gradient(135deg,rgba(124,92,255,.74),rgba(89,149,255,.68));border-color:rgba(132,150,255,.3);color:#fff}
.messageStagePanel__filters{display:flex;flex-wrap:wrap;gap:8px}
.messageStagePanel__filter{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.03);color:rgba(255,255,255,.72);font-weight:800;border:1px solid rgba(255,255,255,.05)}
.messageStagePanel__filter small{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.66)}
.messageStagePanel__filter.on{background:rgba(122,140,255,.16);border-color:rgba(122,140,255,.3);color:#fff}
.messageSpotlight{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(122,140,255,.14),rgba(68,92,180,.08));border:1px solid rgba(122,140,255,.18);cursor:pointer}
.messageSpotlight__label{display:inline-flex;align-items:center;justify-content:center;min-width:62px;height:30px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.76)}
.messageSpotlight__body strong{display:block;font-size:14px;line-height:1.3}
.messageSpotlight__body p{margin:4px 0 0;color:rgba(226,232,255,.68);font-size:12px;line-height:1.45}
.messageSpotlight__jump{min-height:36px;padding:0 12px;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-weight:900}
.messageStageRail{display:flex;align-items:center;justify-content:space-between;gap:12px}
.messageStageRail__copy{display:grid;gap:2px;min-width:0}
.messageStageRail__eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(164,177,255,.72);font-weight:800}
.messageStageRail__copy strong{font-size:14px;line-height:1.28}
.messageStageRail__copy p{margin:0;color:rgba(226,232,255,.58);font-size:11px;line-height:1.4}
.messageStageRail__actions{display:flex;gap:8px;flex-wrap:wrap}
.messageStageLane{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,340px);gap:12px;align-items:center}
.messageStageLane__filters{display:flex;gap:8px;flex-wrap:wrap;min-width:0}
.messageStageLane__stack{position:relative;display:flex;justify-content:flex-end;align-items:center;min-height:72px;padding-right:6px}
.messageStageLane__card{position:absolute;right:var(--lane-shift);display:grid;gap:6px;min-width:160px;max-width:220px;padding:11px 13px;border-radius:18px;border:1px solid rgba(122,140,255,.14);background:linear-gradient(180deg,rgba(17,23,45,.95),rgba(11,16,33,.9));box-shadow:0 14px 28px rgba(5,8,18,.22);transform:translateY(calc(var(--lane-shift) * .03)) scale(var(--lane-scale));text-align:left;color:#fff}
.messageStageLane__tag{display:inline-flex;align-items:center;justify-content:center;min-width:62px;height:22px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.08);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(235,239,255,.82)}
.messageStageLane__card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.35}
.messageStagePeek{display:flex;gap:8px;flex-wrap:wrap}
.messageStagePeek__pill{display:inline-flex;align-items:center;gap:8px;min-height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);color:rgba(255,255,255,.72);font-weight:800}
.messageStagePeek__pill small{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.66)}
.messageStagePeek__pill.on{background:rgba(122,140,255,.18);border-color:rgba(122,140,255,.3);color:#fff}
.messageStageDeck{display:grid;gap:12px;padding-top:6px;border-top:1px solid rgba(122,140,255,.08)}
.messageStageDeck__top{display:grid;gap:12px}
.messageSpotlight--compact{grid-template-columns:auto 1fr auto}
.messageStageStackWrap{display:grid;gap:10px}
.messageStageStackHeader{display:flex;align-items:center;justify-content:space-between;gap:10px;color:rgba(226,232,255,.74);font-size:12px}
.messageStageStackHeader strong{font-size:13px;color:#fff}
.messageStageStack{position:relative;min-height:182px;padding:6px 0 8px}
.messageStageStack--fan{padding:12px 8px 14px}
.messageStageStack__card{position:absolute;left:0;right:0;top:var(--stack-offset);display:grid;gap:8px;padding:14px 16px;border-radius:22px;border:1px solid rgba(122,140,255,.14);background:linear-gradient(180deg,rgba(17,23,45,.96),rgba(11,16,33,.92));box-shadow:0 18px 40px rgba(5,8,18,.24);transform:scale(var(--stack-scale));transform-origin:top center;text-align:left;color:#fff}
.messageStageStack__card--fan{left:12px;right:12px;transform:translateX(calc(var(--stack-offset) * .18)) rotate(var(--stack-rotate,0deg)) scale(var(--stack-scale));transform-origin:center top}
.messageStageStack__tag{display:inline-flex;align-items:center;justify-content:center;min-width:74px;height:24px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(235,239,255,.82)}
.messageStageStack__card strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.4}
.messageStageStack__card small{color:rgba(226,232,255,.66);font-size:12px;line-height:1.4}

.msg--session .bubble{border-color:rgba(122,140,255,.2);background:linear-gradient(180deg,rgba(24,31,56,.94),rgba(12,16,32,.92));box-shadow:0 10px 22px rgba(16,21,40,.18)}
.msg--action .bubble{border-color:rgba(255,210,118,.14);box-shadow:0 6px 16px rgba(32,24,8,.12)}
.msg--media .bubble{border-color:rgba(122,255,216,.12)}
.msg--session.depthFocused .bubble{box-shadow:0 14px 26px rgba(18,24,52,.22),0 0 0 1px rgba(132,150,255,.14)}
.msgTone--plain .bubble,.bubbleTone--plain{background:linear-gradient(180deg,rgba(18,22,38,.94),rgba(10,13,24,.94))}
.msgTone--focus .bubble,.bubbleTone--focus{border-color:rgba(138,156,255,.2);box-shadow:0 12px 24px rgba(16,21,40,.16),0 0 0 1px rgba(126,144,255,.1)}
.msgTone--session .bubble,.bubbleTone--session{border-color:rgba(122,140,255,.2);background:linear-gradient(180deg,rgba(22,28,52,.95),rgba(12,16,32,.93));box-shadow:0 8px 18px rgba(16,21,40,.16)}
.msg--session .bubble{max-width:78%;padding:9px 12px 10px;border-radius:20px}
.msg--action .bubble{max-width:72%;padding:8px 11px 9px;border-radius:18px}
.msg--plain .bubble,.msg--focus .bubble{max-width:72%}
.msgTone--action .bubble,.bubbleTone--action{border-color:rgba(255,210,118,.13);background:linear-gradient(180deg,rgba(30,26,18,.88),rgba(16,14,10,.9));box-shadow:0 6px 14px rgba(32,24,8,.1)}
.msgTone--media .bubble,.bubbleTone--media{border-color:rgba(122,255,216,.13);background:linear-gradient(180deg,rgba(13,28,31,.9),rgba(10,18,21,.92))}

.msg.stageMuted{opacity:.78;transform:none}
.msg.stageMuted .bubble{filter:saturate(.92)}
@media (max-width:720px){
.messageOrbitBar{top:6px;flex-wrap:wrap}
.messageOrbitBar__chips{width:100%;order:3}
.messageOrbitBar__sessionPill{width:100%;max-width:none;justify-content:space-between}
.messageStageRailSlim__main{align-items:flex-start;flex-direction:column}
.messageStageRailSlim__actions{width:100%;justify-content:flex-start}
.messageStageRailSlim__pill{flex:0 0 auto}
.messageStageRailSlim__lane{grid-template-columns:1fr;gap:10px}
.messageStageRailSlim__focus{width:100%}
.messageStageRailSlim__stack{display:flex;align-items:stretch;gap:8px;position:static;min-width:0;height:auto;padding-right:0;overflow-x:auto;scrollbar-width:none}
.messageStageRailSlim__stack::-webkit-scrollbar{display:none}
.messageStageRailSlim__stackCard{position:relative;top:auto;right:auto;transform:none !important;transform-origin:center center;flex:0 0 168px;width:168px;min-height:74px;padding:10px 12px}
.msg.stageMuted{opacity:.96}
}
.messageDepthHero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:20px;background:linear-gradient(135deg,rgba(92,111,255,.16),rgba(28,34,64,.74));border:1px solid rgba(122,140,255,.22)}
.messageDepthHero__eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(190,202,255,.8)}
.messageDepthHero strong{display:block;font-size:14px}
.messageDepthHero p{margin:4px 0 0;font-size:12px;line-height:1.45;color:rgba(231,236,255,.7)}
.messageDepthHero__actions{display:flex;flex-wrap:wrap;gap:8px}
.msg.depthOn{transform:translate3d(0,var(--depth-y,0),var(--depth-z,0)) scale(var(--depth-scale,1));opacity:var(--depth-opacity,1);filter:blur(var(--depth-blur,0));transition:transform .18s ease, opacity .18s ease, filter .18s ease, box-shadow .18s ease;transform-origin:center center;will-change:transform,opacity,filter;position:relative;margin-top:calc(var(--depth-overlap,0px) * -1.0)}
.msg.depthOn::after{content:"";position:absolute;inset:auto 18px -3px;height:8px;border-radius:999px;background:radial-gradient(circle at center,rgba(77,92,179,.12),transparent 72%);opacity:calc(var(--depth-opacity,1) * .2);pointer-events:none;filter:blur(6px)}
.msg.depthFocused{z-index:2;filter:none !important;opacity:1 !important}
.msg.depthFocused .bubble{box-shadow:0 12px 24px rgba(5,8,18,.18),0 0 0 1px rgba(132,150,255,.12)}
.msg.depthRank--near-prev,.msg.depthRank--near-next{z-index:2}
.msg.depthRank--mid-prev,.msg.depthRank--mid-next{z-index:1}
.msg.depthRank--far-prev,.msg.depthRank--far-next{pointer-events:none}
.depthSpotPulse{animation:depthSpotPulse 1.2s ease}
@keyframes depthSpotPulse{0%{box-shadow:0 0 0 0 rgba(122,140,255,.38)}100%{box-shadow:0 0 0 16px rgba(122,140,255,0)}}
@media (max-width:720px){.messageDepthHero{align-items:flex-start;flex-direction:column}.messageDepthHero__actions{width:100%}.messageDepthHero__actions .messageStagePanel__filter{flex:1 1 calc(50% - 4px);justify-content:center}.msg.depthOn{transform:translate3d(0,calc(var(--depth-y,0) * .55),var(--depth-z,0)) scale(calc(.98 + (var(--depth-scale,1) - .98) * .7))}}

.composerUtilityBar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.composerUtilityBar--compact{justify-content:flex-start}.composerUtilityBar__pill{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;max-width:100%;min-height:38px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);cursor:pointer}.composerUtilityBar__pillTag{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:22px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.08);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff}.composerUtilityBar__pill strong{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}.composerUtilityBar__pill--lens{background:linear-gradient(135deg,rgba(121,96,255,.26),rgba(79,156,255,.2));border-color:rgba(132,150,255,.24)}.composerUtilityBar__pill--active{background:rgba(122,140,255,.12);border-color:rgba(122,140,255,.24)}.composerUtilityBar__pill--session{background:rgba(255,255,255,.05)}.composerUtilityBar__pill--ghost{background:transparent;border-style:dashed}
.lensLauncher{display:none}
.messageStageSheetTabs{display:flex;flex-wrap:wrap;gap:8px}
.messageStageSheetTabs__tab{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.05);color:rgba(236,241,255,.78);border:1px solid rgba(255,255,255,.08);font-weight:800}
.messageStageSheetTabs__tab.on{background:rgba(122,140,255,.2);border-color:rgba(122,140,255,.34);color:#fff}
.messageStageSheetBody{display:grid;gap:10px}
.messageStageSheetCard{appearance:none;-webkit-appearance:none;display:grid;gap:6px;padding:14px 15px;border-radius:18px;border:1px solid rgba(122,140,255,.14);background:linear-gradient(180deg,rgba(18,24,45,.96),rgba(10,15,29,.94));text-align:left;color:#fff}
.messageStageSheetCard__tag{display:inline-flex;align-items:center;justify-content:center;width:max-content;min-width:58px;height:22px;padding:0 8px;border-radius:999px;background:rgba(122,140,255,.16);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.messageStageSheetCard strong{font-size:14px;line-height:1.35}
.messageStageSheetCard p{margin:0;font-size:12px;line-height:1.5;color:rgba(226,232,255,.68)}
.messageStageSheetEmpty{padding:16px;border-radius:18px;border:1px dashed rgba(255,255,255,.12);font-size:12px;color:rgba(226,232,255,.62)}
@media (max-width: 768px){
  .composerUtilityBar{align-items:stretch}
  .lensLauncher{width:100%}
  .lensLauncher__menu{left:0;right:auto;min-width:min(86vw,320px)}
  .composerUtilityBar__pill{width:auto}
}



/* =========================
   vNext: message shell rhythm tune
   ========================= */
.msg{
  --msg-gap: 9px;
  --msg-meta-gap: 5px;
}
.msg--plain{ --msg-gap: 9px; }
.msg--action,
.msg--media{ --msg-gap: 8px; }
.msg--session{ --msg-gap: 7px; --msg-meta-gap: 4px; }
.msg + .msg{ margin-top: var(--msg-gap); }
.msg--session + .msg:not(.msg--session){ margin-top: 8px; }
.msg:not(.msg--session) + .msg--session{ margin-top: 10px; }

.messageFooter{
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
}

.messageMetaRow{
  gap: 6px;
  margin-top: var(--msg-meta-gap, 5px);
  padding-inline: 2px;
  min-height: 14px;
}

.candidates{
  margin-top: 8px;
  gap: 6px;
}

.bottomSpacer{
  height: 8px;
}

.msgMenuTrigger{
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
}

.hoverActions{
  top: 10px;
  right: 38px;
  gap: 5px;
}

.haBtn{
  height: 26px;
  padding: 0 8px;
  gap: 5px;
}

.haBtn__label{
  font-size: 10.5px;
}

.messageToolSummary{
  margin-top: 8px;
  gap: 6px;
}

.messageToolSummary small{
  min-height: 20px;
  padding: 0 7px;
  font-size: 11px;
}

.msg--action .messageToolSummary{
  margin-top: 6px;
}

.messageFooter + .messageMetaRow{
  margin-top: 4px;
}

.dockWrap{
  padding: 8px 12px 0;
}

.dockBar{
  gap: 6px;
  border-radius: 14px;
  padding: 7px;
}

.dockTab{
  gap: 6px;
  padding: 7px 9px;
  border-radius: 12px;
}

.dockPanel{
  margin: 8px auto 0;
  border-radius: 16px;
  padding: 8px;
}

.dockGrid{
  gap: 8px;
}

.dockFilterBar{
  gap: 6px;
  padding: 8px 8px 4px;
}

.dockPill{
  gap: 5px;
  padding: 6px 9px;
}

.dockListInline,
.dockSuggestList{
  gap: 8px;
}

.dockSuggestList{
  padding: 8px;
}

.dockRowWrap{
  gap: 8px;
}

.dockRow{
  gap: 8px;
  padding-bottom: 4px;
}

.dockCard{
  border-radius: 14px;
  padding: 9px;
}

.dockCardHint{
  margin-top: 4px;
}

.dockSlot{
  display: grid;
  align-content: start;
}

.dockSlot .wrap[data-compact="true"]{
  margin-top: 0;
}

@media (max-width: 720px){
  .hoverActions{
    right: 34px;
  }

  .dockWrap{
    padding-top: 6px;
  }

  .dockBar{
    padding: 6px;
  }

  .dockPanel{
    padding: 7px;
  }

  .dockSuggestList{
    padding: 6px;
  }
}



/* =========================
   vNext: bubble proportion tune
   ========================= */
.msg{
  --bubble-max: 71%;
  --bubble-pad-y: 8px;
  --bubble-pad-x: 12px;
  --bubble-radius: 18px;
}

.msg .bubble{
  max-width: var(--bubble-max);
  padding: var(--bubble-pad-y) var(--bubble-pad-x) calc(var(--bubble-pad-y) + 1px);
  border-radius: var(--bubble-radius);
}

.msg--plain,
.msg--focus{
  --bubble-max: 70%;
  --bubble-pad-y: 8px;
  --bubble-pad-x: 12px;
  --bubble-radius: 18px;
}

.msg--action,
.msg--media{
  --bubble-max: 68%;
  --bubble-pad-y: 7px;
  --bubble-pad-x: 11px;
  --bubble-radius: 17px;
}

.msg--session{
  --bubble-max: 74%;
  --bubble-pad-y: 8px;
  --bubble-pad-x: 11px;
  --bubble-radius: 19px;
}

.messageBody{
  gap: 9px;
}
.messageBody--grouped{
  gap: 7px;
}
.messageBody--session{
  gap: 9px;
}
.messageBody--session.messageBody--grouped{
  gap: 7px;
}

.messageEyebrow{
  gap: 6px;
}

.messageEyebrow__tag{
  min-height: 20px;
  padding: 0 8px;
  font-size: 9.5px;
  letter-spacing: .12em;
}

.messageEyebrow__hint{
  font-size: 10.5px;
}

.messageTextBlock{
  gap: 5px;
}

.messageInlineMeta{
  gap: 6px;
}

.messageInlineMeta__chip{
  min-height: 22px;
  padding: 0 9px;
  font-size: 10.5px;
}

.messageSessionBlock{
  gap: 7px;
}

.messageSessionBlock .sessionMessageCard{
  padding: 9px 11px;
  border-radius: 15px;
}

.messageSessionBlock--compact .sessionMessageCard__head{
  gap: 8px;
}

.messageSessionBlock--compact .sessionMessageCard__head strong{
  font-size: 12.5px;
}

.messageSessionBlock--compact .sessionMessageCard__meta{
  gap: 5px;
  font-size: 10px;
}

.messageSessionBlock--compact .sessionMessageCard__actions{
  gap: 5px;
}

.messageSessionBlock--compact .sessionMessageCard__primary,
.messageSessionBlock--compact .sessionMessageCard__ghost,
.messageSessionBlock--compact .sessionMessageCard__link{
  min-height: 28px;
  padding: 0 9px;
  font-size: 10.5px;
}

.msg--plain .messageToolSummary,
.msg--focus .messageToolSummary{
  margin-top: 7px;
}

.msg--session .messageToolSummary,
.msg--action .messageToolSummary,
.msg--media .messageToolSummary{
  margin-top: 6px;
}

@media (max-width: 720px){
  .msg{
    --bubble-max: 82%;
  }

  .msg--plain,
  .msg--focus{
    --bubble-max: 81%;
  }

  .msg--action,
  .msg--media{
    --bubble-max: 79%;
  }

  .msg--session{
    --bubble-max: 84%;
  }

  .msg .bubble{
    padding: 8px 11px 9px;
  }
}



/* =========================
   vNext: grouped message rhythm tune
   ========================= */
.msg{
  --group-gap: 5px;
  --type-shift-gap: 11px;
  --author-break-gap: 13px;
}

.msg + .msg{
  margin-top: var(--msg-gap, 9px);
}

.msg.msg--grouped{
  margin-top: var(--group-gap);
}

.msg.msg--grouped .bubble{
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
}

.msg.mine.msg--grouped .bubble{
  border-bottom-right-radius: 14px;
}

.msg:not(.mine).msg--grouped .bubble{
  border-bottom-left-radius: 14px;
}

.msg.msg--grouped .messageMetaRow{
  margin-top: 4px;
}

.msg + .msg:not(.msg--grouped){
  margin-top: max(var(--msg-gap, 9px), 9px);
}

.msg--plain + .msg--session,
.msg--plain + .msg--action,
.msg--plain + .msg--media,
.msg--focus + .msg--session,
.msg--focus + .msg--action,
.msg--focus + .msg--media{
  margin-top: var(--type-shift-gap);
}

.msg--session + .msg--plain,
.msg--session + .msg--focus,
.msg--action + .msg--plain,
.msg--action + .msg--focus,
.msg--media + .msg--plain,
.msg--media + .msg--focus{
  margin-top: calc(var(--type-shift-gap) - 1px);
}

.msg + .msg .avatar{
  transition: opacity .18s ease, transform .18s ease;
}

.msg.msg--grouped + .msg.msg--grouped .avatar,
.msg.msg--grouped .author{
  opacity: .88;
}

.msg:not(.msg--grouped) .author{
  margin-bottom: 5px;
}

.msg.msg--grouped .messageBody--grouped{
  padding-top: 1px;
}

.msg.msg--grouped .messageToolSummary{
  margin-top: 6px;
}

.msg.msg--grouped .candidates{
  margin-top: 7px;
}

.msg--session.msg--grouped .messageSessionBlock{
  gap: 6px;
}

.msg--action.msg--grouped .messageInlineMeta{
  gap: 5px;
}

.msg--grouped + .msg:not(.msg--grouped){
  margin-top: var(--author-break-gap);
}

.msg:not(.msg--grouped) + .msg.msg--grouped{
  margin-top: 6px;
}

.msg--session + .msg--session.msg--grouped,
.msg--action + .msg--action.msg--grouped,
.msg--media + .msg--media.msg--grouped{
  margin-top: 6px;
}

.msg--session + .msg--session:not(.msg--grouped),
.msg--action + .msg--action:not(.msg--grouped),
.msg--media + .msg--media:not(.msg--grouped){
  margin-top: 9px;
}

@media (max-width: 720px){
  .msg{
    --group-gap: 4px;
    --type-shift-gap: 10px;
    --author-break-gap: 11px;
  }

  .msg.msg--grouped .bubble{
    border-top-left-radius: 13px;
    border-top-right-radius: 13px;
  }

  .msg.mine.msg--grouped .bubble{
    border-bottom-right-radius: 13px;
  }

  .msg:not(.mine).msg--grouped .bubble{
    border-bottom-left-radius: 13px;
  }
}



/* =========================
   vNext: bottom interaction hierarchy tune
   ========================= */
.composerUtilityBar{
  margin-top: 10px;
  padding: 0 14px;
  gap: 8px;
}

.composerUtilityBar__row{
  gap: 8px;
}

.composerUtilityBar__group{
  gap: 6px;
}

.composerUtilityBar__chip,
.composerUtilityBar__ghost,
.composerUtilityBar__toggle{
  min-height: 30px;
  padding: 0 11px;
  border-radius: 14px;
}

.composerUtilityBar__chipLabel,
.composerUtilityBar__ghostLabel,
.composerUtilityBar__toggleLabel{
  font-size: 11px;
}









.dockWrap{
  padding: 8px 14px 0;
}

.dockBar{
  min-height: 42px;
  gap: 6px;
}

.dockBar + .dockPanel{
  margin-top: 8px;
}

.dockSectionTitle{
  margin-bottom: 6px;
}

.dockPanel{
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
}

.dockPanel__head{
  gap: 6px;
  padding: 2px 2px 6px;
}

.dockPanel__title{
  font-size: 12px;
}

.dockPanel__hint{
  font-size: 10.5px;
}

.dockFilterBar{
  margin-top: 2px;
}

.dockGrid + .dockGrid,
.dockListInline + .dockListInline,
.dockSuggestList + .dockSuggestList{
  margin-top: 8px;
}

.bottomInteractionStack{
  display: grid;
  gap: 8px;
}

.bottomInteractionStack--tight{
  gap: 6px;
}

.bottomInteractionStack .dockWrap:first-child,
.bottomInteractionStack .composerUtilityBar:first-child{
  margin-top: 0;
}

.composerShell{
  gap: 8px;
}

@media (max-width: 720px){
  .composerUtilityBar{
    margin-top: 8px;
    padding: 0 12px;
    gap: 7px;
  }

  .composerUtilityBar__row{
    gap: 7px;
  }

  .composerUtilityBar__chip,
  .composerUtilityBar__ghost,
  .composerUtilityBar__toggle{
    min-height: 28px;
    padding: 0 10px;
    border-radius: 13px;
  }



  .dockWrap{
    padding: 7px 12px 0;
  }

  .dockBar{
    min-height: 40px;
  }

  .dockBar + .dockPanel{
    margin-top: 7px;
  }

  .bottomInteractionStack{
    gap: 7px;
  }
}



/* =========================
   vNext: top entry rhythm tune
   ========================= */
.topbar{
  padding: 8px 14px 6px;
  gap: 9px;
  align-items: center;
}

.topbar .rl-btn,
.topbar .peer,
.topbar .right .rl-btn{
  min-height: 36px;
}

.peer{
  padding: 7px 10px;
  border-radius: 15px;
  gap: 9px;
}

.peerAva{
  width: 32px;
  height: 32px;
}

.peerName{
  font-size: 13px;
}

.peerHandle{
  font-size: 11px;
}

.scroller{
  padding-top: 6px;
  padding-inline: 14px;
  padding-bottom: calc(var(--composer-h, 152px) + env(safe-area-inset-bottom) + 24px);
}

.inner{
  display: grid;
  align-content: start;
  gap: 0;
}

.searchReturnBar{
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 16px;
}

.searchReturnBar__copy{
  gap: 5px;
}

.searchReturnBar__actions{
  margin-top: 8px;
  gap: 6px;
}

.more{
  margin: 2px 0 10px;
}

.moreBtn{
  min-height: 32px;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 11px;
}

.unreadDivider{
  margin: 8px 0 10px;
}

.bottomSpacer{
  height: 10px;
}

.composerWrap{
  padding-top: 8px;
}

.composerInner--stack{
  gap: 7px;
}

.composerUtilityBar{
  margin-bottom: 2px;
}

.composerHint{
  padding-inline: 2px;
}

@media (max-width: 720px){
  .topbar{
    padding: 7px 12px 5px;
    gap: 7px;
  }

  .peer{
    padding: 7px 9px;
    border-radius: 14px;
  }

  .peerAva{
    width: 30px;
    height: 30px;
  }

  .peerName{
    font-size: 12.5px;
  }

  .scroller{
    padding-top: 4px;
    padding-inline: 12px;
    padding-bottom: calc(var(--composer-h, 148px) + env(safe-area-inset-bottom) + 22px);
  }

  .searchReturnBar{
    margin-bottom: 8px;
    padding: 9px 10px;
    border-radius: 15px;
  }

  .more{
    margin: 0 0 8px;
  }

  .bottomSpacer{
    height: 8px;
  }

  .composerWrap{
    padding-top: 7px;
  }
}



/* =========================
   vNext: overlay tone reduction
   ========================= */
.messageStageSheet{
  padding: 10px 12px 12px;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -10px 28px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(14px);
}

.messageStageSheet__head{
  gap: 8px;
  margin-bottom: 8px;
}

.messageStageSheet__title{
  font-size: 13px;
}

.messageStageSheet__hint{
  font-size: 10.5px;
  opacity: .72;
}

.messageStageSheet__actions{
  gap: 6px;
}


.messageStageSheet .stageCard,
.messageStageSheet .focusCard,
.messageStageSheet .stackCard{
  border-radius: 16px;
  padding: 9px 10px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10);
}

.commandDeck{
  padding: 8px 10px 10px;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -10px 24px rgba(15, 23, 42, 0.15);
  backdrop-filter: blur(12px);
}

.commandDeck__head{
  gap: 7px;
  margin-bottom: 7px;
}

.commandDeck__title{
  font-size: 12.5px;
}

.commandDeck__hint{
  font-size: 10.5px;
  opacity: .72;
}

.commandDeck__tabs{
  gap: 6px;
  margin-bottom: 7px;
}

.commandDeck__tab{
  min-height: 30px;
  padding: 0 10px;
  border-radius: 12px;
}


.commandDeck .deckSection,
.commandDeck .deckCard,
.commandDeck .deckList,
.commandDeck .deckComposer{
  border-radius: 15px;
  box-shadow: none;
}

.commandDeck .deckSection,
.commandDeck .deckCard{
  padding: 8px 9px;
}

.commandDeck .deckList{
  padding: 7px;
}

.commandDeck .deckSectionTitle{
  margin-bottom: 6px;
}

.sessionHub,
.sessionPanel,
.sessionSheet{
  border-radius: 18px 18px 0 0;
  padding: 9px 10px 10px;
  box-shadow: 0 -10px 26px rgba(15, 23, 42, 0.15);
  backdrop-filter: blur(12px);
}

.sessionHub__head,
.sessionPanel__head,
.sessionSheet__head{
  gap: 7px;
  margin-bottom: 7px;
}

.sessionHub__title,
.sessionPanel__title,
.sessionSheet__title{
  font-size: 12.5px;
}

.sessionHub__hint,
.sessionPanel__hint,
.sessionSheet__hint{
  font-size: 10.5px;
  opacity: .72;
}


.sessionHub .sessionCard,
.sessionPanel .sessionCard,
.sessionSheet .sessionCard,
.sessionHub .sessionBlock,
.sessionPanel .sessionBlock,
.sessionSheet .sessionBlock{
  border-radius: 15px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10);
}

.sessionHub .sessionCard,
.sessionPanel .sessionCard,
.sessionSheet .sessionCard{
  padding: 8px 9px;
}

.overlayScrim,
.sheetScrim,
.deckScrim{
  background: rgba(15, 23, 42, 0.32);
}

@media (max-width: 720px){
  .messageStageSheet{
    padding: 9px 10px 11px;
    border-radius: 18px 18px 0 0;
  }

  .commandDeck{
    padding: 7px 8px 9px;
    border-radius: 16px 16px 0 0;
  }

  .sessionHub,
  .sessionPanel,
  .sessionSheet{
    padding: 8px 9px 9px;
    border-radius: 16px 16px 0 0;
  }

  .messageStageSheet .stageCard,
  .messageStageSheet .focusCard,
  .messageStageSheet .stackCard,
  .commandDeck .deckSection,
  .commandDeck .deckCard,
  .sessionHub .sessionCard,
  .sessionPanel .sessionCard,
  .sessionSheet .sessionCard{
    border-radius: 14px;
  }
}



/* =========================
   vNext: stabilization pass for leftover experimental traces
   ========================= */
.searchReturnBar{
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  background: color-mix(in srgb, var(--surface, #fff) 90%, transparent);
}

.searchReturnBar__eyebrow,
.messageStageRail__eyebrow,
.messageStageSheet__eyebrow,
.commandDeck__eyebrow,
.sessionHub__eyebrow{
  font-size: 10px;
  letter-spacing: .12em;
  opacity: .6;
}

.searchReturnBar__chips,
.messageStageSheetTabs,
.commandDeck__tabs{
  gap: 6px;
}

.searchReturnBar__chipPill,
.messageStageSheetTabs__tab,
.commandDeck__tab{
  min-height: 28px;
  padding: 0 9px;
  border-radius: 12px;
  font-size: 10.5px;
}

.messageStageSheet__grab,
.commandDeck__grab,
.sessionSheet__grab,
.sessionHub__grab{
  width: 34px;
  height: 4px;
  border-radius: 999px;
  margin: 0 auto 8px;
  opacity: .45;
}

.messageStageSheet__close,
.commandDeck__close,
.sessionSheet__close,
.sessionHub__close{
  min-height: 28px;
  padding: 0 9px;
  border-radius: 12px;
  font-size: 10.5px;
}

.newMsg{
  right: 14px;
  bottom: calc(var(--composer-h, 152px) + env(safe-area-inset-bottom) + 14px);
  min-height: 32px;
  padding: 0 11px;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  font-size: 11px;
}

.moreBtn,
.unreadDivider__label{
  box-shadow: none;
}

.unreadDivider__label{
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10.5px;
}

.messageStageSheet .stageCard__eyebrow,
.messageStageSheet .focusCard__eyebrow,
.messageStageSheet .stackCard__eyebrow,
.commandDeck .deckCard__eyebrow,
.sessionHub .sessionCard__eyebrow,
.sessionPanel .sessionCard__eyebrow{
  font-size: 9.5px;
  opacity: .56;
}

.messageStageSheet strong,
.commandDeck strong,
.sessionHub strong,
.sessionPanel strong,
.sessionSheet strong{
  line-height: 1.3;
}

.commandDeck .deckEmpty,
.sessionHub .sessionEmpty,
.sessionPanel .sessionEmpty{
  border-radius: 14px;
  padding: 10px;
  opacity: .82;
}

.scroller{
  scroll-padding-top: 14px;
  scroll-padding-bottom: calc(var(--composer-h, 152px) + env(safe-area-inset-bottom) + 24px);
}

.inner > :first-child{
  margin-top: 0;
}

.bottomSpacer{
  height: 6px;
}

@media (max-width: 720px){
  .newMsg{
    right: 12px;
    bottom: calc(var(--composer-h, 148px) + env(safe-area-inset-bottom) + 12px);
    min-height: 30px;
    padding: 0 10px;
    border-radius: 13px;
  }

  .searchReturnBar__chipPill,
  .messageStageSheetTabs__tab,
  .commandDeck__tab{
    min-height: 27px;
    padding: 0 8px;
  }

  .messageStageSheet__grab,
  .commandDeck__grab,
  .sessionSheet__grab,
  .sessionHub__grab{
    margin-bottom: 7px;
  }

  .bottomSpacer{
    height: 4px;
  }
}



/* =========================
   vNext: finish pass for collision prevention
   ========================= */
.topbar{
  position: sticky;
  top: 0;
  z-index: 18;
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--surface, #fff) 88%, transparent);
}

.scroller{
  overscroll-behavior-y: contain;
}

.inner{
  min-height: 100%;
}

.msg{
  position: relative;
  z-index: 1;
}

.msg:hover,
.msg:focus-within{
  z-index: 2;
}

.msgMenu,
.hoverActions{
  z-index: 6;
}

.msgMenu{
  max-width: min(220px, calc(100vw - 28px));
}

.hoverActions{
  pointer-events: none;
}

.msg:hover .hoverActions,
.msg:focus-within .hoverActions{
  pointer-events: auto;
}

.messageToolSummary,
.candidates,
.messageFooter,
.messageMetaRow{
  position: relative;
  z-index: 1;
}

.candidates{
  scroll-margin-top: 18px;
}

.composerWrap{
  position: sticky;
  bottom: 0;
  z-index: 22;
  background:
    linear-gradient(to top,
      color-mix(in srgb, var(--surface, #fff) 94%, transparent) 0%,
      color-mix(in srgb, var(--surface, #fff) 90%, transparent) 58%,
      transparent 100%);
  backdrop-filter: blur(12px);
}

.composerShell{
  position: relative;
  z-index: 2;
}

.composerUtilityBar,
.dockWrap{
  position: relative;
  z-index: 2;
}

.dockPanel,
.messageStageSheet,
.commandDeck,
.sessionHub,
.sessionPanel,
.sessionSheet{
  max-height: min(72vh, 680px);
  overflow: auto;
  overscroll-behavior: contain;
}

.dockPanel{
  scrollbar-gutter: stable;
}

.overlayScrim,
.sheetScrim,
.deckScrim{
  z-index: 30;
}

.messageStageSheet,
.commandDeck,
.sessionHub,
.sessionPanel,
.sessionSheet{
  z-index: 31;
}

.newMsg{
  z-index: 17;
}

.searchReturnBar{
  scroll-margin-top: 18px;
}

.unreadDivider{
  scroll-margin-top: 16px;
}

.bottomSpacer{
  pointer-events: none;
}

@media (max-width: 720px){
  .topbar{
    z-index: 16;
  }

  .composerWrap{
    z-index: 24;
  }

  .msgMenu{
    max-width: calc(100vw - 22px);
  }

  .dockPanel,
  .messageStageSheet,
  .commandDeck,
  .sessionHub,
  .sessionPanel,
  .sessionSheet{
    max-height: min(74vh, 720px);
  }
}



/* =========================
   vNext: final visual calm-down pass
   ========================= */
:root{
  --ui-calm-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  --ui-calm-border: color-mix(in srgb, var(--line, rgba(148,163,184,.28)) 88%, transparent);
}

.topbar,
.composerWrap,
.searchReturnBar,
.dockBar,
.dockPanel,
.messageStageSheet,
.commandDeck,
.sessionHub,
.sessionPanel,
.sessionSheet{
  box-shadow: var(--ui-calm-shadow);
}

.peer,
.searchReturnBar,
.dockBar,
.dockPanel,
.messageStageSheet .stageCard,
.messageStageSheet .focusCard,
.messageStageSheet .stackCard,
.commandDeck .deckSection,
.commandDeck .deckCard,
.commandDeck .deckList,
.sessionHub .sessionCard,
.sessionPanel .sessionCard,
.sessionSheet .sessionCard{
  border-color: var(--ui-calm-border);
}

.msg .bubble{
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
}

.msg--plain .bubble,
.msg--focus .bubble{
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.msg--session .bubble,
.msg--action .bubble,
.msg--media .bubble{
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
}

.hoverActions{
  opacity: .92;
  transform: translateY(0);
}

.msg:not(:hover):not(:focus-within) .hoverActions{
  opacity: .0;
  transform: translateY(2px);
}

.msgMenuTrigger{
  opacity: .82;
}

.msg:hover .msgMenuTrigger,
.msg:focus-within .msgMenuTrigger{
  opacity: 1;
}

.messageEyebrow__tag,
.messageInlineMeta__chip,
.messageToolSummary small,
.unreadDivider__label,
.searchReturnBar__chipPill,
.messageStageSheetTabs__tab,
.commandDeck__tab,
.dockPill,
.composerUtilityBar__ghost,
.composerUtilityBar__toggle{
  box-shadow: none;
}

.messageEyebrow__tag,
.messageInlineMeta__chip,
.messageToolSummary small{
  border-color: color-mix(in srgb, var(--line, rgba(148,163,184,.28)) 84%, transparent);
}

.messageToolSummary{
  opacity: .92;
}

.candidates{
  padding-top: 2px;
}

.candidates > * + *{
  margin-top: 0;
}

.messageFooter{
  opacity: .96;
}

.messageMetaRow{
  opacity: .72;
}

.msg:hover .messageMetaRow,
.msg:focus-within .messageMetaRow{
  opacity: .84;
}

.moreBtn,
.newMsg,
.msgMenuTrigger,
.commandDeck__tab,
.messageStageSheet__close,
.commandDeck__close,
.sessionSheet__close,
.sessionHub__close{
  transition: transform .16s ease, opacity .16s ease, box-shadow .16s ease;
}

.moreBtn:hover,
.newMsg:hover,
.msgMenuTrigger:hover,
.commandDeck__tab:hover{
  transform: translateY(-1px);
}

.searchReturnBar__actions,
.composerUtilityBar__group,
.dockFilterBar,
.commandDeck__tabs{
  flex-wrap: wrap;
}

.searchReturnBar__actions > *,
.composerUtilityBar__group > *,
.dockFilterBar > *,
.commandDeck__tabs > *{
  min-width: 0;
}

.bottomInteractionStack{
  padding-bottom: 2px;
}

.scroller{
  scrollbar-gutter: stable both-edges;
}

@media (max-width: 720px){
  .topbar,
  .composerWrap,
  .searchReturnBar,
  .dockBar,
  .dockPanel{
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.07);
  }

  .msg .bubble{
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  }

  .msgMenuTrigger{
    opacity: 1;
  }

  .msg .hoverActions{
    opacity: 0 !important;
    transform: none !important;
  }

  .bottomInteractionStack{
    padding-bottom: 1px;
  }
}



/* =========================
   vNext: final micro-cleanup pass
   ========================= */
.msg{
  contain: layout style;
}

.msg .bubble{
  overflow: clip;
}

.messageBody,
.messageFooter,
.messageMetaRow,
.messageToolSummary,
.candidates{
  min-width: 0;
}

.messageTextBlock{
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.messageInlineMeta,
.messageToolSummary,
.searchReturnBar__actions,
.composerUtilityBar__row,
.composerUtilityBar__group,
.dockFilterBar,
.commandDeck__tabs,
.sessionHub__actions,
.sessionPanel__actions,
.sessionSheet__actions{
  align-items: center;
}

.messageToolSummary small,
.messageInlineMeta__chip,
.messageEyebrow__tag{
  white-space: nowrap;
}

.messageToolSummary{
  row-gap: 5px;
}

.candidates{
  padding-bottom: 2px;
}

.candidates :where(.wrap, .candidate, .candidateCard){
  min-width: 0;
}

.msgMenu{
  overflow: clip;
}

.msgMenu__item,
.msgMenu button,
.msgMenu a{
  min-height: 32px;
}

.topbar .left,
.topbar .right,
.peer,
.searchReturnBar__copy,

.peerMeta,
.searchReturnBar__copy{
  overflow: hidden;
}

.peerName,
.peerHandle,
.searchReturnBar__title,
.searchReturnBar__hint,
.messageStageSheet__title,
.messageStageSheet__hint,
.commandDeck__title,
.commandDeck__hint,
.sessionHub__title,
.sessionHub__hint,
.sessionPanel__title,
.sessionPanel__hint,
.sessionSheet__title,
.sessionSheet__hint{
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.more,
.unreadDivider,
.searchReturnBar,
.dockWrap{
  scroll-margin-top: 16px;
}

.composerWrap{
  padding-bottom: max(6px, env(safe-area-inset-bottom));
}

.composerHint{
  opacity: .7;
}

.bottomSpacer{
  height: 2px;
}

@media (max-width: 720px){
  .messageTextBlock{
    word-break: break-word;
  }

  .messageToolSummary small,
  .messageInlineMeta__chip{
    max-width: 100%;
  }

  .peerName,
  .peerHandle,
  .searchReturnBar__title,
  .searchReturnBar__hint,

  .msgMenu__item,
  .msgMenu button,
  .msgMenu a{
    min-height: 34px;
  }

  .composerWrap{
    padding-bottom: max(4px, env(safe-area-inset-bottom));
  }
}



/* =========================
   vNext: final polish for stable reading flow
   ========================= */
.scroller{
  content-visibility: auto;
}

.inner{
  padding-bottom: 2px;
}

.msgList,
.messageList,
.timeline{
  min-width: 0;
}

.msg{
  isolation: isolate;
}

.msg .bubble{
  max-inline-size: min(var(--bubble-max, 72%), 100%);
}

.msg.mine .bubble{
  margin-left: auto;
}

.msg:not(.mine) .bubble{
  margin-right: auto;
}

.messageBody{
  align-items: stretch;
}

.messageTextBlock > :last-child,
.messageFooter > :last-child,
.messageToolSummary > :last-child,
.candidates > :last-child{
  margin-bottom: 0;
}

.messageMetaRow{
  justify-content: flex-end;
}

.msg:not(.mine) .messageMetaRow{
  justify-content: flex-start;
}

.messageMetaRow > *{
  min-width: 0;
}

.messageFooter{
  align-items: flex-start;
}

.messageFooter :where(.attachment, .file, .chip, .status){
  min-width: 0;
}

.messageToolSummary{
  align-items: center;
}

.messageToolSummary small{
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.candidates{
  align-items: stretch;
}

.candidates :where(.wrap, .candidate, .candidateCard){
  width: 100%;
}

.dockPanel,
.messageStageSheet,
.commandDeck,
.sessionHub,
.sessionPanel,
.sessionSheet{
  scrollbar-width: thin;
}

.topbar,
.composerWrap{
  background-clip: padding-box;
}

.newMsg{
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.msgMenuTrigger,
.moreBtn,
.composerUtilityBar__chip,
.composerUtilityBar__ghost,
.composerUtilityBar__toggle,
.commandDeck__tab{
  white-space: nowrap;
}

.searchReturnBar__actions,
.composerUtilityBar__row,
.composerUtilityBar__group,
.dockFilterBar,
.commandDeck__tabs{
  row-gap: 6px;
}

@media (max-width: 720px){
  .inner{
    padding-bottom: 1px;
  }

  .msg .bubble{
    max-inline-size: min(var(--bubble-max, 84%), 100%);
  }

  .messageMetaRow{
    row-gap: 3px;
  }

  .searchReturnBar__actions,
  .composerUtilityBar__row,
  .composerUtilityBar__group,
  .dockFilterBar,
  .commandDeck__tabs{
    row-gap: 5px;
  }
}



/* =========================
   vNext: live class alignment cleanup
   ========================= */
.newBanner{
  right: 14px;
  bottom: calc(var(--composer-h, 152px) + env(safe-area-inset-bottom) + 14px);
  min-height: 32px;
  padding: 0 11px;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  font-size: 11px;
  z-index: 17;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform .16s ease, opacity .16s ease, box-shadow .16s ease;
}
.newBanner:hover{
  transform: translateY(-1px);
}
.messageStageSheetBody,

@media (max-width: 720px){
  .newBanner{
    right: 12px;
    bottom: calc(var(--composer-h, 148px) + env(safe-area-inset-bottom) + 12px);
    min-height: 30px;
    padding: 0 10px;
    border-radius: 13px;
  }
}



/* =========================
   vNext: live class alignment cleanup 2
   ========================= */
.messageStageSheetBackdrop,
.commandDeckBackdrop{
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(15, 23, 42, 0.32);
}

.messageStageSheet,
.commandDeck{
  z-index: 31;
  max-height: min(72vh, 680px);
  overflow: auto;
  overscroll-behavior: contain;
}

.messageStageSheetBody,
.commandDeck__panel{
  display: grid;
  gap: 8px;
}

.commandDeck__panel > :last-child,
.messageStageSheetBody > :last-child,
.sessionHub__stack > :last-child{
  margin-bottom: 0;
}

.sessionHub__stack{
  gap: 12px;
}

.sessionHub__compactList{
  gap: 8px;
}

.sessionHub__section{
  gap: 8px;
}

.sessionHub__empty,
.messageStageSheetEmpty{
  box-shadow: none;
}

@media (max-width: 720px){
  .messageStageSheet,
  .commandDeck{
    max-height: min(74vh, 720px);
  }

  .sessionHub__stack{
    gap: 10px;
  }
}



/* =========================
   vNext: dead selector trim pass
   ========================= */
.messageStageSheetBody,
.commandDeck__panel,
.sessionHub__section,
.sessionHub__compactList{
  min-width: 0;
}

.sessionHub__stack{
  min-width: 0;
}

.messageStageSheetBody > *,
.commandDeck__panel > *,
.sessionHub__section > *{
  min-width: 0;
}



/* =========================
   vNext: command deck tabs fix
   ========================= */
.commandDeck__tabs{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
  margin-bottom:8px;
}

.commandDeck__tab{
  appearance:none;
  -webkit-appearance:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  width:100%;
  min-width:0;
  min-height:38px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.06);
  color:rgba(236,241,255,.88);
  font-size:12px;
  font-weight:800;
  line-height:1;
  text-align:center;
  cursor:pointer;
}

.commandDeck__tab small{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:18px;
  height:18px;
  padding:0 6px;
  border-radius:999px;
  background:rgba(255,255,255,.08);
  color:inherit;
  font-size:10px;
  font-weight:900;
}

.commandDeck__tab.on{
  background:linear-gradient(180deg, rgba(94,114,255,.28), rgba(68,84,194,.24));
  border-color:rgba(132,150,255,.30);
  color:#fff;
  box-shadow:0 6px 16px rgba(58,74,180,.18);
}

.commandDeck__tab:disabled{
  opacity:.48;
  cursor:not-allowed;
}

.commandDeck__helper{
  margin-bottom:8px;
  padding:9px 10px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
  color:rgba(236,241,255,.72);
  font-size:11px;
  line-height:1.5;
}

.commandDeck__helper strong{
  color:#fff;
  font-weight:800;
}

@media (max-width:720px){
  .commandDeck__tabs{
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:6px;
  }

  .commandDeck__tab{
    min-height:36px;
    padding:0 8px;
    border-radius:13px;
    font-size:11px;
  }

  .commandDeck__tab small{
    min-width:16px;
    height:16px;
    padding:0 5px;
    font-size:9px;
  }

  .commandDeck__helper{
    margin-bottom:7px;
    padding:8px 9px;
    border-radius:13px;
    font-size:10.5px;
  }
}



/* =========================
   vNext: action creation guide near composer
   ========================= */
.composerActionGuide{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  padding:0 14px 8px;
}

.composerActionGuide__chip{
  appearance:none;
  -webkit-appearance:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.05);
  color:rgba(236,241,255,.84);
  font-size:11px;
  font-weight:700;
  cursor:pointer;
  white-space:nowrap;
}

.composerActionGuide__chip:hover{
  background:rgba(104,124,255,.12);
  border-color:rgba(132,150,255,.24);
  color:#fff;
}

.composerHint strong{
  color:#fff;
  font-weight:800;
}

.composerHint em{
  font-style:normal;
  color:rgba(236,241,255,.84);
}

@media (max-width:720px){
  .composerActionGuide{
    gap:6px;
    padding:0 12px 7px;
  }

  .composerActionGuide__chip{
    min-height:27px;
    padding:0 9px;
    font-size:10.5px;
  }
}



/* =========================
   vNext: candidate dock visibility fix
   ========================= */
.messageToolSummary small + small{
  opacity:.86;
}

.messageInlineMeta--action small,
.messageToolSummary small{
  line-height:1.45;
}



/* =========================
   vNext: mobile action deck visibility fix
   ========================= */
.commandDeckBackdrop{
  background: rgba(7, 11, 24, 0.52);
}

.commandDeck{
  width: min(100%, 560px);
  max-height: min(78vh, 760px);
}

.commandDeck__head{
  position: sticky;
  top: 0;
  z-index: 4;
  margin: -8px -10px 8px;
  padding: 10px 10px 8px;
  background: linear-gradient(180deg, rgba(9, 14, 31, 0.98), rgba(9, 14, 31, 0.92));
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.commandDeck__tabs{
  position: sticky;
  top: 66px;
  z-index: 4;
  margin: 0 -2px 8px;
  padding: 0 2px 8px;
  background: linear-gradient(180deg, rgba(9, 14, 31, 0.96), rgba(9, 14, 31, 0.82));
  backdrop-filter: blur(12px);
}

.commandDeck__panel{
  min-height: 0;
  overflow: auto;
  padding-bottom: 2px;
}

.dockWrapInline{
  display: grid;
  gap: 10px;
  min-height: 0;
}

.dockBarInline{
  position: sticky;
  top: 0;
  z-index: 3;
  background: linear-gradient(180deg, rgba(9, 14, 31, 0.98), rgba(9, 14, 31, 0.88));
  backdrop-filter: blur(12px);
}

.dockPanelInline{
  max-height: min(48vh, 420px);
  overflow: auto;
  padding-bottom: 12px;
  scroll-padding-bottom: 12px;
}

.commandDeck__helper{
  position: sticky;
  top: 0;
  z-index: 2;
}

.dockSuggestList{
  gap: 10px;
}

.dockSlot{
  width: 100%;
}

.dockSlot .wrap,
.dockSlot .candidate,
.dockSlot .candidateCard{
  width: 100%;
}

@media (max-width: 720px){
  .commandDeckBackdrop{
    background: rgba(7, 11, 24, 0.62);
  }

  .commandDeck{
    width: 100%;
    max-height: min(84vh, 820px);
    border-radius: 18px 18px 0 0;
  }

  .commandDeck__head{
    top: 0;
    margin: -7px -8px 7px;
    padding: 9px 8px 7px;
  }

  .commandDeck__tabs{
    top: 62px;
    margin-bottom: 7px;
    padding-bottom: 7px;
  }

  .commandDeck__panel{
    padding-bottom: 4px;
  }

  .dockWrapInline{
    gap: 8px;
  }

  .dockBarInline{
    top: 0;
  }

  .dockPanelInline{
    max-height: min(56vh, 540px);
    padding-bottom: 10px;
  }

  .commandDeck__helper{
    font-size: 10.5px;
    line-height: 1.45;
  }
}



/* =========================
   vNext: message stage mini stack css fix
   ========================= */
.messageStageSheetMiniStack{
  display:grid;
  gap:8px;
}

.messageStageSheetMiniStack__card{
  appearance:none;
  -webkit-appearance:none;
  display:grid;
  gap:5px;
  width:100%;
  padding:12px 13px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:linear-gradient(180deg, rgba(18, 24, 45, .92), rgba(10, 15, 29, .90));
  text-align:left;
  color:#fff;
  box-shadow:0 4px 12px rgba(15, 23, 42, 0.08);
}

.messageStageSheetMiniStack__card span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:max-content;
  min-width:54px;
  height:20px;
  padding:0 8px;
  border-radius:999px;
  background:rgba(255,255,255,.07);
  color:rgba(236,241,255,.76);
  font-size:9.5px;
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
}

.messageStageSheetMiniStack__card strong{
  font-size:13px;
  line-height:1.4;
  color:#fff;
}

.messageStageSheetMiniStack__card:hover{
  border-color:rgba(132,150,255,.26);
  background:linear-gradient(180deg, rgba(26, 34, 62, .96), rgba(12, 18, 34, .94));
}

@media (max-width:720px){
  .messageStageSheetMiniStack{
    gap:7px;
  }

  .messageStageSheetMiniStack__card{
    padding:11px 12px;
    border-radius:15px;
  }

  .messageStageSheetMiniStack__card strong{
    font-size:12.5px;
  }
}



/* =========================
   vNext: stage card + candidate usability fix
   ========================= */
.messageStageSheetMiniStack{
  display:grid;
  gap:8px;
}

.messageStageSheetMiniStack__card{
  appearance:none;
  -webkit-appearance:none;
  display:grid;
  gap:5px;
  width:100%;
  padding:12px 13px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:linear-gradient(180deg, rgba(18, 24, 45, .92), rgba(10, 15, 29, .90));
  text-align:left;
  color:#fff;
  box-shadow:0 4px 12px rgba(15, 23, 42, 0.08);
}

.messageStageSheetMiniStack__card span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:max-content;
  min-width:54px;
  height:20px;
  padding:0 8px;
  border-radius:999px;
  background:rgba(255,255,255,.07);
  color:rgba(236,241,255,.76);
  font-size:9.5px;
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
}

.messageStageSheetMiniStack__card strong{
  font-size:13px;
  line-height:1.4;
  color:#fff;
}

.dockSuggestList{
  gap:10px;
}

.dockSuggestList__head{
  display:grid;
  gap:4px;
  padding:2px 2px 4px;
}

.dockSuggestList__head strong{
  font-size:12.5px;
  line-height:1.35;
  color:#fff;
}

.dockSuggestList__head small{
  color:rgba(236,241,255,.72);
  font-size:11px;
  line-height:1.45;
}

.dockPanelInline{
  max-height:min(62vh, 620px);
}

.dockSlot .wrap[data-compact="false"]{
  margin-top:0;
}

@media (max-width:720px){
  .messageStageSheetMiniStack{
    gap:7px;
  }

  .messageStageSheetMiniStack__card{
    padding:11px 12px;
    border-radius:15px;
  }

  .messageStageSheetMiniStack__card strong{
    font-size:12.5px;
  }

  .dockSuggestList__head strong{
    font-size:12px;
  }

  .dockSuggestList__head small{
    font-size:10.5px;
  }

  .dockPanelInline{
    max-height:min(66vh, 620px);
  }
}



/* =========================
   vNext: mobile overlay reset
   ========================= */
.messageStageSheetBackdrop,
.commandDeckBackdrop,
.overlayScrim,
.sheetScrim,
.deckScrim{
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(5, 9, 20, 0.72);
  backdrop-filter: blur(10px);
}

.messageStageSheet,
.commandDeck,
.sessionHub,
.sessionPanel,
.sessionSheet{
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  width: 100%;
  max-width: 100%;
  min-height: 78vh;
  max-height: 88vh;
  margin: 0;
  border-radius: 22px 22px 0 0;
  padding: 10px 12px 14px;
  background:
    linear-gradient(180deg,
      rgba(8, 13, 29, 0.98) 0%,
      rgba(7, 11, 24, 0.985) 60%,
      rgba(6, 10, 20, 0.99) 100%);
  border: 1px solid rgba(255,255,255,.06);
  box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.38);
  overflow: hidden;
}

.messageStageSheet__head,
.commandDeck__head,
.sessionHub__head,
.sessionPanel__head,
.sessionSheet__head{
  position: sticky;
  top: 0;
  z-index: 4;
  margin: -10px -12px 10px;
  padding: 10px 12px 8px;
  background: linear-gradient(180deg, rgba(8, 13, 29, 0.99), rgba(8, 13, 29, 0.94));
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.messageStageSheetTabs,
.commandDeck__tabs{
  position: sticky;
  top: 66px;
  z-index: 4;
  margin: 0 -2px 10px;
  padding: 0 2px 10px;
  background: linear-gradient(180deg, rgba(8, 13, 29, 0.96), rgba(8, 13, 29, 0.88));
}

.messageStageSheetBody,
.commandDeck__panel{
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  padding-bottom: 10px;
  scrollbar-width: thin;
}

.messageStageSheetCard,
.messageStageSheetMiniStack__card{
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  text-align: left;
  padding: 12px 13px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, rgba(19, 26, 47, .96), rgba(11, 17, 32, .96));
  color: #fff;
  box-shadow: none;
}

.messageStageSheetCard strong,
.messageStageSheetMiniStack__card strong{
  display: block;
  font-size: 13px;
  line-height: 1.4;
  color: #fff;
}

.messageStageSheetCard p{
  margin-top: 5px;
  color: rgba(236,241,255,.72);
  font-size: 11px;
  line-height: 1.45;
}

.messageStageSheetCard__tag,
.messageStageSheetMiniStack__card span{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  min-width: 54px;
  height: 20px;
  margin-bottom: 6px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  color: rgba(236,241,255,.76);
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.dockWrapInline{
  display: grid;
  gap: 10px;
  min-height: 0;
}

.dockBarInline{
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 8px;
  border-radius: 16px;
  background: rgba(15, 22, 42, 0.92);
  border: 1px solid rgba(255,255,255,.08);
}

.dockPanelInline{
  min-height: 0;
  max-height: none;
  overflow: auto;
  padding: 2px 2px 12px;
}

.commandDeck__helper{
  position: static;
  margin-bottom: 8px;
  padding: 10px 11px;
  border-radius: 14px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.07);
}

.dockSuggestList{
  display: grid;
  gap: 10px;
}

.dockSuggestList__head{
  display: grid;
  gap: 4px;
  padding: 2px 2px 4px;
}

.dockSuggestList__head strong{
  color: #fff;
  font-size: 12.5px;
  line-height: 1.35;
}

.dockSuggestList__head small{
  color: rgba(236,241,255,.72);
  font-size: 11px;
  line-height: 1.45;
}

.dockSlot,
.dockSlot .wrap,
.dockSlot .candidate,
.dockSlot .candidateCard{
  width: 100%;
}

@media (max-width: 720px){
  .messageStageSheet,
  .commandDeck,
  .sessionHub,
  .sessionPanel,
  .sessionSheet{
    min-height: 84vh;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
    padding: 9px 10px 12px;
  }

  .messageStageSheet__head,
  .commandDeck__head,
  .sessionHub__head,
  .sessionPanel__head,
  .sessionSheet__head{
    margin: -9px -10px 9px;
    padding: 9px 10px 7px;
  }

  .messageStageSheetTabs,
  .commandDeck__tabs{
    top: 62px;
    margin-bottom: 9px;
    padding-bottom: 9px;
  }

  .messageStageSheetBody,
  .commandDeck__panel{
    gap: 9px;
    padding-bottom: 8px;
  }

  .messageStageSheetCard,
  .messageStageSheetMiniStack__card{
    padding: 11px 12px;
    border-radius: 15px;
  }

  .dockBarInline{
    padding: 7px;
    border-radius: 15px;
  }

  .commandDeck__helper{
    padding: 9px 10px;
    border-radius: 13px;
  }
}



/* =========================
   hotfix: mobile command lens / stage readability
   ========================= */
.commandDeckBackdrop,
.messageStageSheetBackdrop{
  z-index: var(--z-sheet-backdrop);
  background: rgba(5, 9, 20, 0.78);
  backdrop-filter: blur(12px);
}

.commandDeck,
.messageStageSheet{
  z-index: var(--z-sheet);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  align-content: stretch;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 100%;
  min-height: min(84vh, 900px);
  max-height: min(90vh, 980px);
  padding: 12px 14px calc(16px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, rgba(8, 13, 29, .985), rgba(6, 10, 20, .99));
  box-shadow: 0 -24px 56px rgba(0,0,0,.42);
  overflow: hidden;
}

.commandDeck__head,
.messageStageSheet__head{
  position: static;
  margin: -12px -14px 10px;
  padding: 12px 14px 10px;
  background: linear-gradient(180deg, rgba(8,13,29,.995), rgba(8,13,29,.955));
  border-bottom: 1px solid rgba(255,255,255,.07);
}

.commandDeck__title,
.messageStageSheet__title{
  font-size: clamp(22px, 4.4vw, 30px);
  line-height: 1.2;
}

.commandDeck__hint,
.messageStageSheet__hint{
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(236,241,255,.82);
}

.commandDeck__close,
.messageStageSheet__close{
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.08);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(0,0,0,.18);
}

.commandDeck__tabs,
.messageStageSheetTabs{
  position: static;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 12px;
  padding: 0;
  background: transparent;
}

.commandDeck__tab,
.messageStageSheetTabs__tab{
  min-height: 42px;
  padding: 0 10px;
  border-radius: 14px;
  font-size: 12px;
}

.commandDeck__panel,
.messageStageSheetBody{
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  align-content: start;
  gap: 12px;
  padding: 2px 2px calc(12px + env(safe-area-inset-bottom));
}

.commandDeck__helper{
  position: static;
  margin-bottom: 10px;
  padding: 11px 12px;
  border-radius: 16px;
  font-size: 12px;
  line-height: 1.55;
}

.dockWrapInline,
.dockGrid,
.dockSuggestList{
  min-height: 0;
}

.dockBarInline{
  position: static;
  background: transparent;
  backdrop-filter: none;
}

.dockPanelInline{
  max-height: none;
  overflow: visible;
  padding-bottom: 0;
  scroll-padding-bottom: 0;
}

.dockFilterBar{
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 2px;
}

.dockListInline,
.dockSuggestList{
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.dockCard,
.messageStageSheetCard,
.messageStageSheetMiniStack__card{
  border-radius: 18px;
  padding: 14px 15px;
}

.dockCardTitle,
.messageStageSheetCard strong,
.messageStageSheetMiniStack__card strong{
  font-size: 15px;
  line-height: 1.35;
}

.dockCardMeta,
.dockCardHint,
.messageStageSheetCard p,
.messageStageSheetMiniStack__card span{
  font-size: 12.5px;
  line-height: 1.55;
}

@media (max-width: 720px){
  .commandDeck,
  .messageStageSheet{
    min-height: calc(100dvh - var(--app-header-h, 64px) - 10px);
    max-height: calc(100dvh - var(--app-header-h, 64px) - 2px);
    padding: 12px 12px calc(14px + env(safe-area-inset-bottom));
    border-radius: 22px 22px 0 0;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    margin: -12px -12px 10px;
    padding: 12px 12px 10px;
  }

  .commandDeck__title,
  .messageStageSheet__title{
    font-size: 18px;
  }

  .commandDeck__hint,
  .messageStageSheet__hint{
    font-size: 13px;
  }

  .commandDeck__tabs,
  .messageStageSheetTabs{
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    margin-bottom: 10px;
  }

  .commandDeck__tab,
  .messageStageSheetTabs__tab{
    min-height: 38px;
    padding: 0 8px;
    border-radius: 13px;
    font-size: 11px;
  }

  .commandDeck__tab small{
    min-width: 17px;
    height: 17px;
    padding: 0 5px;
    font-size: 9px;
  }

  .commandDeck__panel,
  .messageStageSheetBody{
    gap: 10px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
  }

  .commandDeck__helper,
  .dockCardMeta,
  .dockCardHint,
  .messageStageSheetCard p,
  .messageStageSheetMiniStack__card span{
    font-size: 12px;
  }
}


/* =========================
   mobile lens/stage hard override
   ========================= */
@media (max-width: 720px){
  .commandDeck,
  .messageStageSheet{
    min-height: 70dvh !important;
    max-height: 82dvh !important;
    padding: 10px 10px calc(12px + env(safe-area-inset-bottom)) !important;
    border-radius: 22px 22px 0 0 !important;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    margin: -10px -10px 8px !important;
    padding: 10px 10px 8px !important;
    gap: 8px !important;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    align-items: start !important;
  }

  .commandDeck__eyebrow,
  .messageStageSheet__eyebrow{
    font-size: 10px !important;
  }

  .commandDeck__title,
  .commandDeck__head strong,
  .messageStageSheet__title,
  .messageStageSheet__head strong{
    font-size: 16px !important;
    line-height: 1.3 !important;
  }

  .commandDeck__hint,
  .messageStageSheet__hint{
    margin-top: 6px !important;
    font-size: 12px !important;
    line-height: 1.45 !important;
  }

  .commandDeck__close,
  .messageStageSheet__close{
    appearance: none !important;
    -webkit-appearance: none !important;
    min-height: 32px !important;
    padding: 0 10px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    background: rgba(255,255,255,.08) !important;
    color: #fff !important;
    box-shadow: none !important;
    font-size: 12px !important;
    font-weight: 800 !important;
  }

  .commandDeck__tabs,
  .messageStageSheetTabs{
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    gap: 6px !important;
    margin: 0 0 10px !important;
    padding: 0 0 2px !important;
    scrollbar-width: none;
  }

  .commandDeck__tabs::-webkit-scrollbar,
  .messageStageSheetTabs::-webkit-scrollbar,
  .dockFilterBar::-webkit-scrollbar{
    display: none;
  }

  .commandDeck__tab,
  .messageStageSheetTabs__tab{
    flex: 0 0 auto !important;
    min-width: max-content !important;
    min-height: 36px !important;
    padding: 0 12px !important;
    border-radius: 12px !important;
    font-size: 11px !important;
    white-space: nowrap !important;
  }

  .commandDeck__panel,
  .messageStageSheetBody{
    gap: 10px !important;
    padding: 0 0 calc(8px + env(safe-area-inset-bottom)) !important;
  }

  .commandDeck__helper--actions{
    display: none !important;
  }

  .dockBarInline{
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 8px !important;
    align-items: stretch !important;
    margin-bottom: 10px !important;
  }

  .dockBarInline .dockSpacer{
    display: none !important;
  }

  .dockBarInline .dockTab,
  .dockBarInline .dockMore{
    min-width: 0 !important;
    min-height: 40px !important;
    padding: 0 10px !important;
    border-radius: 14px !important;
    font-size: 12px !important;
  }

  .dockPanelInline{
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
  }

  .dockFilterBar{
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    gap: 8px !important;
    margin-bottom: 8px !important;
    padding-bottom: 2px !important;
  }

  .dockPill{
    flex: 0 0 auto !important;
    min-height: 36px !important;
    white-space: nowrap !important;
  }

  .dockListInline,
  .dockSuggestList,
  .messageStageSheetBody{
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }

  .dockSuggestList__head{
    display: none !important;
  }

  .dockCard,
  .messageStageSheetCard,
  .messageStageSheetMiniStack__card{
    border-radius: 16px !important;
    padding: 13px 14px !important;
  }

  .dockCardTitle,
  .messageStageSheetCard strong,
  .messageStageSheetMiniStack__card strong{
    font-size: 14px !important;
    line-height: 1.4 !important;
  }

  .dockCardMeta,
  .dockCardHint,
  .messageStageSheetCard p,
  .messageStageSheetMiniStack__card span{
    font-size: 12px !important;
    line-height: 1.5 !important;
  }
}


/* =========================
   vNext: mobile sheet hotfix v3
   ========================= */
@media (max-width: 720px){
  .commandDeck,
  .messageStageSheet{
    width:100% !important;
    max-height:calc(100dvh - 88px) !important;
    min-height:min(560px, calc(100dvh - 88px)) !important;
    border-radius:22px 22px 0 0 !important;
    overflow:hidden !important;
    display:grid !important;
    grid-template-rows:auto auto 1fr !important;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    position:relative !important;
    top:auto !important;
    margin:0 !important;
    padding:14px 14px 10px !important;
    background:linear-gradient(180deg, rgba(9,14,31,.98), rgba(9,14,31,.94)) !important;
    border-bottom:1px solid rgba(255,255,255,.06) !important;
  }

  .commandDeck__title,
  .messageStageSheet__title{
    font-size:15px !important;
    line-height:1.35 !important;
  }

  .commandDeck__hint,
  .messageStageSheet__hint{
    margin-top:6px !important;
    font-size:12px !important;
    line-height:1.5 !important;
    color:rgba(228,235,255,.8) !important;
  }

  .commandDeck__close,
  .messageStageSheet__close{
    min-height:34px !important;
    padding:0 12px !important;
    border-radius:999px !important;
    border:1px solid rgba(255,255,255,.14) !important;
    background:rgba(255,255,255,.08) !important;
    color:#fff !important;
    font-size:12px !important;
    font-weight:800 !important;
    box-shadow:none !important;
  }

  .commandDeck__tabs,
  .messageStageSheetTabs{
    position:relative !important;
    top:auto !important;
    z-index:auto !important;
    margin:0 !important;
    padding:10px 12px !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    white-space:nowrap !important;
    display:flex !important;
    flex-wrap:nowrap !important;
    gap:8px !important;
    background:linear-gradient(180deg, rgba(9,14,31,.98), rgba(9,14,31,.92)) !important;
    border-bottom:1px solid rgba(255,255,255,.05) !important;
    -webkit-overflow-scrolling:touch !important;
    scrollbar-width:none !important;
  }

  .commandDeck__tabs::-webkit-scrollbar,
  .messageStageSheetTabs::-webkit-scrollbar,
  .dockFilterBar::-webkit-scrollbar{
    display:none !important;
  }

  .commandDeck__tab,
  .messageStageSheetTabs__tab{
    flex:0 0 auto !important;
    min-width:max-content !important;
    min-height:38px !important;
    padding:0 14px !important;
  }

  .commandDeck__panel,
  .messageStageSheetBody{
    min-height:0 !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    padding:12px !important;
    -webkit-overflow-scrolling:touch !important;
  }

  .commandDeck__panel--actions{
    padding-top:10px !important;
  }

  .dockWrapInline{
    gap:10px !important;
    min-height:auto !important;
  }

  .dockBarInline{
    position:relative !important;
    top:auto !important;
    display:grid !important;
    grid-template-columns:1fr 1fr auto !important;
    gap:8px !important;
    padding:0 !important;
    background:transparent !important;
    backdrop-filter:none !important;
  }

  .dockSpacer{
    display:none !important;
  }

  .dockMore{
    min-height:40px !important;
    padding:0 14px !important;
    border-radius:14px !important;
  }

  .dockPanelInline{
    max-height:none !important;
    overflow:visible !important;
    padding-bottom:0 !important;
    scroll-padding-bottom:0 !important;
  }

  .commandDeck__helper--actions{
    display:none !important;
  }

  .dockFilterBar{
    display:flex !important;
    flex-wrap:nowrap !important;
    gap:8px !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    padding-bottom:2px !important;
    -webkit-overflow-scrolling:touch !important;
  }

  .dockPill{
    flex:0 0 auto !important;
    min-width:max-content !important;
  }

  .dockListInline,
  .dockSuggestList{
    display:grid !important;
    gap:10px !important;
  }

  .dockCard,
  .dockSlot,
  .dockSlot .wrap,
  .dockSlot .candidate,
  .dockSlot .candidateCard{
    width:100% !important;
  }
}

/* =========================
   FINAL mobile command lens / stage emergency override
   ========================= */
@media (max-width: 720px){
  .commandDeckBackdrop,
  .messageStageSheetBackdrop{
    align-items:flex-end !important;
    padding:0 !important;
    background:rgba(4,8,18,.72) !important;
  }

  .commandDeck,
  .messageStageSheet{
    width:100% !important;
    max-width:none !important;
    height:min(86vh, 860px) !important;
    max-height:min(86vh, 860px) !important;
    min-height:68vh !important;
    margin:0 !important;
    border-radius:22px 22px 0 0 !important;
    padding:12px 12px calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
    display:grid !important;
    grid-template-rows:auto auto minmax(0,1fr) !important;
    gap:10px !important;
    overflow:hidden !important;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    position:static !important;
    top:auto !important;
    margin:0 !important;
    padding:0 0 2px !important;
    background:transparent !important;
    border:0 !important;
    backdrop-filter:none !important;
  }

  .commandDeck__title,
  .messageStageSheet__title,
  .commandDeck__head strong,
  .messageStageSheet__head strong{
    font-size:28px !important;
    line-height:1.2 !important;
  }

  .commandDeck__hint,
  .messageStageSheet__hint{
    font-size:13px !important;
    line-height:1.55 !important;
    margin-top:4px !important;
  }

  .commandDeck__tabs,
  .messageStageSheetTabs,
  .dockBarInline,
  .dockFilterBar,
  .conversationSearchRail__actions{
    display:flex !important;
    flex-wrap:nowrap !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    gap:8px !important;
    -webkit-overflow-scrolling:touch !important;
    scrollbar-width:none !important;
  }
  .commandDeck__tabs::-webkit-scrollbar,
  .messageStageSheetTabs::-webkit-scrollbar,
  .dockBarInline::-webkit-scrollbar,
  .dockFilterBar::-webkit-scrollbar,
  .conversationSearchRail__actions::-webkit-scrollbar{display:none !important;}

  .commandDeck__tabs,
  .messageStageSheetTabs{
    position:static !important;
    top:auto !important;
    margin:0 !important;
    padding:0 0 2px !important;
    background:transparent !important;
    border:0 !important;
    backdrop-filter:none !important;
  }

  .commandDeck__tab,
  .messageStageSheetTabs__tab,
  .dockTab,
  .dockPill,
  .conversationSearchRail__chip{
    flex:0 0 auto !important;
    white-space:nowrap !important;
    min-height:38px !important;
  }

  .commandDeck__close,
  .messageStageSheet__close{
    appearance:none !important;
    -webkit-appearance:none !important;
    border:1px solid rgba(255,255,255,.14) !important;
    background:rgba(255,255,255,.06) !important;
    color:#fff !important;
    border-radius:999px !important;
    min-height:36px !important;
    padding:0 12px !important;
    box-shadow:none !important;
  }

  .commandDeck__panel,
  .messageStageSheetBody{
    min-height:0 !important;
    height:auto !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    padding:0 0 4px !important;
    overscroll-behavior:contain !important;
  }

  .commandDeck__panel--actions,
  .dockWrapInline,
  .dockPanelInline{
    min-height:0 !important;
    height:auto !important;
    max-height:none !important;
    overflow:visible !important;
  }

  .commandDeck__helper,
  .commandDeck__helper--actions{
    display:none !important;
  }

  .conversationSearchRail,
  .dockPanel,
  .dockCard,
  .messageStageSheetCard,
  .messageStageSheetMiniStack__card{
    border-radius:18px !important;
  }

  .conversationSearchRail__inputWrap{
    display:grid !important;
    grid-template-columns:1fr !important;
    gap:10px !important;
  }

  .conversationSearchRail__submit{
    width:100% !important;
    min-height:46px !important;
  }

  .dockGrid,
  .dockSuggestList,
  .messageStageSheetBody{
    gap:10px !important;
  }

  .dockListInline,
  .dockSuggestList,
  .messageStageSheetMiniStack{
    display:grid !important;
    gap:10px !important;
  }

  .dockCard,
  .messageStageSheetCard,
  .messageStageSheetMiniStack__card{
    padding:14px !important;
  }
}


/* =========================
   v5: mobile command lens action panel real height fix
   ========================= */
@media (max-width: 720px){
  .commandDeck__close,
  .messageStageSheet__close{
    appearance:none !important;
    -webkit-appearance:none !important;
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    align-self:flex-start !important;
    min-width:72px !important;
    min-height:40px !important;
    padding:0 16px !important;
    border-radius:999px !important;
    border:1px solid rgba(255,255,255,.16) !important;
    background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.06)) !important;
    color:#fff !important;
    font:inherit !important;
    font-size:14px !important;
    font-weight:800 !important;
    line-height:1 !important;
    letter-spacing:-.01em !important;
    box-shadow:0 10px 24px rgba(0,0,0,.22) !important;
    text-shadow:none !important;
    cursor:pointer !important;
  }

  .commandDeck__panel--actions{
    display:flex !important;
    flex-direction:column !important;
    min-height:0 !important;
  }

  .dockWrapInline{
    display:flex !important;
    flex-direction:column !important;
    flex:1 1 auto !important;
    min-height:0 !important;
    gap:10px !important;
  }

  .dockBarInline{
    flex:0 0 auto !important;
  }

  .dockPanelInline{
    display:flex !important;
    flex-direction:column !important;
    flex:1 1 auto !important;
    min-height:0 !important;
    height:100% !important;
    max-height:none !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    padding:0 2px 8px 0 !important;
    -webkit-overflow-scrolling:touch !important;
  }

  .dockGrid,
  .dockSuggestList,
  .dockListInline{
    display:grid !important;
    align-content:start !important;
    gap:10px !important;
    min-height:0 !important;
  }

  .dockFilterBar{
    flex:0 0 auto !important;
    margin-bottom:2px !important;
  }

  .commandDeck__helper,
  .commandDeck__helper--actions{
    display:none !important;
  }
}


/* =========================
   v6: actual mounted mobile overrides
   ========================= */
@media (max-width: 720px){
  .commandDeckBackdrop,
  .messageStageSheetBackdrop{
    display:flex !important;
    align-items:flex-end !important;
    justify-content:stretch !important;
    padding:0 !important;
  }

  .commandDeck,
  .messageStageSheet{
    left:0 !important;
    right:0 !important;
    bottom:0 !important;
    width:100% !important;
    max-width:none !important;
    min-height:72dvh !important;
    height:84dvh !important;
    max-height:84dvh !important;
    margin:0 !important;
    padding:12px 12px calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
    display:grid !important;
    grid-template-rows:auto auto minmax(0, 1fr) !important;
    gap:10px !important;
    border-radius:22px 22px 0 0 !important;
    overflow:hidden !important;
  }

  .commandDeck__head,
  .messageStageSheet__head{
    display:grid !important;
    grid-template-columns:minmax(0,1fr) auto !important;
    align-items:start !important;
    column-gap:10px !important;
    margin:0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
  }

  .commandDeck__head > div,
  .messageStageSheet__head > div{
    min-width:0 !important;
  }

  .commandDeck__close,
  .messageStageSheet__close{
    appearance:none !important;
    -webkit-appearance:none !important;
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    align-self:flex-start !important;
    margin:0 !important;
    min-width:76px !important;
    height:40px !important;
    padding:0 14px !important;
    border-radius:999px !important;
    border:1px solid rgba(255,255,255,.14) !important;
    background:linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06)) !important;
    color:#fff !important;
    box-shadow:0 10px 24px rgba(0,0,0,.22) !important;
    font-family:inherit !important;
    font-size:13px !important;
    font-weight:800 !important;
    line-height:1 !important;
    letter-spacing:-0.01em !important;
    text-shadow:none !important;
  }

  .commandDeck__tabs,
  .messageStageSheetTabs{
    display:flex !important;
    flex-wrap:nowrap !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    gap:8px !important;
    margin:0 !important;
    padding:0 0 2px !important;
    background:transparent !important;
    border:0 !important;
  }

  .commandDeck__panel,
  .messageStageSheetBody{
    min-height:0 !important;
    height:100% !important;
    display:flex !important;
    flex-direction:column !important;
    overflow:hidden !important;
    padding:0 !important;
  }

  .commandDeck__panel--actions{
    min-height:0 !important;
    flex:1 1 auto !important;
  }

  .dockWrapInline{
    display:flex !important;
    flex-direction:column !important;
    flex:1 1 auto !important;
    min-height:0 !important;
    gap:10px !important;
  }

  .dockBarInline{
    flex:0 0 auto !important;
    display:grid !important;
    grid-template-columns:1fr 1fr auto !important;
    gap:8px !important;
    padding:0 !important;
    margin:0 !important;
    background:transparent !important;
    border:0 !important;
  }

  .dockPanelInline{
    flex:1 1 auto !important;
    min-height:0 !important;
    height:auto !important;
    display:block !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    padding:0 2px 8px 0 !important;
    margin:0 !important;
    max-height:none !important;
    -webkit-overflow-scrolling:touch !important;
  }

  .commandDeck__helper--actions{
    display:none !important;
  }

  .dockFilterBar{
    display:flex !important;
    flex-wrap:nowrap !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    gap:8px !important;
    margin:0 0 8px !important;
    padding:0 0 2px !important;
  }

  .dockGrid,
  .dockSuggestList,
  .dockListInline{
    display:grid !important;
    align-content:start !important;
    gap:10px !important;
    min-height:0 !important;
  }
}
@media (max-width: 720px){
  .composerUtilityBar{
    gap:6px !important;
    margin-bottom:6px !important;
    flex-wrap:nowrap !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    padding-bottom:2px !important;
    scrollbar-width:none !important;
  }

  .composerUtilityBar::-webkit-scrollbar{display:none !important;}

  .composerUtilityBar__pill{
    flex:0 0 auto !important;
    min-height:34px !important;
    padding:0 10px !important;
    gap:6px !important;
  }

  .composerUtilityBar__pillTag{
    min-width:24px !important;
    height:20px !important;
    padding:0 7px !important;
    font-size:9px !important;
  }

  .composerUtilityBar__pill strong{
    max-width:92px !important;
    font-size:11px !important;
  }

  .commandDeck{
    min-height:78dvh !important;
    height:88dvh !important;
    max-height:88dvh !important;
    padding:10px 10px calc(env(safe-area-inset-bottom, 0px) + 12px) !important;
    gap:8px !important;
  }

  .commandDeck__eyebrow{
    font-size:10px !important;
    letter-spacing:.12em !important;
  }

  .commandDeck__head strong,
  .messageStageSheet__head strong{
    font-size:20px !important;
  }

  .commandDeck__close,
  .messageStageSheet__close{
    min-width:40px !important;
    width:40px !important;
    padding:0 !important;
    font-size:16px !important;
  }

  .commandDeck__tab{
    min-height:34px !important;
    padding:0 11px !important;
    gap:6px !important;
  }

  .commandDeck__tab small{
    display:none !important;
  }

  .conversationSearchRail{
    padding:12px !important;
  }

  .conversationSearchRail__meta{
    display:grid !important;
    gap:8px !important;
  }

  .conversationSearchRail__summary{
    font-size:11px !important;
  }

  .dockBarInline{
    grid-template-columns:1fr 1fr auto !important;
    gap:6px !important;
  }

  .dockTab,
  .dockPill,
  .conversationSearchRail__chip{
    min-height:34px !important;
    padding:0 10px !important;
    font-size:11px !important;
  }

  .dockPanelInline{
    padding-right:0 !important;
  }

  .dockCard{
    padding:11px !important;
  }

  .dockCardTitle{
    font-size:13px !important;
  }

  .dockCardMeta,
  .dockCardHint{
    font-size:11px !important;
  }

  .dockSuggestList__head{
    display:none !important;
  }

  .dockSlot :deep(.wrap),
  .dockSlot :deep(.card){
    border-radius:16px !important;
  }

  .sessionHub__head,
  .sessionHub__sectionHead{
    gap:8px !important;
  }
}



/* stage-11 compact rhythm */
.sessionHub{gap:10px;margin:0 0 10px;padding:11px 12px;border-radius:20px}
.sessionHub__head{gap:8px}.sessionHub__stack{gap:12px}.sessionHub__section{gap:8px}.sessionHub__section--featured{padding-bottom:2px}.sessionHub__sectionHead{gap:8px}.sessionHub__sectionHead span{min-height:22px;padding:0 8px;font-size:10px}.sessionHub__compactList{gap:8px}.sessionHub__historyActions{gap:6px}
.dockCard{padding:10px 11px !important;border-radius:16px !important}.dockCardTitle{font-size:13px !important}.dockCardMeta{font-size:11px !important;gap:5px !important}.dockCardHint{margin-top:2px !important;font-size:11px !important;line-height:1.32 !important;color:rgba(226,232,255,.56) !important}
.composerUtilityBar{gap:6px;margin-bottom:6px}.composerUtilityBar__pill{gap:6px;min-height:34px;padding:0 10px}.composerUtilityBar__pillTag{min-width:24px;height:20px;padding:0 6px}.composerUtilityBar__pill strong{font-size:11px;max-width:110px}
.commandDeck__tabs{gap:6px}.commandDeck__tab{gap:5px;min-height:34px;padding:0 10px}.commandDeck__tab span{font-size:14px}.commandDeck__tab small{font-size:10px}
.conversationSearchRail__actions{gap:6px}.conversationSearchRail__chip{min-height:30px;padding:0 10px}.conversationSearchRail__submit{min-width:38px;padding-inline:10px}
.messageStageSheet__head{gap:8px}.messageStageSheetTabs{gap:6px}.messageStageSheetTabs__tab{gap:5px;min-height:32px;padding:0 10px}.messageStageSheetBody{gap:8px}.messageStageSheetCard{gap:5px;padding:11px 12px;border-radius:15px}.messageStageSheetCard__tag{min-width:28px;height:20px;padding:0 7px}.messageStageSheetCard strong{font-size:13px}.messageStageSheetEmpty{padding:12px;border-radius:15px}
@media (max-width:720px){
  .sessionHub{gap:8px;margin:0 0 8px;padding:9px 10px;border-radius:18px}
  .sessionHub__sectionHead strong{font-size:12px}
  .sessionHub__sectionHead span{min-height:20px;padding:0 7px;font-size:9px}
  .dockCard{padding:9px 10px !important;border-radius:14px !important}
  .dockCardHint{display:none}
  .composerUtilityBar{gap:5px;margin-bottom:5px}
  .composerUtilityBar__pill{gap:5px;min-height:32px;padding:0 9px}
  .composerUtilityBar__pill strong{max-width:72px}
  .commandDeck__tabs{gap:5px}
  .commandDeck__tab{min-height:32px;padding:0 9px}
  .commandDeck__tab small{display:none}
  .messageStageSheetTabs__tab{min-height:30px;padding:0 9px}
  .messageStageSheetCard{padding:10px 11px;border-radius:14px}
}


/* =========================
   hotfix: action deck vertical tab recovery
   ========================= */
.commandDeck__tabs{
  display:flex !important;
  flex-direction:row !important;
  align-items:center !important;
  justify-content:flex-start !important;
  flex-wrap:nowrap !important;
  gap:6px !important;
  height:auto !important;
  min-height:0 !important;
  max-height:38px !important;
  margin:0 0 8px !important;
  padding:0 2px 4px !important;
  overflow-x:auto !important;
  overflow-y:hidden !important;
  background:transparent !important;
  border:0 !important;
  scrollbar-width:none !important;
}
.commandDeck__tabs::-webkit-scrollbar{display:none !important;}
.commandDeck__tab{
  flex:0 0 auto !important;
  align-self:center !important;
  width:auto !important;
  min-width:54px !important;
  height:34px !important;
  min-height:34px !important;
  max-height:34px !important;
  padding:0 10px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
}
.commandDeck__panel--actions{
  display:flex !important;
  flex-direction:column !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.commandDeck__panel--actions .dockWrapInline{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.commandDeck__panel--actions .dockPanelInline{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 18px) !important;
}
@media (max-width:720px){
  .commandDeck{
    display:flex !important;
    flex-direction:column !important;
    height:min(78dvh, 720px) !important;
    min-height:0 !important;
    max-height:min(78dvh, 720px) !important;
  }
  .commandDeck__head{
    flex:0 0 auto !important;
    position:static !important;
    margin:0 0 8px !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
  }
  .commandDeck__tabs{
    flex:0 0 auto !important;
    align-items:center !important;
    max-height:36px !important;
    margin:0 0 8px !important;
    padding:0 0 2px !important;
  }
  .commandDeck__panel{
    flex:1 1 auto !important;
    min-height:0 !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
    padding:0 !important;
  }
  .commandDeck__tab small{display:none !important;}
}


/* =========================
   FINAL: centered mobile sheet and readable deck tabs
   - Teleported Lens/Stage sheets were escaping the phone frame on desktop/device preview.
   - Keep the sheet centered and constrain it to the app width.
   - Force tab bars back to compact horizontal chips.
   ========================= */
.commandDeckBackdrop,
.messageStageSheetBackdrop{
  position:fixed !important;
  inset:0 !important;
  z-index:var(--z-sheet-backdrop, 100160) !important;
  display:flex !important;
  align-items:flex-end !important;
  justify-content:center !important;
  padding:0 !important;
  background:rgba(4,8,18,.72) !important;
  backdrop-filter:blur(12px) !important;
  overflow:hidden !important;
}

.commandDeck,
.messageStageSheet{
  position:relative !important;
  left:auto !important;
  right:auto !important;
  bottom:auto !important;
  z-index:var(--z-sheet, 100170) !important;
  width:min(100vw, 430px) !important;
  max-width:430px !important;
  min-width:0 !important;
  height:min(82dvh, 760px) !important;
  min-height:0 !important;
  max-height:min(82dvh, 760px) !important;
  margin:0 auto !important;
  padding:12px 12px calc(env(safe-area-inset-bottom, 0px) + 14px) !important;
  display:grid !important;
  grid-template-rows:auto auto minmax(0, 1fr) !important;
  gap:10px !important;
  border-radius:22px 22px 0 0 !important;
  border:1px solid rgba(255,255,255,.08) !important;
  background:linear-gradient(180deg, rgba(8,13,29,.985), rgba(6,10,20,.99)) !important;
  box-shadow:0 -24px 56px rgba(0,0,0,.42) !important;
  overflow:hidden !important;
}

.commandDeck__head,
.messageStageSheet__head{
  position:static !important;
  display:grid !important;
  grid-template-columns:minmax(0, 1fr) auto !important;
  align-items:start !important;
  gap:10px !important;
  margin:0 !important;
  padding:0 !important;
  background:transparent !important;
  border:0 !important;
  box-shadow:none !important;
}
.commandDeck__head > div,
.messageStageSheet__head > div{min-width:0 !important;}
.commandDeck__eyebrow{font-size:10px !important;line-height:1.1 !important;letter-spacing:.12em !important;color:rgba(226,232,255,.62) !important;}
.commandDeck__head strong,
.messageStageSheet__head strong{font-size:20px !important;line-height:1.2 !important;}
.commandDeck__close,
.messageStageSheet__close{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  width:40px !important;
  min-width:40px !important;
  height:40px !important;
  min-height:40px !important;
  padding:0 !important;
  border-radius:999px !important;
  border:1px solid rgba(255,255,255,.14) !important;
  background:rgba(255,255,255,.08) !important;
  color:#fff !important;
  font-size:16px !important;
  line-height:1 !important;
  box-shadow:none !important;
}

.commandDeck__tabs,
.messageStageSheetTabs{
  position:static !important;
  display:flex !important;
  flex-direction:row !important;
  align-items:center !important;
  justify-content:flex-start !important;
  flex-wrap:nowrap !important;
  gap:6px !important;
  width:100% !important;
  height:auto !important;
  min-height:34px !important;
  max-height:38px !important;
  margin:0 !important;
  padding:0 0 2px !important;
  overflow-x:auto !important;
  overflow-y:hidden !important;
  background:transparent !important;
  border:0 !important;
  scrollbar-width:none !important;
  -webkit-overflow-scrolling:touch !important;
}
.commandDeck__tabs::-webkit-scrollbar,
.messageStageSheetTabs::-webkit-scrollbar{display:none !important;}
.commandDeck__tab,
.messageStageSheetTabs__tab{
  flex:0 0 auto !important;
  align-self:center !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:5px !important;
  width:auto !important;
  min-width:46px !important;
  max-width:none !important;
  height:34px !important;
  min-height:34px !important;
  max-height:34px !important;
  padding:0 10px !important;
  border-radius:12px !important;
  white-space:nowrap !important;
  writing-mode:horizontal-tb !important;
}
.commandDeck__tab small,
.messageStageSheetTabs__tab small{display:none !important;}

.commandDeck__panel,
.messageStageSheetBody{
  min-height:0 !important;
  height:auto !important;
  display:block !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding:0 2px calc(env(safe-area-inset-bottom, 0px) + 8px) !important;
  overscroll-behavior:contain !important;
  -webkit-overflow-scrolling:touch !important;
}
.commandDeck__panel--actions{
  display:flex !important;
  flex-direction:column !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.commandDeck__panel--actions .dockWrapInline{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.commandDeck__panel--actions .dockPanelInline{
  flex:1 1 auto !important;
  min-height:0 !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding:0 0 calc(env(safe-area-inset-bottom, 0px) + 18px) !important;
}
.commandDeck__panel--actions .dockBarInline{
  flex:0 0 auto !important;
  display:grid !important;
  grid-template-columns:1fr 1fr auto !important;
  gap:6px !important;
  margin:0 0 8px !important;
}
.commandDeck__panel--actions .dockTab,
.commandDeck__panel--actions .dockMore{
  min-height:34px !important;
  height:34px !important;
  padding:0 10px !important;
  border-radius:12px !important;
  font-size:11px !important;
}
.commandDeck__panel--actions .dockFilterBar{
  display:flex !important;
  flex-wrap:nowrap !important;
  gap:6px !important;
  overflow-x:auto !important;
  overflow-y:hidden !important;
  margin:0 0 8px !important;
  padding:0 0 2px !important;
  scrollbar-width:none !important;
}
.commandDeck__panel--actions .dockFilterBar::-webkit-scrollbar{display:none !important;}
.commandDeck__panel--actions .dockActiveList,
.commandDeck__panel--actions .dockSuggestionList,
.messageStageSheetMiniStack{
  display:grid !important;
  grid-template-columns:1fr !important;
  gap:10px !important;
}

@media (min-width:721px){
  .commandDeck,
  .messageStageSheet{
    width:min(720px, calc(100vw - 32px)) !important;
    max-width:720px !important;
    height:min(78dvh, 760px) !important;
    max-height:min(78dvh, 760px) !important;
  }
}

@media (max-width:720px){
  .commandDeck,
  .messageStageSheet{
    width:min(100vw, 430px) !important;
    max-width:430px !important;
    height:min(82dvh, 760px) !important;
    max-height:min(82dvh, 760px) !important;
  }
}

</style>

<style>
/* =========================
   FINAL OVERRIDE: command lens / stage sheet stable layout
   - Keep the sheet centered on desktop and inside the phone viewport on mobile.
   - Stop tab buttons from stretching into vertical columns.
   ========================= */
.commandDeckBackdrop,
.messageStageSheetBackdrop{
  position:fixed !important;
  inset:0 !important;
  z-index:var(--z-sheet-backdrop, 1000) !important;
  display:flex !important;
  align-items:flex-end !important;
  justify-content:center !important;
  padding:0 12px !important;
  background:rgba(4,8,18,.72) !important;
  backdrop-filter:blur(10px) !important;
  overflow:hidden !important;
}

.commandDeck,
.messageStageSheet{
  position:relative !important;
  left:auto !important;
  right:auto !important;
  bottom:auto !important;
  transform:none !important;
  width:min(430px, 100%) !important;
  max-width:min(430px, calc(100vw - 24px)) !important;
  min-width:0 !important;
  height:min(82dvh, 760px) !important;
  min-height:min(560px, 82dvh) !important;
  max-height:min(82dvh, 760px) !important;
  margin:0 auto !important;
  padding:12px 12px calc(14px + env(safe-area-inset-bottom, 0px)) !important;
  display:grid !important;
  grid-template-rows:auto auto minmax(0, 1fr) !important;
  gap:10px !important;
  border-radius:22px 22px 0 0 !important;
  overflow:hidden !important;
  box-sizing:border-box !important;
}

.commandDeck__head,
.messageStageSheet__head{
  position:relative !important;
  display:grid !important;
  grid-template-columns:minmax(0, 1fr) auto !important;
  align-items:start !important;
  gap:10px !important;
  margin:0 !important;
  padding:0 !important;
  background:transparent !important;
  border:0 !important;
  min-width:0 !important;
}

.commandDeck__head > div,
.messageStageSheet__head > div{min-width:0 !important;}
.commandDeck__eyebrow,
.messageStageSheet__eyebrow{font-size:10px !important;line-height:1.1 !important;opacity:.72 !important;}
.commandDeck__head strong,
.messageStageSheet__head strong,
.commandDeck__title,
.messageStageSheet__title{
  display:block !important;
  min-width:0 !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
  font-size:20px !important;
  line-height:1.25 !important;
}
.commandDeck__hint,
.messageStageSheet__hint{display:none !important;}

.commandDeck__close,
.messageStageSheet__close{
  appearance:none !important;
  -webkit-appearance:none !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  flex:0 0 auto !important;
  align-self:start !important;
  width:40px !important;
  min-width:40px !important;
  height:40px !important;
  min-height:40px !important;
  padding:0 !important;
  border-radius:999px !important;
  border:1px solid rgba(255,255,255,.14) !important;
  background:rgba(255,255,255,.08) !important;
  color:#fff !important;
  font-size:18px !important;
  font-weight:800 !important;
  line-height:1 !important;
  box-shadow:0 10px 24px rgba(0,0,0,.22) !important;
}

.commandDeck__tabs,
.messageStageSheetTabs{
  position:relative !important;
  top:auto !important;
  z-index:auto !important;
  display:flex !important;
  flex-direction:row !important;
  align-items:center !important;
  justify-content:flex-start !important;
  flex-wrap:nowrap !important;
  gap:8px !important;
  width:100% !important;
  min-width:0 !important;
  min-height:38px !important;
  max-height:42px !important;
  margin:0 !important;
  padding:0 0 2px !important;
  overflow-x:auto !important;
  overflow-y:hidden !important;
  background:transparent !important;
  border:0 !important;
  scrollbar-width:none !important;
  box-sizing:border-box !important;
}
.commandDeck__tabs::-webkit-scrollbar,
.messageStageSheetTabs::-webkit-scrollbar{display:none !important;}

.commandDeck__tab,
.messageStageSheetTabs__tab{
  appearance:none !important;
  -webkit-appearance:none !important;
  flex:0 0 auto !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:6px !important;
  width:auto !important;
  min-width:42px !important;
  max-width:none !important;
  height:36px !important;
  min-height:36px !important;
  max-height:36px !important;
  padding:0 12px !important;
  border-radius:13px !important;
  line-height:1 !important;
  white-space:nowrap !important;
  box-sizing:border-box !important;
}
.commandDeck__tab small,
.messageStageSheetTabs__tab small{display:none !important;}

.commandDeck__panel,
.messageStageSheetBody{
  min-width:0 !important;
  min-height:0 !important;
  height:100% !important;
  max-height:none !important;
  display:block !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  padding:0 2px calc(6px + env(safe-area-inset-bottom, 0px)) 0 !important;
  overscroll-behavior:contain !important;
  -webkit-overflow-scrolling:touch !important;
}

.commandDeck__panel--actions{display:flex !important;flex-direction:column !important;}
.commandDeck__panel--actions > .dockWrapInline{flex:1 1 auto !important;min-height:0 !important;height:100% !important;}

@media (min-width:721px){
  .commandDeckBackdrop,
  .messageStageSheetBackdrop{padding:0 20px !important;}
  .commandDeck,
  .messageStageSheet{
    width:min(520px, calc(100vw - 40px)) !important;
    max-width:520px !important;
    height:min(78dvh, 720px) !important;
    min-height:520px !important;
    max-height:min(78dvh, 720px) !important;
  }
}

@media (max-width:720px){
  .commandDeckBackdrop,
  .messageStageSheetBackdrop{padding:0 !important;}
  .commandDeck,
  .messageStageSheet{
    width:100vw !important;
    max-width:100vw !important;
    height:min(82dvh, calc(100dvh - 72px)) !important;
    min-height:min(520px, calc(100dvh - 72px)) !important;
    max-height:min(82dvh, calc(100dvh - 72px)) !important;
  }
}


/* =========================
   Conversation UX cleanup patch
   - compact chat header
   - stable bottom composer
   ========================= */
.topbar{
  position:sticky;
  top:0;
  z-index:70;
  min-height:58px;
  padding:8px 12px;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
  border-bottom:1px solid color-mix(in oklab,var(--border) 84%,transparent);
  background:color-mix(in oklab,var(--bg) 92%,transparent);
  backdrop-filter:blur(16px);
}
.topbar .peer{
  min-width:0;
  min-height:44px;
  padding:6px 8px;
  border:0;
  border-radius:14px;
  background:transparent;
  display:flex;
  align-items:center;
  gap:9px;
  text-align:left;
  cursor:pointer;
}
.topbar .peer:hover{background:rgba(255,255,255,.04)}
.topbar .peerAva{
  width:34px;
  height:34px;
  border-radius:50%;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  font-weight:950;
  color:#08111f;
  background:linear-gradient(135deg,color-mix(in oklab,var(--accent) 70%,white),color-mix(in oklab,var(--success) 72%,white));
}
.topbar .peerMeta{min-width:0;display:grid;gap:1px}
.topbar .peerName{font-size:15px;font-weight:950;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}
.topbar .peerHandle{font-size:11px;font-weight:800;line-height:1.15;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.topbar .right{display:flex;align-items:center;gap:6px;justify-content:flex-end;min-width:0}
.topbar .right :deep(button){min-width:38px;padding-inline:10px;border-radius:999px;white-space:nowrap}
.composerWrap{
  position:sticky;
  bottom:0;
  z-index:80;
  padding:8px 10px calc(8px + env(safe-area-inset-bottom));
  max-width:760px;
  margin:0 auto;
  width:100%;
  background:linear-gradient(180deg,rgba(10,16,30,.72),rgba(10,16,30,.96));
  border-top:1px solid color-mix(in oklab,var(--border) 88%,transparent);
  backdrop-filter:blur(16px);
}
@media (max-width:640px){
  .topbar{min-height:56px;padding:7px 10px;gap:7px}
  .topbar .peer{min-height:42px;padding:5px 7px}
  .topbar .peerAva{width:32px;height:32px}
  .topbar .peerName{font-size:14px}
  .topbar .peerHandle{font-size:10px}
  .composerWrap{padding:7px 9px calc(7px + env(safe-area-inset-bottom))}
}
</style>
