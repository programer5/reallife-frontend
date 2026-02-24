// src/main.js
import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./style.css";

import { useAuthStore } from "./stores/auth";
import { useNotificationsStore } from "./stores/notifications";
import { useConversationsStore } from "./stores/conversations";

// ✅ auth store가 사용하는 SSEManager (fetch-event-source 기반)
import sse from "@/lib/sse";

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();

// --- SSE ping cooldown + minimal refresh ---
let refreshing = false;
let lastRefreshAt = 0;
const COOLDOWN_MS = 1500;

// 중복 처리 방지용
let lastHandledNotiId = null;

async function handleAfterNotiRefresh(noti, conv) {
    const items = noti.items || [];
    if (!items.length) return;

    const latest = items[0];
    if (!latest?.id) return;

    if (latest.id === lastHandledNotiId) return;
    lastHandledNotiId = latest.id;

    if (latest.type === "MESSAGE_RECEIVED") {
        await conv.refresh();
    }
}

sse.onEvent?.(async () => {
    if (!auth.isAuthed) return;

    const now = Date.now();
    if (refreshing) return;
    if (now - lastRefreshAt < COOLDOWN_MS) return;

    refreshing = true;
    lastRefreshAt = now;
    try {
        await noti.refresh();
        await handleAfterNotiRefresh(noti, conv);
    } finally {
        refreshing = false;
    }
});

// ✅ 로그인 직후 한 번 동기화
watch(
    () => auth.isAuthed,
    async (v) => {
        if (!v) return;
        await noti.refresh();
        await handleAfterNotiRefresh();
    },
    { immediate: true }
);

app.mount("#app");