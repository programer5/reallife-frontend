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
import sse from "@/lib/sse";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();

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

    // ping/connected 무시
    if (type === "ping" || type === "connected") return;

    if (type === "notification-created") {
        // ✅ 1) 즉시 UI 반영 (prepend)
        noti.ingestFromSse?.(data);

        // ✅ 2) 400ms 디바운스 보정 refresh
        noti.refresh();

        // ✅ 메시지 알림이면 DM 목록/뱃지도 같이 갱신
        if (data?.type === "MESSAGE_RECEIVED") {
            conv.refresh();
        }
        return;
    }

    if (type === "message-created") {
        // 대화 목록만 갱신 (상세는 화면에서 직접 처리)
        conv.refresh();
        return;
    }
});

watch(
    () => auth.isAuthed,
    async (v) => {
        if (!v) return;
        await noti.refresh();
        await conv.refresh();
    },
    { immediate: true }
);

app.mount("#app");