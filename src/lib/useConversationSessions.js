import { computed, ref } from "vue";
import { createPlaybackSession, endPlaybackSession, fetchPlaybackSessions, updatePlaybackSessionState } from "@/api/playbackSessions";

export function useConversationSessions({ conversationId, toast }) {
  const sessions = ref([]);
  const loadingSessions = ref(false);
  const sessionError = ref("");
  const sessionModalOpen = ref(false);
  const sessionBusy = ref(false);
  const actionBusyById = ref({});

  const activeSessions = computed(() => sessions.value.filter((item) => item?.status === "ACTIVE"));
  const recentSessions = computed(() => sessions.value.filter((item) => item?.status !== "ACTIVE").slice(0, 4));

  function setActionBusy(sessionId, value) {
    const key = String(sessionId || "");
    actionBusyById.value = { ...actionBusyById.value, [key]: !!value };
  }

  function isActionBusy(sessionId) {
    return !!actionBusyById.value[String(sessionId || "")];
  }

  function openSessionModal() {
    sessionModalOpen.value = true;
  }

  function closeSessionModal() {
    sessionModalOpen.value = false;
  }

  function upsertSession(session) {
    if (!session?.sessionId) return;
    const key = String(session.sessionId);
    const idx = sessions.value.findIndex((item) => String(item?.sessionId) === key);
    if (idx >= 0) sessions.value[idx] = { ...sessions.value[idx], ...session };
    else sessions.value = [session, ...sessions.value];
    sessions.value = [...sessions.value].sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
  }

  async function loadSessions() {
    if (!conversationId.value) return;
    loadingSessions.value = true;
    sessionError.value = "";
    try {
      sessions.value = await fetchPlaybackSessions(conversationId.value);
    } catch (err) {
      sessionError.value = err?.response?.data?.message || "공동 플레이 세션을 불러오지 못했어요.";
    } finally {
      loadingSessions.value = false;
    }
  }

  async function createSession(form) {
    if (!conversationId.value || sessionBusy.value) return;
    sessionBusy.value = true;
    try {
      const created = await createPlaybackSession(conversationId.value, form);
      upsertSession(created);
      sessionModalOpen.value = false;
      toast?.success?.("공동 플레이 시작", "세션 카드가 생성됐어요.");
      return created;
    } catch (err) {
      toast?.error?.("세션 생성 실패", err?.response?.data?.message || "공동 플레이 세션을 만들지 못했어요.");
      throw err;
    } finally {
      sessionBusy.value = false;
    }
  }

  async function applySessionAction(sessionId, payload) {
    if (!conversationId.value || !sessionId || isActionBusy(sessionId)) return;
    setActionBusy(sessionId, true);
    try {
      const updated = await updatePlaybackSessionState(conversationId.value, sessionId, payload);
      upsertSession(updated);
      return updated;
    } catch (err) {
      toast?.error?.("세션 동기화 실패", err?.response?.data?.message || "재생 상태를 반영하지 못했어요.");
      throw err;
    } finally {
      setActionBusy(sessionId, false);
    }
  }

  async function endSession(sessionId, positionSeconds = 0) {
    if (!conversationId.value || !sessionId || isActionBusy(sessionId)) return;
    setActionBusy(sessionId, true);
    try {
      const updated = await endPlaybackSession(conversationId.value, sessionId, { positionSeconds });
      upsertSession(updated);
      toast?.info?.("세션 종료", "공동 플레이 세션을 마무리했어요.");
      return updated;
    } catch (err) {
      toast?.error?.("세션 종료 실패", err?.response?.data?.message || "세션을 종료하지 못했어요.");
      throw err;
    } finally {
      setActionBusy(sessionId, false);
    }
  }

  function handleSessionSse(type, payload) {
    if (String(payload?.conversationId || "") !== String(conversationId.value || "")) return false;
    if (type === "playback-session-created") {
      loadSessions();
      return true;
    }
    if (type === "playback-session-updated") {
      upsertSession({
        sessionId: payload?.sessionId,
        conversationId: payload?.conversationId,
        status: payload?.status,
        playbackState: payload?.playbackState,
        positionSeconds: payload?.positionSeconds,
        lastControlledAt: payload?.updatedAt,
        lastControlledBy: payload?.actorId,
      });
      return true;
    }
    if (type === "playback-session-ended") {
      upsertSession({
        sessionId: payload?.sessionId,
        conversationId: payload?.conversationId,
        status: "ENDED",
        playbackState: "PAUSED",
        positionSeconds: payload?.positionSeconds,
        endedAt: payload?.endedAt,
        lastControlledAt: payload?.endedAt,
        lastControlledBy: payload?.actorId,
      });
      return true;
    }
    return false;
  }

  return {
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
    endSession,
    isActionBusy,
    handleSessionSse,
  };
}
