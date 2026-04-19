import { computed, ref, watch } from "vue";
import {
  getConversationLock,
  setConversationLock,
  disableConversationLock,
  issueUnlockToken,
} from "@/api/conversationLock";

export function useConversationLockAccess({
  conversationId,
  router,
  toast,
  loadSessions,
  loadPins,
}) {
  const lockEnabled = ref(false);
  const unlocked = ref(false);
  const lockGatePw = ref("");

  const lockModalOpen = ref(false);
  const lockModalMode = ref("set");
  const lockPw1 = ref("");
  const lockPw2 = ref("");
  const unlockToken = ref("");

  function tokenKey() {
    return `conv_unlock_${conversationId.value}`;
  }

  function getSavedToken() {
    try {
      return sessionStorage.getItem(tokenKey()) || "";
    } catch {
      return "";
    }
  }

  function syncUnlockToken() {
    unlockToken.value = getSavedToken();
  }

  function saveToken(token) {
    const next = String(token || "").trim();
    try {
      sessionStorage.setItem(tokenKey(), next);
    } catch {}
    unlockToken.value = next;
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(tokenKey());
    } catch {}
    unlockToken.value = "";
  }

  const canViewConversation = computed(() => {
    if (!lockEnabled.value) return true;
    return !!unlocked.value;
  });

  watch(conversationId, () => {
    syncUnlockToken();
  }, { immediate: true });

  async function refreshLockState() {
    try {
      const res = await getConversationLock(conversationId.value);
      lockEnabled.value = !!res?.enabled;

      if (!lockEnabled.value) {
        unlocked.value = true;
        return;
      }
      syncUnlockToken();
      unlocked.value = !!unlockToken.value;
    } catch {
      lockEnabled.value = false;
      unlocked.value = true;
      clearToken();
    }
  }

  async function handleUnlockGate() {
    const pw = String(lockGatePw.value || "").trim();
    if (!pw) return;

    try {
      const res = await issueUnlockToken(conversationId.value, pw);
      if (!res?.token) throw new Error("no token");
      saveToken(res.token);
      lockGatePw.value = "";
      unlocked.value = true;

      await loadSessions?.();
      await loadPins?.();
    } catch (e) {
      toast.error?.("잠금 해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
    }
  }

  function openLockModal(mode) {
    lockModalMode.value = mode;
    lockPw1.value = "";
    lockPw2.value = "";
    lockModalOpen.value = true;
  }

  function closeLockModal() {
    lockModalOpen.value = false;
    lockPw1.value = "";
    lockPw2.value = "";
  }

  async function submitLockModal() {
    if (lockModalMode.value === "set") {
      const p1 = String(lockPw1.value || "").trim();
      const p2 = String(lockPw2.value || "").trim();

      if (p1.length < 4) {
        toast.error?.("설정 실패", "비밀번호는 최소 4자 이상으로 설정해 주세요.");
        return;
      }
      if (p1 !== p2) {
        toast.error?.("설정 실패", "비밀번호가 일치하지 않습니다.");
        return;
      }

      try {
        await setConversationLock(conversationId.value, p1);
        clearToken();
        lockEnabled.value = true;
        unlocked.value = false;
        toast.success?.("완료", "이 DM은 잠금 상태가 됐어요.");
        closeLockModal();
      } catch (e) {
        toast.error?.("설정 실패", e?.response?.data?.message || "잠금 설정에 실패했습니다.");
      }
      return;
    }

    const pw = String(lockPw1.value || "").trim();
    if (!pw) {
      toast.error?.("해제 실패", "비밀번호를 입력해 주세요.");
      return;
    }

    try {
      await disableConversationLock(conversationId.value, pw);
      lockEnabled.value = false;
      unlocked.value = true;
      clearToken();
      toast.success?.("완료", "잠금을 해제했습니다.");
      closeLockModal();

      await loadPins?.();
    } catch (e) {
      toast.error?.("해제 실패", e?.response?.data?.message || "비밀번호가 올바르지 않습니다.");
    }
  }

  function goBack() {
    router?.back?.();
  }

  return {
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
    goBack,
  };
}
