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
import sse from "@/lib/sse";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();
const pins = useConversationPinsStore();

function parse(data) {
    if (!data) return null;
    if (typeof data === "object") return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

sse.onEvent?.((evt) => {
    if (!auth.isAuthed) return;

    const type = evt?.type;
    const data = parse(evt?.data);

    if (type === "ping" || type === "connected") return;

    if (type === "notification-created") {
        // ✅ (이미 너가 적용한 고급 버전이면 ingestFromSse + refresh 디바운스 유지)
        if (noti.ingestFromSse) noti.ingestFromSse(data);
        noti.refresh?.();

        // MESSAGE_RECEIVED면 목록 정합성 보정(혹시 message-created가 늦게/누락될 때 대비)
        if (data?.type === "MESSAGE_RECEIVED") {
            conv.softSyncSoon?.();
        }
        return;
    }

    if (type === "message-created") {
        // ✅ 핵심: 전체 재조회 금지 → 부분 업데이트
        conv.ingestMessageCreated?.(data);
        return;
    }

    if (type === "pin-created") {
        pins.ingestPinCreated?.(data);
        return;
    }

    if (type === "message-deleted") {
        // 목록까지 정확히 반영하고 싶으면 여기서 conv.refresh() 대신 softSyncSoon 정도만
        conv.softSyncSoon?.();
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