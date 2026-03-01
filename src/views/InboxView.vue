<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from "vue";
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
const loadingMore = computed(() => noti.loadingMore);
const hasNext = computed(() => noti.hasNext);
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

    // ✅ Optimistic: 읽은 알림 즉시 제거
    const removedLocal = noti.purgeReadLocal?.() ?? 0;

    toast.success(
        "정리 완료",
        `읽은 알림 ${res?.deletedCount ?? removedLocal ?? 0}개를 정리했어요.`
    );

    // ✅ 뒤에서 보정(커서/hasNext/hasUnread 등 서버 기준으로 정리)
    noti.refresh?.();
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    // ❗실패 시는 서버 상태가 불확실하니 강제 동기화
    await refreshNow();
  } finally {
    cleaning.value = false;
  }
}

function enc(v) {
  return encodeURIComponent(String(v ?? ""));
}

async function routeForNotification(n) {
  // ✅ PIN 알림은 pinId + notiId까지 붙여서 pins 화면에서 자동 포커스/반짝
  if (n.type === "PIN_CREATED" || n.type === "PIN_REMIND") {
    if (!n.refId) return "/inbox/conversations";

    try {
      const pin = await getPin(n.refId);
      const cid = pin?.conversationId;
      if (!cid) return "/inbox/conversations";

      return `/inbox/conversations/${cid}/pins?pinId=${enc(n.refId)}&notiId=${enc(n.id)}`;
    } catch {
      return "/inbox/conversations";
    }
  }

  // ✅ 메시지/대화 관련 (프로젝트 기존 규칙 유지)
  if (n.type === "MESSAGE_RECEIVED") {
    // 예: n.refId가 conversationId인 구조면:
    if (n.refId) return `/inbox/conversations/${enc(n.refId)}`;
    return "/inbox/conversations";
  }

  // 기본 fallback
  return "/inbox/conversations";
}

async function openItem(n) {
  // 1) 읽음 처리(기존 로직 유지)
  try {
    if (!n.read) await readNotification(n.id);
  } catch {}

  // 2) 어디로 갈지 계산 후 이동
  const to = await routeForNotification(n);
  router.push(to);

  // 3) 뒤에서 상태 보정(선택)
  noti.refresh?.();
}

/** ====== infinite scroll ====== */
const sentinelEl = ref(null);
let io = null;

async function loadMore() {
  if (loading.value || loadingMore.value) return;
  if (!hasNext.value) return;
  await noti.loadMore({ size: 20 });
}

function attachObserver() {
  if (io) io.disconnect();

  io = new IntersectionObserver(
      async (entries) => {
        const e = entries?.[0];
        if (!e?.isIntersecting) return;
        await loadMore();
      },
      {
        root: null,        // viewport
        rootMargin: "200px", // 미리 로드
        threshold: 0.01,
      }
  );

  if (sentinelEl.value) io.observe(sentinelEl.value);
}

onMounted(async () => {
  await refreshNow();

  if (AUTO_READ_ON_OPEN && !autoReadDone.value && hasUnread.value) {
    autoReadDone.value = true;
    await markAllRead({ silent: true });
  }

  await nextTick();
  attachObserver();
});

onBeforeUnmount(() => {
  if (io) io.disconnect();
  io = null;
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

    <div v-if="loading && !items.length" class="state">불러오는 중…</div>
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

      <!-- ✅ sentinel (무한 스크롤 트리거) -->
      <div ref="sentinelEl" class="sentinel" />

      <!-- ✅ 더보기 버튼(옵션): observer가 안 먹는 환경에서도 동작 -->
      <div class="moreWrap" v-if="hasNext">
        <RlButton
            size="sm"
            variant="soft"
            :disabled="loadingMore || loading"
            @click="loadMore"
        >
          {{ loadingMore ? "불러오는 중…" : "더보기" }}
        </RlButton>
      </div>

      <div class="moreEnd" v-else>
        끝까지 다 봤어요.
      </div>
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

.sentinel{height:1px}
.moreWrap{display:flex;justify-content:center;padding:10px 0}
.moreEnd{color:var(--muted);font-size:12px;text-align:center;padding:8px 0}
</style>