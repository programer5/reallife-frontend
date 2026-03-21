import { ref } from "vue";
import { createCapsule, fetchConversationCapsules, deleteCapsule } from "@/api/capsules";

export function useConversationCapsules(options) {
  const {
    conversationId,
    content,
    attachedFiles,
    attachmentUploading,
    attachmentProgress,
    attachmentError,
    clearAttachments,
    uploadFiles,
    sendMessage,
    lockEnabled,
    unlocked,
    unlockToken,
    toast,
    pendingAction,
    pendingActionPrimed,
    primePendingAction,
    bumpPendingHighlight,
  } = options;

  const capsuleItems = ref([]);
  const capsuleLoading = ref(false);
  const capsuleModalOpen = ref(false);
  const capsuleTitle = ref("");
  const capsuleUnlockAt = ref("");
  const capsuleSaving = ref(false);

  async function refreshCapsules() {
    if (!conversationId.value) { capsuleItems.value = []; return; }
    capsuleLoading.value = true;
    try {
      const res = await fetchConversationCapsules(conversationId.value);
      capsuleItems.value = Array.isArray(res?.items) ? res.items : [];
    } catch {
      capsuleItems.value = [];
    } finally {
      capsuleLoading.value = false;
    }
  }

  async function deleteCapsuleItem(item) {
    const id = item?.capsuleId || item?.id;
    if (!id) return;
    const ok = window.confirm("이 타임 캡슐을 삭제할까요? 삭제 후 복구할 수 없어요.");
    if (!ok) return;
    try {
      await deleteCapsule(id);
      await refreshCapsules();
      toast.success?.("캡슐 삭제", "타임 캡슐을 삭제했어요.");
    } catch (e) {
      toast.error?.("캡슐 삭제 실패", e?.response?.data?.message || "잠시 후 다시 시도해 주세요.");
    }
  }

  function relayFromCapsule(payload) {
    try { sessionStorage.setItem("reallife:pendingAction", JSON.stringify(payload)); } catch {}
    pendingAction.value = payload;
    pendingActionPrimed.value = false;
    primePendingAction(true, true);
    bumpPendingHighlight();
    toast.success?.("액션 릴레이 준비", "캡슐 내용을 액션 제안으로 이어가고 있어요.");
  }

  function openCapsuleModal() {
    const base = String(content.value || "").trim();
    if (!base) {
      toast.info?.("타임 캡슐", "먼저 메시지를 입력한 뒤 ⏳ 버튼을 눌러 주세요.");
      return;
    }
    const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    capsuleTitle.value = base.slice(0, 30) || "나중에 열 메시지";
    capsuleUnlockAt.value = dt.toISOString().slice(0, 16);
    capsuleModalOpen.value = true;
  }

  function closeCapsuleModal() {
    capsuleModalOpen.value = false;
  }

  async function createTimeCapsuleFromDraft() {
    const text = String(content.value || "").trim();
    const hasAttachments = attachedFiles.value.length > 0;
    if (!text && !hasAttachments) return;

    const unlockDate = new Date(capsuleUnlockAt.value);
    if (Number.isNaN(unlockDate.getTime()) || unlockDate.getTime() <= Date.now()) {
      toast.info?.("타임 캡슐", "열릴 시간은 현재보다 이후로 설정해 주세요.");
      return;
    }

    capsuleSaving.value = true;
    try {
      let attachmentIds = [];
      if (hasAttachments) {
        attachmentUploading.value = true;
        attachmentProgress.value = 0;
        attachmentError.value = "";
        try {
          attachmentIds = await uploadFiles(attachedFiles.value.map((x) => x.file), {
            onProgress: (pct) => { attachmentProgress.value = Number(pct || 0); },
          });
        } catch (err) {
          attachmentError.value = err?.response?.data?.message || "첨부 업로드에 실패했어요.";
          throw err;
        } finally {
          attachmentUploading.value = false;
        }
      }

      const sent = await sendMessage({
        conversationId: conversationId.value,
        content: text,
        attachmentIds,
        unlockToken: lockEnabled.value && unlocked.value ? unlockToken.value : null,
      });
      await createCapsule({
        messageId: sent.messageId || sent.id,
        conversationId: conversationId.value,
        title: capsuleTitle.value || text.slice(0, 30) || "나중에 열 메시지",
        unlockAt: unlockDate.toISOString(),
      });
      content.value = "";
      clearAttachments();
      capsuleModalOpen.value = false;
      await refreshCapsules();
      toast.success?.("타임 캡슐 생성", hasAttachments ? "메시지와 첨부를 함께 타임 캡슐로 저장했어요." : "입력한 메시지를 나중에 열릴 캡슐로 저장했어요.");
    } catch (e) {
      toast.error?.("타임 캡슐 실패", e?.response?.data?.message || "타임 캡슐을 만들지 못했어요.");
    } finally {
      capsuleSaving.value = false;
    }
  }

  return {
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
  };
}
