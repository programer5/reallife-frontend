import api from "../lib/api";

export async function fetchConversationPins({ conversationId, size = 10 } = {}) {
    const res = await api.get(`/api/conversations/${conversationId}/pins`, {
        params: { size },
    });
    return Array.isArray(res.data) ? res.data : [];
}

/**
 * 메시지에서 감지된 pinCandidates를 사용자가 "확정"하여 실제 핀 생성
 * POST /api/conversations/{conversationId}/pins/confirm
 */
export async function confirmPinFromMessage({
                                                conversationId,
                                                messageId,
                                                overrideTitle = null,
                                                overrideStartAt = null,
                                                overridePlaceText = null,
                                                overrideRemindMinutes = null, // ✅ NEW
                                            } = {}) {
    const res = await api.post(`/api/conversations/${conversationId}/pins/confirm`, {
        messageId,
        overrideTitle,
        overrideStartAt,
        overridePlaceText,
        overrideRemindMinutes, // ✅ NEW
    });
    return res.data;
}