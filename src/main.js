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
import { useSettingsStore } from "@/stores/settings";
import { bindSoundUnlockOnce, playDing } from "@/lib/sound";
import sse from "@/lib/sse";

// ✅ NEW
import { getPin } from "@/api/pinsActions";

// ✅ 최근 처리한 notification 이벤트 중복 방지
const processedNotificationIds = new Set();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const auth = useAuthStore();
const noti = useNotificationsStore();
const conv = useConversationsStore();
// ✅ noti.refresh 폭주 방지용 디바운스
let __notiRefreshTimer = null;
function scheduleNotiRefresh(ms = 600) {
    if (__notiRefreshTimer) clearTimeout(__notiRefreshTimer);
    __notiRefreshTimer = setTimeout(() => {
        __notiRefreshTimer = null;
        try {
            noti.refresh?.();
        } catch {}
    }, ms);
}
const pins = useConversationPinsStore();
const toast = useToastStore();
const settings = useSettingsStore();

// 브라우저 정책상(사용자 제스처 필요) 앱 시작 시 unlock 바인딩
try { bindSoundUnlockOnce(); } catch {}

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

function showPinRemindBrowserNotification({ title, body, url }) {
    try {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;

        const n = new Notification(title, {
            body,
            silent: true, // 이미 사운드/진동은 앱에서 처리하니까 알림 자체는 무음 추천
        });

        n.onclick = () => {
            try {
                window.focus?.();
            } catch {}
            try {
                if (url) router.push(url);
            } catch {}
            try {
                n.close?.();
            } catch {}
        };
    } catch {}
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

        // ✅ NEW: 사용자가 다른 탭/창 보고 있으면 브라우저 알림 띄우기
        try {
            const url = cid
                ? `/inbox/conversations/${cid}/pins?pinId=${encodeURIComponent(pinId)}&notiId=${encodeURIComponent(
                    notiPayload?.notificationId || ""
                )}`
                : "";

            // 설정 ON + 권한 허용 + (현재 페이지가 숨김 상태일 때만)
            if (settings.pinRemindBrowserNotify && (document.hidden || !document.hasFocus())) {
                showPinRemindBrowserNotification({
                    title: "⏰ 리마인드",
                    body: `📌 ${fmtPin(pin)}`,
                    url,
                });
            }
        } catch {}

        // ✅ NEW: PIN_REMIND 진동 (모바일에서 체감 업)
        try {
            if (settings.pinRemindVibrate && typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([60, 40, 60]); // 짧게 2번 "부르르"
            }
        } catch {}

        // ✅ NEW: PIN_REMIND 사운드 (설정 ON일 때만)
        try {
            if (settings.pinRemindSound) {
                playDing({ volume: 0.18 });
            }
        } catch {}
    } catch {
        toast.success?.("⏰ 리마인드", "📌 저장한 일정 리마인드가 도착했어요.");
    }
}

sse.onEvent?.(async (evt) => {
    if (!auth.isAuthed) return;

    const type = evt?.type;
    const data = parse(evt?.data);

    if (type === "ping") return;

    if (type === "connected") {
        // ✅ SSE 재연결/초기 연결 시 누락 보정
        try {
            await noti.refresh?.();
            conv.softSyncSoon?.();
        } catch {}
        return;
    }

    if (type === "error") {
        // ✅ 끊겼을 때도 한 번 보정 (과도 호출 방지용 간단한 디바운스)
        if (!window.__sseErrSyncOnce) {
            window.__sseErrSyncOnce = true;
            setTimeout(async () => {
                try {
                    await noti.refresh?.();
                    conv.softSyncSoon?.();
                } catch {}
                window.__sseErrSyncOnce = false;
            }, 1500);
        }
        return;
    }

    if (type === "notification-created") {
        // ✅ SSE 재연결/중복전달 대비: notificationId 기준 idempotent guard
        const nid = data?.notificationId || data?.id; // payload에 notificationId가 없고 id만 있던 경우도 대비
        if (!window.__seenNotiIds) window.__seenNotiIds = new Set();

        if (nid) {
            if (window.__seenNotiIds.has(nid)) return;
            window.__seenNotiIds.add(nid);

            // 메모리 무한증가 방지
            if (window.__seenNotiIds.size > 500) {
                // 간단하게 clear (필요하면 LRU로 바꿀 수 있음)
                window.__seenNotiIds.clear();
                window.__seenNotiIds.add(nid);
            }
        }

        // ✅ 1) 스토어에 즉시 반영 (새 알림 리스트에 끼워넣기)
        if (noti.ingestFromSse) noti.ingestFromSse(data);

        // ✅ 2) 서버와 동기화(커서/카운트 보정) - 디바운스로 묶어서 호출
        scheduleNotiRefresh(600);

        // ✅ 3) 타입별 후처리
        if (data?.type === "MESSAGE_RECEIVED") {
            conv.softSyncSoon?.();
            return;
        }

        if (data?.type === "PIN_REMIND") {
            // await 쓰면 여기 블록이 async 함수 안이어야 하므로, 지금은 기존처럼 fire-and-forget 유지
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