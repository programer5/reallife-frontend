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

// ✅ 최근 처리한 알림 id (중복 분기 방지)
let lastHandledNotiId = null;

async function handleAfterNotiRefresh() {
    const items = noti.items || [];
    if (!items.length) return;

    // 최신 1개만 우선 기준으로 (원하면 최근 N개로 확장 가능)
    const latest = items[0];
    if (!latest?.id) return;

    if (latest.id === lastHandledNotiId) return;
    lastHandledNotiId = latest.id;

    // ✅ type별 최소 갱신
    if (latest.type === "MESSAGE_RECEIVED") {
        // DM 목록(미리보기/뱃지) 갱신
        await conv.refresh();
        // DM 상세는 ConversationDetailView에서 "noti store watch"로 갱신할 거라
        // main.js에서는 여기까지만!
        return;
    }

    // 댓글/좋아요 등은 notifications 갱신만으로 충분
}

let refreshing = false;
let lastRefreshAt = 0;
const COOLDOWN_MS = 1500;

sse.onEvent?.(async () => {
    if (!auth.isAuthed) return;

    const now = Date.now();
    if (refreshing) return;
    if (now - lastRefreshAt < COOLDOWN_MS) return;

    refreshing = true;
    lastRefreshAt = now;
    try {
        await noti.refresh();
        await handleAfterNotiRefresh();
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