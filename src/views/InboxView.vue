<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readAllNotifications, readNotification, clearReadNotifications } from "@/api/notifications";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "vue-router";
import { getPin } from "@/api/pinsActions";

const router = useRouter();
const toast = useToastStore();
const noti = useNotificationsStore();

const busy = ref(false);
const cleaning = ref(false);

/** ✅ 추천 옵션: Inbox 들어가면 자동 전체 읽음 */
const AUTO_READ_ON_OPEN = true;
const autoReadDone = ref(false);

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const loading = computed(() => noti.loading);
const error = computed(() => noti.error);

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED") return "댓글";
  if (t === "POST_LIKED") return "좋아요";
  if (t === "PIN_CREATED") return "핀";
  if (t === "PIN_REMIND") return "리마인드";
  return t || "알림";
}

function formatTime(iso) {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 19);
}

async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}

async function markAllRead({ silent = false } = {}) {
  if (busy.value) return;
  busy.value = true;
  try {
    await readAllNotifications();
    await refreshNow();
    if (!silent) toast.success("완료", "알림을 모두 읽음 처리했어요.");
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    busy.value = false;
  }
}

async function clearRead() {
  if (cleaning.value) return;
  cleaning.value = true;
  try {
    const res = await clearReadNotifications();
    await refreshNow();
    toast.success("정리 완료", `읽은 알림 ${res?.deletedCount ?? 0}개를 정리했어요.`);
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
  } finally {
    cleaning.value = false;
  }
}

async function openItem(n) {
  try {
    await readNotification(n.id);
    await refreshNow();
  } catch {}

  if (n.type === "MESSAGE_RECEIVED") {
    router.push("/inbox/conversations");
    return;
  }

  if (n.type === "COMMENT_CREATED" || n.type === "POST_LIKED") {
    if (n.refId) router.push(`/posts/${n.refId}`);
  }

  if (n.type === "PIN_CREATED" || n.type === "PIN_REMIND") {
    // refId = pinId
    if (n.refId) {
      try {
        const pin = await getPin(n.refId);
        // ✅ Pinned 더보기 페이지로 이동 (원하면 여기서 conversation 화면으로 보내도 됨)
        router.push(`/inbox/conversations/${pin.conversationId}/pins`);
        return;
      } catch (e) {
        // 실패하면 최소한 대화 목록이라도
        router.push("/inbox/conversations");
        return;
      }
    }
    router.push("/inbox/conversations");
    return;
  }
}

onMounted(async () => {
  await refreshNow();

  if (AUTO_READ_ON_OPEN && !autoReadDone.value && hasUnread.value) {
    autoReadDone.value = true;
    await markAllRead({ silent: true });
  }
});
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1 class="title">Inbox</h1>
        <p class="sub">알림 & 메시지</p>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="primary" @click="router.push('/inbox/new')">
          새 DM
        </RlButton>

        <RlButton size="sm" variant="soft" @click="router.push('/inbox/conversations')">
          대화
        </RlButton>

        <RlButton size="sm" variant="soft" @click="refreshNow" :disabled="loading">
          새로고침
        </RlButton>

        <RlButton size="sm" variant="soft" @click="markAllRead()" :disabled="busy || loading || !items.length">
          전체 읽음
        </RlButton>

        <RlButton size="sm" variant="soft" @click="clearRead" :disabled="cleaning || loading || !items.length">
          읽은 알림 정리
        </RlButton>
      </div>
    </header>

    <div v-if="loading" class="state">불러오는 중…</div>
    <div v-else-if="error" class="state err">{{ error }}</div>

    <div v-else-if="items.length === 0" class="state">
      아직 알림이 없어요 ✨
    </div>

    <div v-else class="list">
      <button
          v-for="n in items"
          :key="n.id"
          class="item"
          :class="{ unread: !n.read }"
          type="button"
          @click="openItem(n)"
      >
        <div class="badge" :class="{ on: !n.read }"></div>

        <div class="content">
          <div class="row1">
            <div class="type">{{ formatType(n.type) }}</div>
            <div class="time">{{ formatTime(n.createdAt) }}</div>
          </div>
          <div class="body">{{ n.body }}</div>
        </div>

        <div class="chev">›</div>
      </button>
    </div>

    <div class="footerNote" v-if="hasUnread">
      읽지 않은 알림이 있어요.
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:760px;margin:0 auto}
.head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:14px}
.title{font-size:20px;font-weight:950;margin:0}
.sub{margin:6px 0 0;color:var(--muted);font-size:12px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.state{text-align:center;color:var(--muted);padding:18px 0}
.state.err{color:color-mix(in oklab,var(--danger) 80%,white)}
.list{display:flex;flex-direction:column;gap:10px;margin-top:6px}
.item{
  display:grid;
  grid-template-columns: 10px 1fr auto;
  gap:12px;
  align-items:center;
  text-align:left;
  padding:12px 12px;
  border-radius:16px;
  border:1px solid var(--border);
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  cursor:pointer;
}
.item:hover{
  border-color:color-mix(in oklab,var(--accent) 32%,var(--border));
  background:color-mix(in oklab,var(--surface) 86%,transparent);
}
.badge{width:10px;height:10px;border-radius:999px;background:transparent}
.badge.on{
  background:var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
}
.content{display:flex;flex-direction:column;gap:6px}
.row1{display:flex;justify-content:space-between;gap:12px}
.type{font-weight:900}
.time{color:var(--muted);font-size:12px}
.body{color:color-mix(in oklab,var(--text) 90%,var(--muted));font-size:13px;line-height:1.35}
.chev{color:var(--muted);font-size:18px}
.footerNote{margin-top:12px;color:var(--muted);font-size:12px;text-align:center}
</style>