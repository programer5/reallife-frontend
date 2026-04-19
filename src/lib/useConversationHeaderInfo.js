export function useConversationHeaderInfo({ computed, router, conversationId, convStore }) {
  const currentConversation = computed(() => {
    const cid = conversationId.value;
    return (convStore.items || []).find((c) => String(c.conversationId) === String(cid)) || null;
  });

  const isGroupConversation = computed(() => {
    return String(currentConversation.value?.conversationType || 'DIRECT').toUpperCase() === 'GROUP';
  });

  const peer = computed(() => currentConversation.value?.peerUser || null);

  const peerName = computed(() => {
    if (isGroupConversation.value) {
      return currentConversation.value?.conversationTitle || '그룹 대화';
    }
    return peer.value?.nickname || peer.value?.name || '대화';
  });

  const peerHandle = computed(() => {
    if (isGroupConversation.value) {
      const count = currentConversation.value?.memberCount;
      return count ? `멤버 ${count}명` : '그룹 정보';
    }
    return peer.value?.handle || '';
  });

  const hasPeer = computed(() => {
    if (isGroupConversation.value) return true;
    return !!peer.value;
  });

  function peerInitial() {
    if (isGroupConversation.value) return 'G';
    const s = String(peer.value?.nickname || peer.value?.name || peer.value?.handle || '').trim();
    return s ? s[0].toUpperCase() : 'U';
  }

  const peerSubtitle = computed(() => {
    if (peerHandle.value) {
      return isGroupConversation.value ? peerHandle.value : `@${peerHandle.value}`;
    }
    return isGroupConversation.value ? '그룹 정보' : '프로필';
  });

  function openPeerProfile() {
    if (isGroupConversation.value) {
      return router.push({ name: 'conversation-group-manage', params: { conversationId: conversationId.value } });
    }
    const handle = peer.value?.handle;
    const userId = peer.value?.userId || peer.value?.id;
    if (handle) return router.push(`/u/${handle}`);
    if (userId) return router.push(`/u/id/${userId}`);
  }

  return {
    currentConversation,
    isGroupConversation,
    peer,
    peerName,
    peerHandle,
    hasPeer,
    peerInitial,
    peerSubtitle,
    openPeerProfile,
  };
}
