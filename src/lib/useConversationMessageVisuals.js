export const MESSAGE_LAYER_KIND = Object.freeze({
  PLAIN: 'plain',
  SESSION: 'session',
  ACTION: 'action',
  MEDIA: 'media',
  FOCUS: 'focus',
});

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function useConversationMessageVisuals({
  messageDepthEnabled,
  focusedDepthMid,
  messageStageMode,
  stageDeckOpen,
  messageDepthRank,
  isMineMessage,
  isGroupWithPrev,
  isGroupWithNext,
  isStageCandidate,
  sessionForMessage,
  flashMid,
  searchFocusMid,
}) {
  function sessionMessageMeta(message) {
    return safeJsonParse(message?.metadataJson) || null;
  }

  function isSessionMessage(message) {
    const type = String(message?.type || '').toUpperCase();
    if (type === 'SESSION') return true;
    return sessionMessageMeta(message)?.kind === 'playback-session';
  }

  function messageHasMediaLayer(message) {
    return Boolean(Array.isArray(message?.attachments) && message.attachments.length > 0);
  }

  function messageHasActionLayer(message) {
    return Boolean(Array.isArray(message?.pinCandidates) && message.pinCandidates.length > 0);
  }

  function messageLayerKind(message) {
    if (isSessionMessage(message)) return MESSAGE_LAYER_KIND.SESSION;
    if (messageHasActionLayer(message)) return MESSAGE_LAYER_KIND.ACTION;
    if (messageHasMediaLayer(message)) return MESSAGE_LAYER_KIND.MEDIA;
    return MESSAGE_LAYER_KIND.PLAIN;
  }

  function messageVisualTone(message, index) {
    const layerKind = messageLayerKind(message);
    const depthRank = messageDepthRank(index);
    const isDepthFocus = messageDepthEnabled.value && depthRank === 'focus';
    if (isDepthFocus && layerKind === MESSAGE_LAYER_KIND.PLAIN) {
      return MESSAGE_LAYER_KIND.FOCUS;
    }
    return layerKind;
  }

  function messageShellClass(message, index) {
    const depthRank = messageDepthRank(index);
    const layerKind = messageLayerKind(message);
    const visualTone = messageVisualTone(message, index);
    return {
      mine: isMineMessage(message),
      'msg--flash': flashMid.value === String(message.messageId),
      'msg--searchFocus': searchFocusMid.value === String(message.messageId),
      'msg--groupPrev': isGroupWithPrev(index),
      'msg--groupNext': isGroupWithNext(index),
      depthOn: messageDepthEnabled.value,
      depthFocused: String(focusedDepthMid.value) === String(message.messageId),
      [`depthRank--${depthRank}`]: messageDepthEnabled.value,
      [`msg--${layerKind}`]: true,
      [`msgTone--${visualTone}`]: true,
      stageMuted: messageStageMode.value === 'stage' && stageDeckOpen.value && !isStageCandidate(message),
    };
  }

  function messageBubbleClass(message, index) {
    const layerKind = messageLayerKind(message);
    const visualTone = messageVisualTone(message, index);
    return {
      [`bubble--${layerKind}`]: true,
      [`bubbleTone--${visualTone}`]: true,
    };
  }

  function messageBodyClass(message, index) {
    const layerKind = messageLayerKind(message);
    const visualTone = messageVisualTone(message, index);
    return {
      messageBody: true,
      [`messageBody--${layerKind}`]: true,
      [`messageBodyTone--${visualTone}`]: true,
      'messageBody--grouped': isGroupWithPrev(index) || isGroupWithNext(index),
    };
  }

  function messageSessionBlockClass(message, index) {
    return {
      messageSessionBlock: true,
      'messageSessionBlock--compact': true,
      'messageSessionBlock--focus': messageVisualTone(message, index) === MESSAGE_LAYER_KIND.FOCUS,
      'messageSessionBlock--grouped': isGroupWithPrev(index) || isGroupWithNext(index),
    };
  }

  function shouldShowMessageEyebrow(message, index) {
    return messageVisualTone(message, index) !== MESSAGE_LAYER_KIND.PLAIN;
  }

  function messageEyebrowLabel(message, index) {
    const visualTone = messageVisualTone(message, index);
    if (visualTone === MESSAGE_LAYER_KIND.SESSION) return 'SESSION';
    if (visualTone === MESSAGE_LAYER_KIND.ACTION) return 'ACTION';
    if (visualTone === MESSAGE_LAYER_KIND.MEDIA) return 'MEDIA';
    if (visualTone === MESSAGE_LAYER_KIND.FOCUS) return 'FOCUS';
    return 'MESSAGE';
  }

  function messageEyebrowHint(message, index) {
    const visualTone = messageVisualTone(message, index);
    if (visualTone === MESSAGE_LAYER_KIND.SESSION) {
      return sessionForMessage(message)?.title || '공동 플레이 세션';
    }
    if (visualTone === MESSAGE_LAYER_KIND.ACTION) {
      const count = Array.isArray(message?.pinCandidates) ? message.pinCandidates.length : 0;
      return count > 0 ? `액션 후보 ${count}개` : '액션 후보';
    }
    if (visualTone === MESSAGE_LAYER_KIND.MEDIA) {
      const count = Array.isArray(message?.attachments) ? message.attachments.length : 0;
      return count > 0 ? `첨부 ${count}개` : '미디어 포함';
    }
    if (visualTone === MESSAGE_LAYER_KIND.FOCUS) {
      return '지금 읽기 중심 메시지';
    }
    return '';
  }

  function hasMessageAttachmentBlock(message) {
    return !isSessionMessage(message) && Array.isArray(message?.attachments) && message.attachments.length > 0;
  }

  function hasMessageSendState(message) {
    return Boolean(message?._status);
  }

  function shouldRenderMessageFooter(message) {
    return hasMessageAttachmentBlock(message) || hasMessageSendState(message);
  }

  function shouldShowMessageMeta(message, index) {
    return Boolean(getReadLabel(message)) || !isGroupWithNext(index);
  }

  function messageMetaRowClass(message, index, getReadLabel) {
    const visualTone = messageVisualTone(message, index);
    return {
      messageMetaRow: true,
      'messageMetaRow--mine': isMineMessage(message),
      'messageMetaRow--stacked': isGroupWithNext(index),
      [`messageMetaRow--${visualTone}`]: true,
    };
  }

  function messageFooterClass(message, index) {
    const visualTone = messageVisualTone(message, index);
    return {
      messageFooter: true,
      [`messageFooter--${visualTone}`]: true,
    };
  }

  return {
    sessionMessageMeta,
    isSessionMessage,
    messageHasMediaLayer,
    messageHasActionLayer,
    messageLayerKind,
    messageVisualTone,
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
  };
}
