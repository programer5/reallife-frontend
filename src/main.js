// src/main.js
import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import router from "./router"; // default export router
import App from "./App.vue";
import "./style.css";

// ✅ SSE + Notifications store 연결
import { useSseStore } from "./stores/sse";
import { useNotificationsStore } from "./stores/notifications";
import { useAuthStore } from "./stores/auth";
import { useConversationsStore } from "./stores/conversations";

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);

// ✅ Pinia가 붙은 뒤에 store를 사용할 수 있음
const auth = useAuthStore();
const sse = useSseStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();

// ✅ 로그인 상태일 때 SSE 연결 / 로그아웃 시 해제
// auth store에 isLoggedIn이 없다면 아래 watch의 기준만 바꾸면 됨.
watch(
    () => auth.isLoggedIn,
    (v) => {
        if (v) sse.connect();
        else sse.disconnect();
    },
    { immediate: true }
);

// ✅ SSE 이벤트가 오면 알림 목록을 재조회 (REST Docs 권장 패턴)
watch(
    () => sse.lastEventAt,
    (t) => {
        if (!t) return;
        noti.refresh();
    }
);

watch(
    () => sse.lastEventAt,
    (t) => {
        if (!t) return;
        noti.refresh();
        conv.refresh(); // ✅ 메시지 수신 시 unreadCount 반영
    }
);

app.mount("#app");