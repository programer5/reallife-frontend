// src/main.js
import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./styles/theme.css";
import "./style.css";

import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";
import { useConversationPinsStore } from "@/stores/conversationPins";
import { useToastStore } from "@/stores/toast";
import sse from "@/lib/sse";

// ✅ NEW
import { getPin } from "@/api/pinsActions";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();
const pins = useConversationPinsStore();
const toast = useToastStore();

function parse(data) {
    if (!data) return null;
    if (typeof data === "object") return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

function fmtPin(p) {
    if (!p) return "";
    const place = p.placeText ? `📍 ${p.placeText}` : "📍 장소 미정";
    const when = p.startAt ? `🕒 ${String(p.startAt).replace("T", " ").slice(0, 16)}` : "🕒 시간 미정";
    const title = p.title ? `“${p.title}”` : "“약속”";
    return `${title} · ${place} · ${when}`;
}

async function handlePinRemindToastAndBadge(notiPayload) {
    // notiPayload: { type, refId(pinId), body, createdAt, notificationId }
    const pinId = notiPayload?.refId;
    if (!pinId) return;

    try {
        const pin = await getPin(pinId); // { pinId, conversationId, ... }
        const cid = pin?.conversationId;
        if (cid) pins.bumpPinToTop?.(cid, pinId);   // ✅ NEW: 위로 올리기

        // ✅ 현재 대화방이면 pinned 영역 하이라이트 트리거
        if (cid) {
            try {
                window.dispatchEvent(
                    new CustomEvent("pin-remind-highlight", { detail: { conversationId: cid } })
                );
            } catch {}
        }

        // ✅ 대화방 Pinned 배지 ON
        if (cid) pins.markRemindBadge?.(cid);

        // ✅ 토스트 (딥링크 포함)
        toast.success?.("⏰ 리마인드", `📌 ${fmtPin(pin)}`, {
            to: cid
                ? `/inbox/conversations/${cid}/pins?pinId=${encodeURIComponent(pinId)}&notiId=${encodeURIComponent(
                    notiPayload?.notificationId || ""
                )}`
                : "",
        });
    } catch {
        toast.success?.("⏰ 리마인드", "📌 저장한 일정 리마인드가 도착했어요.");
    }
}

sse.onEvent?.((evt) => {
    if (!auth.isAuthed) return;

    const type = evt?.type;
    const data = parse(evt?.data);

    if (type === "ping" || type === "connected") return;

    if (type === "notification-created") {
        if (noti.ingestFromSse) noti.ingestFromSse(data);
        noti.refresh?.();

        if (data?.type === "MESSAGE_RECEIVED") {
            conv.softSyncSoon?.();
            return;
        }

        // ✅ NEW: PIN_REMIND면 대화 상세에서도 “체감”나게 토스트/배지
        if (data?.type === "PIN_REMIND") {
            handlePinRemindToastAndBadge(data);
            return;
        }

        return;
    }

    if (type === "message-created") {
        conv.ingestMessageCreated?.(data);
        return;
    }

    if (type === "message-deleted") {
        conv.softSyncSoon?.();
        return;
    }

    // ✅ pins
    if (type === "pin-created") {
        pins.ingestPinCreated?.(data);

        // UX: 토스트
        try {
            toast.success?.("핀 생성", `📌 ${fmtPin(data)}`);
        } catch {}

        return;
    }

    if (type === "pin-updated") {
        pins.ingestPinUpdated?.(data);

        // UX: 토스트
        try {
            const action = data?.action;
            const msg = fmtPin(data);
            if (action === "DONE") toast.success?.("핀 완료", `✅ ${msg}`);
            else if (action === "CANCELED") toast.error?.("핀 취소", `❌ ${msg}`);
            else if (action === "DISMISSED") toast.success?.("핀 숨김", `🙈 ${msg}`);
            else toast.success?.("핀 업데이트", msg);
        } catch {}

        return;
    }
});

watch(
    () => auth.isAuthed,
    async (v) => {
        if (!v) return;
        await noti.refresh?.();
        await conv.refresh?.();
    },
    { immediate: true }
);

app.mount("#app");