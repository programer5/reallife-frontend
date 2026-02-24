// src/main.js
import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./styles/theme.css";

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

function safeJsonParse(x) {
    if (x == null) return null;
    if (typeof x === "object") return x;
    try {
        return JSON.parse(x);
    } catch {
        return x;
    }
}

let refreshingNoti = false;

const offEvent = sse.onEvent?.(async (evt) => {
    if (!auth.isAuthed) return;

    const type = evt?.type;
    const data = safeJsonParse(evt?.data);

    // ✅ ping/connected는 무시 (heartbeat 때문에 불필요 호출 방지)
    if (type === "ping" || type === "connected") return;

    // ✅ 알림 생성 이벤트 → 알림만 refresh
    if (type === "notification-created") {
        if (refreshingNoti) return;
        refreshingNoti = true;
        try {
            await noti.refresh();
            // 메시지 알림이면 대화 목록도 갱신(뱃지/미리보기)
            if (data?.type === "MESSAGE_RECEIVED") {
                await conv.refresh();
            }
        } finally {
            refreshingNoti = false;
        }
        return;
    }

    // ✅ 메시지 생성 이벤트 → 대화 목록 갱신 (상세 화면은 화면 컴포넌트에서 처리)
    if (type === "message-created" || type === "message-deleted") {
        await conv.refresh();
        return;
    }
});

watch(
    () => auth.isAuthed,
    async (v) => {
        if (!v) return;
        // 로그인 직후 1회 동기화
        await noti.refresh();
        await conv.refresh();
        // auth.ensureSession()에서 sse.start()를 이미 하고 있으면 OK
        // 아니면 여기서 sse.start() 해도 됨 (중복 start 방지 로직이 lib에 있어야 함)
    },
    { immediate: true }
);

app.mount("#app");