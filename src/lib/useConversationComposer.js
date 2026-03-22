import { nextTick, onBeforeUnmount, ref } from "vue";

const MAX_ATTACHMENTS = 8;
const IMAGE_MAX_MB = 15;
const VIDEO_MAX_MB = 80;
const FILE_MAX_MB = 20;
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;
const FILE_MAX_BYTES = FILE_MAX_MB * 1024 * 1024;

export function useConversationComposer(options) {
  const {
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
    items,
    newMsgCount,
    scrollToBottom,
    syncComposerHeightVar,
    openSuggestionsDock,
    triggerDockPulse,
    hasMessage,
    upsertServerMessage,
  } = options;

  const content = ref("");
  const sending = ref(false);
  const attachedFiles = ref([]);
  const attachmentUploading = ref(false);
  const attachmentProgress = ref(0);
  const attachmentError = ref("");
  const fileInputRef = ref(null);

  const pendingAction = ref(null);
  const pendingActionPrimed = ref(false);
  const pendingActionTempId = ref(null);
  const pendingHighlight = ref(false);

  function bumpPendingHighlight() {
    pendingHighlight.value = true;
    setTimeout(() => { pendingHighlight.value = false; }, 1400);
  }

  function attachmentKind(file) {
    const type = String(file?.type || file?.contentType || "").toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    return "file";
  }

  function maxBytesFor(file) {
    const kind = attachmentKind(file);
    if (kind === "image") return IMAGE_MAX_BYTES;
    if (kind === "video") return VIDEO_MAX_BYTES;
    return FILE_MAX_BYTES;
  }

  function maxMbLabelFor(file) {
    const kind = attachmentKind(file);
    if (kind === "image") return IMAGE_MAX_MB;
    if (kind === "video") return VIDEO_MAX_MB;
    return FILE_MAX_MB;
  }

  function previewUrlFor(file) {
    try { return URL.createObjectURL(file); } catch { return ""; }
  }

  function normalizePickedFiles(fileList) {
    return Array.from(fileList || []).map((file) => ({
      file,
      name: file.name || "첨부파일",
      size: Number(file.size || 0),
      type: file.type || "",
      kind: attachmentKind(file),
      previewUrl: previewUrlFor(file),
    }));
  }

  function revokePreview(item) {
    if (item?.previewUrl && String(item.previewUrl).startsWith("blob:")) {
      try { URL.revokeObjectURL(item.previewUrl); } catch {}
    }
  }

  function openAttachmentPicker() {
    fileInputRef.value?.click?.();
  }

  function removeAttachedFile(index) {
    const item = attachedFiles.value[index];
    revokePreview(item);
    attachedFiles.value.splice(index, 1);
    attachmentError.value = "";
  }

  function clearAttachments() {
    for (const item of attachedFiles.value) revokePreview(item);
    attachedFiles.value = [];
    attachmentError.value = "";
    attachmentProgress.value = 0;
  }

  function onPickFiles(e) {
    const list = e?.target?.files;
    if (!list || !list.length) return;

    const incoming = normalizePickedFiles(list);
    const remaining = MAX_ATTACHMENTS - attachedFiles.value.length;
    if (remaining <= 0) {
      toast.info?.("첨부 제한", `최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있어요.`);
      if (e?.target) e.target.value = "";
      return;
    }

    const accepted = [];
    for (const item of incoming) {
      if (accepted.length >= remaining) break;
      const maxBytes = maxBytesFor(item.file);
      if (Number(item.size || 0) > maxBytes) {
        revokePreview(item);
        toast.error?.("업로드 불가", `${item.name} 파일이 너무 커요. 파일당 최대 ${maxMbLabelFor(item.file)}MB까지 가능해요.`);
        continue;
      }
      accepted.push(item);
    }

    if (incoming.length > accepted.length) {
      toast.info?.("첨부 제한", `메시지에는 최대 ${MAX_ATTACHMENTS}개까지만 첨부돼요.`);
    }

    attachedFiles.value = [...attachedFiles.value, ...accepted];
    attachmentError.value = "";
    if (e?.target) e.target.value = "";
  }

  function loadPendingAction() {
    try {
      pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
    } catch {
      pendingAction.value = null;
    }
  }

  function clearPendingAction() {
    try { sessionStorage.removeItem("reallife:pendingAction"); } catch {}
    try { sessionStorage.removeItem("reallife:pendingActionTargetConversationId"); } catch {}
    pendingAction.value = null;
    pendingActionPrimed.value = false;
    pendingActionTempId.value = null;
  }

  function pendingKindLabel(kind) {
    if (kind === "PROMISE") return "📅 약속";
    if (kind === "TODO") return "✅ 할일";
    return "📍 장소";
  }

  function pendingSourceRoute() {
    const p = pendingAction.value;
    if (!p) return "";
    if (p.sourceRoute) return String(p.sourceRoute);
    if (p.postId) return `/posts/${encodeURIComponent(String(p.postId))}`;
    return "";
  }

  function pendingSourceMeta() {
    const p = pendingAction.value;
    if (!p) return "";
    const author = p.sourcePostAuthorHandle || p.sourcePostAuthorName || p.authorHandle || "";
    const label = p.sourceLabel || "게시글 댓글";
    return author ? `${label} · ${String(author).replace(/^@?/, "@")}` : label;
  }

  function pendingSourcePreview() {
    const p = pendingAction.value;
    if (!p) return "";
    return String(p.sourcePostPreview || p.text || "").trim().slice(0, 92);
  }

  function goPendingSource() {
    const to = pendingSourceRoute();
    if (to) router.push(to);
  }

  function pendingToDraftText(p) {
    if (!p) return "";
    const k = pendingKindLabel(p.kind);
    const t = String(p.text || "").trim();
    return t ? `${k}: ${t}` : `${k} 만들자`;
  }

  function focusComposer() {
    try {
      const el = composerRef.value?.querySelector?.("input, textarea");
      el?.focus?.();
    } catch {}
  }

  function primePendingAction(silent = false, force = false) {
    if (!pendingAction.value) return;
    if (!force && String(content.value || "").trim()) {
      focusComposer();
      return;
    }
    content.value = pendingToDraftText(pendingAction.value);
    pendingActionPrimed.value = true;
    nextTick(() => focusComposer());
    if (!silent) toast.success?.("액션 준비됨", "전송하면 ✨ 제안으로 바로 뜹니다.");
  }

  function makeTempId() {
    return `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildTempAttachments(overrides) {
    const source = Array.isArray(overrides) ? overrides : attachedFiles.value;
    return source.map((x, idx) => ({
      attachmentId: x.attachmentId || x.fileId || `local-${idx}`,
      fileId: x.fileId || null,
      url: x.url || x.previewUrl || '',
      previewUrl: x.previewUrl || x.url || '',
      thumbnailUrl: x.thumbnailUrl || x.previewUrl || x.url || '',
      streamingUrl: x.streamingUrl || '',
      downloadUrl: x.downloadUrl || x.url || x.previewUrl || '',
      originalFilename: x.originalFilename || x.name || '첨부파일',
      contentType: x.contentType || x.type || '',
      size: Number(x.size || 0),
      mediaType: x.mediaType || x.kind || '',
      fileType: x.fileType || x.mediaType || x.kind || '',
      _uploadState: x._uploadState || 'queued',
      _uploadProgress: Number(x._uploadProgress || 0),
    }));
  }

  function updateTempMessage(tempId, patch) {
    const idx = items.value.findIndex((x) => x?.messageId === tempId);
    if (idx < 0) return;
    items.value[idx] = { ...items.value[idx], ...patch };
  }

  function markTempAttachmentsUploading(tempId, progress = 0) {
    updateTempMessage(tempId, {
      attachments: buildTempAttachments(attachedFiles.value.map((item) => ({
        ...item,
        _uploadState: 'uploading',
        _uploadProgress: Number(progress || 0),
      }))),
    });
  }

  function markTempAttachmentsUploaded(tempId, uploadedItems) {
    updateTempMessage(tempId, {
      attachments: buildTempAttachments((uploadedItems || []).map((item) => ({
        ...item,
        _uploadState: 'uploaded',
        _uploadProgress: 100,
      }))),
    });
  }

  function markTempAttachmentsFailed(tempId) {
    updateTempMessage(tempId, {
      attachments: buildTempAttachments(attachedFiles.value.map((item) => ({
        ...item,
        _uploadState: 'failed',
        _uploadProgress: 0,
      }))),
      _status: 'failed',
    });
  }

  async function uploadAttachedFilesDetailed(tempId) {
    if (!attachedFiles.value.length) return [];
    attachmentUploading.value = true;
    attachmentProgress.value = 0;
    attachmentError.value = '';
    markTempAttachmentsUploading(tempId, 0);
    try {
      if (typeof uploadFilesDetailed === 'function') {
        const uploaded = await uploadFilesDetailed(attachedFiles.value.map((x) => x.file), {
          onProgress: (pct) => {
            const nextPct = Number(pct || 0);
            attachmentProgress.value = nextPct;
            markTempAttachmentsUploading(tempId, nextPct);
          },
        });
        markTempAttachmentsUploaded(tempId, uploaded);
        return uploaded;
      }

      const attachmentIds = await uploadFiles(attachedFiles.value.map((x) => x.file), {
        onProgress: (pct) => {
          const nextPct = Number(pct || 0);
          attachmentProgress.value = nextPct;
          markTempAttachmentsUploading(tempId, nextPct);
        },
      });
      const uploaded = attachmentIds.map((fileId, idx) => ({
        fileId,
        attachmentId: fileId,
        originalFilename: attachedFiles.value[idx]?.name || `첨부파일 ${idx + 1}`,
        contentType: attachedFiles.value[idx]?.type || '',
        size: Number(attachedFiles.value[idx]?.size || 0),
        mediaType: attachedFiles.value[idx]?.kind || 'FILE',
        previewUrl: attachedFiles.value[idx]?.previewUrl || '',
        thumbnailUrl: attachedFiles.value[idx]?.previewUrl || '',
        downloadUrl: attachedFiles.value[idx]?.previewUrl || '',
        url: attachedFiles.value[idx]?.previewUrl || '',
      }));
      markTempAttachmentsUploaded(tempId, uploaded);
      return uploaded;
    } catch (err) {
      attachmentError.value = err?.response?.data?.message || '첨부 업로드에 실패했어요.';
      markTempAttachmentsFailed(tempId);
      throw err;
    } finally {
      attachmentUploading.value = false;
    }
  }

  async function onSend() {
    const text = String(content.value || "").trim();
    const hasAttachments = attachedFiles.value.length > 0;
    const isPendingSend = !!(pendingActionPrimed.value && pendingAction.value && text && (
      !pendingAction.value.text || String(text).includes(String(pendingAction.value.text).trim())
    ));

    if ((!text && !hasAttachments) || sending.value || attachmentUploading.value) return;

    if (!conversationId.value) {
      toast.error?.("전송 실패", "대화방 ID가 없습니다.");
      return;
    }
    if (!canViewConversation.value) {
      toast.error?.("전송 실패", "잠금이 해제되어야 전송할 수 있어요.");
      return;
    }

    const tempId = makeTempId();
    items.value.push({
      messageId: tempId,
      senderId: myId.value,
      content: text,
      createdAt: new Date().toISOString(),
      attachments: buildTempAttachments(attachedFiles.value.map((item) => ({ ...item, _uploadState: 'queued', _uploadProgress: 0 }))),
      pinCandidates: [],
      _status: "sending",
    });

    content.value = "";
    newMsgCount.value = 0;
    scrollToBottom({ smooth: true });

    sending.value = true;
    try {
      const uploadedItems = await uploadAttachedFilesDetailed(tempId);
      const attachmentIds = uploadedItems.map((item) => item.fileId || item.attachmentId).filter(Boolean);
      const msg = await sendMessage({
        conversationId: conversationId.value,
        content: text,
        attachmentIds,
        unlockToken: lockEnabled.value && unlocked.value ? unlockToken.value : null,
      });

      upsertServerMessage(tempId, msg);
      clearAttachments();

      if (isPendingSend) {
        pendingActionTempId.value = tempId;
        const hasCandidates = msg && Array.isArray(msg.pinCandidates) && msg.pinCandidates.length > 0;
        if (hasCandidates) {
          openSuggestionsDock(msg);
          triggerDockPulse();
          clearPendingAction();
        } else {
          toast.info?.("제안이 생성되지 않았어요", "메시지를 조금 더 구체적으로 적고 다시 전송해보세요.");
        }
      }

      convStore.ingestMessageCreated?.({
        messageId: msg?.messageId,
        conversationId: conversationId.value,
        senderId: msg?.senderId,
        content: msg?.content,
        createdAt: msg?.createdAt,
        attachments: msg?.attachments || [],
        pinCandidates: msg?.pinCandidates || [],
      });

      const hasCandidates = Array.isArray(msg?.pinCandidates) && msg.pinCandidates.length > 0;
      scrollToBottom({ smooth: true });
      if (hasCandidates) nextTick(() => scrollToBottom({ smooth: true }));
    } catch (e) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      const url = e?.config?.url;

      if (status === 401) {
        toast.error?.("전송 실패", "로그인이 만료됐어요. 다시 로그인해 주세요.");
      } else if (status === 403) {
        toast.error?.("전송 실패", "권한이 없어요. (403)");
      } else if (status === 404) {
        toast.error?.("전송 실패", `API 경로를 찾을 수 없어요. (404) ${url || ""}`);
      } else if (status === 423) {
        lockEnabled.value = true;
        unlocked.value = false;
        clearToken?.();
        toast.error?.("전송 실패", "이 대화는 잠금 상태입니다. 먼저 잠금을 해제하세요.");
      } else {
        toast.error?.("전송 실패", serverMsg || (status ? `요청 실패 (status=${status})` : "네트워크 오류/서버 응답 없음"));
      }

      markTempAttachmentsFailed(tempId);
    } finally {
      sending.value = false;
      await nextTick();
      syncComposerHeightVar?.();
    }
  }

  async function quickSendPendingAction() {
    if (!pendingAction.value || sending.value) return;
    primePendingAction(true, true);
    bumpPendingHighlight();
    await nextTick();
    await onSend();
  }

  onBeforeUnmount(() => {
    for (const item of attachedFiles.value) revokePreview(item);
  });

  return {
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
  };
}
