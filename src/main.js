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
    const when = p.startAt ? `🕒 ${String(p.startAt).replace("T"," ").slice(0,16)}` : "🕒 시간 미정";
    const title = p.title ? `“${p.title}”` : "“약속”";
    return `${title} · ${place} · ${when}`;
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

    // ✅ NEW: pins
    // ✅ NEW: pins
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

        // (선택) 안전장치: event 누락/순서 꼬임 대비 가벼운 재동기화
        // - 너무 자주 호출되면 부담이니, 필요한 경우에만 주석 해제
        // pins.refresh?.(data?.conversationId, { size: 10 });

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