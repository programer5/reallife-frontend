<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readAllNotifications, readNotification, clearReadNotifications } from "@/api/notifications";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToastStore();
const noti = useNotificationsStore();

const busy = ref(false);
const cleaning = ref(false);

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const loading = computed(() => noti.loading);
const error = computed(() => noti.error);

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED") return "댓글";
  if (t === "POST_LIKED") return "좋아요";
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

async function markAllRead() {
  if (busy.value) return;
  busy.value = true;
  try {
    await readAllNotifications();
    await refreshNow();
    toast.success("완료", "알림을 모두 읽음 처리했어요.");
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

  // 메시지 알림이면 대화 목록으로 이동
  if (n.type === "MESSAGE_RECEIVED") {
    router.push("/inbox/conversations");
    return;
  }

  if (n.type === "COMMENT_CREATED" || n.type === "POST_LIKED") {
    if (n.refId) router.push(`/posts/${n.refId}`);
  }
}

onMounted(refreshNow);
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <h1 class="title">Inbox</h1>
        <p class="sub">알림 & 메시지</p>
      </div>

      <div class="actions">
        <!-- ✅ DM 이동 버튼 추가 -->
        <RlButton size="sm" variant="soft" @click="router.push('/inbox/conversations')">
          대화
        </RlButton>

        <RlButton size="sm" variant="soft" @click="refreshNow" :disabled="loading">
          새로고침
        </RlButton>

        <RlButton size="sm" variant="soft" @click="markAllRead" :disabled="busy || loading || !items.length">
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
.state{padding:28px 0;text-align:center;color:var(--muted)}
.state.err{color:var(--danger)}
.list{display:grid;gap:10px}
.item{
  width:100%;text-align:left;border:1px solid var(--border);
  border-radius:18px;padding:12px;
  background:color-mix(in oklab,var(--surface) 92%,transparent);
  display:grid;grid-template-columns:10px 1fr auto;
  gap:10px;align-items:center;cursor:pointer;
}
.item.unread{border-color:var(--warning)}
.badge{width:8px;height:8px;border-radius:999px;background:var(--border)}
.badge.on{background:var(--warning)}
.content{display:grid;gap:6px}
.row1{display:flex;justify-content:space-between}
.type{font-weight:950;font-size:13px}
.time{font-size:12px;color:var(--muted)}
.body{font-size:13px}
.chev{font-size:20px;opacity:.5}
.footerNote{margin-top:14px;font-size:12px;color:var(--muted)}
</style>