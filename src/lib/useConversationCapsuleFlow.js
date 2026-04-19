import { computed } from "vue";
import { useConversationCapsules } from "@/lib/useConversationCapsules";

function writableRefFromGetter(getRef, fallback) {
  return computed({
    get() {
      const ref = getRef?.();
      return ref ? ref.value : fallback;
    },
    set(value) {
      const ref = getRef?.();
      if (ref) ref.value = value;
    },
  });
}

export function useConversationCapsuleFlow(options) {
  const conversationId = computed(() => String(options.getConversationId?.() || ""));
  const content = writableRefFromGetter(options.getContentRef, "");
  const attachedFiles = writableRefFromGetter(options.getAttachedFilesRef, []);
  const attachmentUploading = writableRefFromGetter(options.getAttachmentUploadingRef, false);
  const attachmentProgress = writableRefFromGetter(options.getAttachmentProgressRef, 0);
  const attachmentError = writableRefFromGetter(options.getAttachmentErrorRef, "");
  const lockEnabled = computed(() => !!options.getLockEnabledRef?.()?.value);
  const unlocked = computed(() => !!options.getUnlockedRef?.()?.value);
  const unlockToken = computed(() => String(options.getUnlockTokenRef?.()?.value || ""));
  const pendingAction = writableRefFromGetter(options.getPendingActionRef, null);
  const pendingActionPrimed = writableRefFromGetter(options.getPendingActionPrimedRef, false);

  return useConversationCapsules({
    conversationId,
    content,
    attachedFiles,
    attachmentUploading,
    attachmentProgress,
    attachmentError,
    clearAttachments: (...args) => options.clearAttachments?.()?.(...args),
    uploadFiles: (...args) => options.uploadFiles?.()?.(...args),
    sendMessage: (...args) => options.sendMessage?.()?.(...args),
    lockEnabled,
    unlocked,
    unlockToken,
    toast: options.toast,
    pendingAction,
    pendingActionPrimed,
    primePendingAction: (...args) => options.primePendingAction?.()?.(...args),
    bumpPendingHighlight: (...args) => options.bumpPendingHighlight?.()?.(...args),
  });
}
