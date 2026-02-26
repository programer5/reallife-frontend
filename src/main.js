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
    if (type === "pin-created") {
        pins.ingestPinCreated?.(data);
        return;
    }

    if (type === "pin-updated") {
        pins.ingestPinUpdated?.(data);
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