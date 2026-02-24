// src/main.js
import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./styles/theme.css";

// stores
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import { useConversationsStore } from "@/stores/conversations";

// SSE Manager (fetch-event-source 기반)
import sse from "@/lib/sse";

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();

/**
 * SSE ping이 자주 오므로, notifications 재조회 쿨다운 적용
 */
let refreshing = false;
let lastRefreshAt = 0;
const COOLDOWN_MS = 1500;

/**
 * “최신 알림” 중복 처리 방지
 */
let lastHandledNotiId = null;

async function handleAfterNotiRefresh() {
    const items = noti.items || [];
    if (!items.length) return;

    const latest = items[0];
    if (!latest?.id) return;

    // 같은 알림이면 중복 처리 방지
    if (latest.id === lastHandledNotiId) return;
    lastHandledNotiId = latest.id;

    // ✅ 메시지 알림이면 DM 목록(미리보기/뱃지)만 갱신
    if (latest.type === "MESSAGE_RECEIVED") {
        await conv.refresh();
    }
}

/**
 * SSE 이벤트 수신 → notifications만 재조회(쿨다운)
 * (백엔드 구조상, 도메인 이벤트는 /api/notifications로 확인하는 패턴)
 */
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

/**
 * 로그인(세션 확보) 직후 한 번 동기화
 */
watch(
    () => auth.isAuthed,
    async (v) => {
        if (!v) return;
        // auth.ensureSession() 내부에서 sse.start()를 하고 있다면 그대로 두고,
        // 여기서는 “초기 알림 1회 동기화”만 수행
        await noti.refresh();
        await handleAfterNotiRefresh();
    },
    { immediate: true }
);

app.mount("#app");