<!-- src/views/InboxView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { readAllNotifications, readNotification, clearReadNotifications } from "@/api/notifications";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "vue-router";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";

const router = useRouter();
const toast = useToastStore();
const noti = useNotificationsStore();

const busy = ref(false);
const cleaning = ref(false);

const items = computed(() => noti.items);
const hasUnread = computed(() => noti.hasUnread);
const unreadCount = computed(() => Number(noti.unreadCount || 0));
const loading = computed(() => noti.loading);
const loadingMore = computed(() => noti.loadingMore);
const hasNext = computed(() => noti.hasNext);
const error = computed(() => noti.error);

const reminderItems = computed(() =>
  (items.value || []).filter((n) => String(n?.type || "") === "PIN_REMIND")
);
const unreadReminderCount = computed(() => reminderItems.value.filter((n) => !n.read).length);
const latestReminder = computed(() => reminderItems.value[0] || null);

const messageItems = computed(() =>
  (items.value || []).filter((n) => String(n?.type || "") === "MESSAGE_RECEIVED")
);
const unreadMessageCount = computed(() => messageItems.value.filter((n) => !n.read).length);
const commentItems = computed(() =>
  (items.value || []).filter((n) => {
    const t = String(n?.type || "");
    return t === "COMMENT_CREATED" || t === "POST_COMMENT";
  })
);
const unreadCommentCount = computed(() => commentItems.value.filter((n) => !n.read).length);
const likeItems = computed(() =>
  (items.value || []).filter((n) => {
    const t = String(n?.type || "");
    return t === "POST_LIKE" || t === "POST_LIKED";
  })
);

const latestMessage = computed(() => messageItems.value[0] || null);
const latestComment = computed(() => commentItems.value[0] || null);

const reminderSummaryMeta = computed(() => {
  const body = String(latestReminder.value?.body || "").trim();
  return body || "곧 다가오는 약속·할일을 바로 이어갈 수 있어요.";
});

const nextActionHint = computed(() => {
  if (pendingAction.value) {
    return `${pendingKindLabel(pendingAction.value.kind)} 액션을 대화로 바로 이어갈 수 있어요.`;
  }
  if (latestReminder.value) {
    return "가장 가까운 리마인더를 열고 실제 행동으로 이어가 보세요.";
  }
  if (latestMessage.value) {
    return "새 메시지에 답장하면서 약속·할일·장소를 정리할 수 있어요.";
  }
  if (latestComment.value) {
    return "댓글 흐름을 보고 필요한 액션을 대화로 가져와 보세요.";
  }
  return "대화, 리마인더, 댓글 흐름이 생기면 이 공간에서 바로 이어갈 수 있어요.";
});

const pendingAction = ref(null);

const scanStrip = computed(() => {
  if (pendingAction.value) {
    return [
      {
        label: "지금 먼저 볼 것",
        value: `${pendingKindLabel(pendingAction.value.kind)} 액션 연결`,
        tone: "accent",
      },
      {
        label: "왜 먼저 봐야 하나",
        value: "댓글에서 생긴 흐름을 대화로 바로 이어갈 수 있어요.",
        tone: "warning",
      },
      {
        label: "어디로 가면 되나",
        value: "대화 목록에서 가장 맞는 방을 선택하면 돼요.",
        tone: "normal",
      },
    ];
  }

  if (latestReminder.value) {
    return [
      {
        label: "지금 먼저 볼 것",
        value: "가장 가까운 리마인더",
        tone: "accent",
      },
      {
        label: "왜 먼저 봐야 하나",
        value: "실제 행동으로 이어질 가능성이 가장 높아요.",
        tone: "warning",
      },
      {
        label: "어디로 가면 되나",
        value: "리마인더를 열고 대화·핀 흐름으로 이어가면 돼요.",
        tone: "normal",
      },
    ];
  }

  if (latestMessage.value) {
    return [
      {
        label: "지금 먼저 볼 것",
        value: "답장이 필요한 최근 메시지",
        tone: "accent",
      },
      {
        label: "왜 먼저 봐야 하나",
        value: "대화의 온도가 식기 전에 실제 행동으로 이어갈 수 있어요.",
        tone: "warning",
      },
      {
        label: "어디로 가면 되나",
        value: "대화 목록이나 최신 메시지 알림에서 바로 들어가면 돼요.",
        tone: "normal",
      },
    ];
  }

  return [
    {
      label: "지금 먼저 볼 것",
      value: unreadCount.value ? `읽지 않은 알림 ${unreadCount.value}개` : "새로 들어온 흐름 확인",
      tone: "accent",
    },
    {
      label: "왜 먼저 봐야 하나",
      value: "댓글, 메시지, 리마인더가 행동으로 이어지는 출발점이에요.",
      tone: "warning",
    },
    {
      label: "어디로 가면 되나",
      value: "Inbox에서 알림을 열고 대화나 게시글로 바로 이동하면 돼요.",
      tone: "normal",
    },
  ];
});

const inboxSummaryPills = computed(() => {
  const list = [];
  if (pendingAction.value) list.push(`가져온 액션 1`);
  if (unreadReminderCount.value) list.push(`리마인더 ${unreadReminderCount.value}`);
  if (unreadMessageCount.value) list.push(`답장 필요 ${unreadMessageCount.value}`);
  if (unreadCommentCount.value) list.push(`댓글 ${unreadCommentCount.value}`);
  if (likeItems.value.length) list.push(`좋아요 ${likeItems.value.length}`);
  if (!list.length) list.push("새 흐름 대기 중");
  return list;
});

const todayPriorityTitle = computed(() => {
  if (pendingAction.value) return "오늘의 우선 액션은 댓글에서 만든 흐름을 대화로 연결하는 거예요";
  if (latestReminder.value) return "오늘은 가장 가까운 리마인더부터 확인하는 게 좋아요";
  if (latestMessage.value) return "지금은 최근 메시지 흐름에 답장하면서 행동으로 이어가면 좋아요";
  if (latestComment.value) return "최근 댓글 흐름을 보고 다음 액션이 필요한지 확인해 보세요";
  return "Inbox는 다음 행동으로 이어질 흐름을 가장 먼저 정리하는 공간이에요";
});

const todayPriorityBody = computed(() => {
  if (pendingAction.value) {
    return "이미 댓글에서 만든 액션이 준비되어 있어서, 새로 고민하기보다 어떤 대화방으로 가져갈지만 빠르게 결정하면 돼요.";
  }
  if (latestReminder.value) {
    return "리마인더는 시점이 가까울수록 가치가 커져요. 가장 가까운 알림부터 열고 실제 약속·할일·장소 흐름을 확인해 보세요.";
  }
  if (latestMessage.value) {
    return "메시지가 막 도착한 대화는 온도가 높아서 약속이나 할일로 이어질 가능성이 커요. 답장이 필요한 흐름부터 보는 게 좋아요.";
  }
  if (latestComment.value) {
    return "댓글은 가볍게 지나가기 쉽지만, 실제 약속이나 장소 제안의 출발점이 되기도 해요. 최근 댓글을 먼저 훑어보면 좋아요.";
  }
  return "새 알림이 많지 않아도 Inbox는 댓글, 메시지, 리마인더를 실제 행동으로 묶어 주는 허브예요.";
});

function enc(v) {
  return encodeURIComponent(String(v ?? ""));
}

function loadPendingAction() {
  try {
    pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
  } catch {
    pendingAction.value = null;
  }
}

function clearPendingAction() {
  try {
    sessionStorage.removeItem("reallife:pendingAction");
  } catch {}
  pendingAction.value = null;
}

function goConversations() {
  router.push("/inbox/conversations");
}

function goNewDm() {
  router.push("/inbox/new");
}

function pendingKindLabel(kind) {
  if (kind === "PROMISE") return "📅 약속";
  if (kind === "TODO") return "✅ 할일";
  return "📍 장소";
}

function pendingSourceRoute() {
  const p = pendingAction.value;
  if (!p) return "";
  if (p.sourceRoute) return String(p.sourceRoute);
  if (p.postId) return `/posts/${enc(p.postId)}`;
  return "";
}

function pendingSourceMeta() {
  const p = pendingAction.value;
  if (!p) return "";
  const author = p.sourcePostAuthorHandle || p.sourcePostAuthorName || p.authorHandle || "";
  const label = p.sourceLabel || "게시글 댓글";
  return author ? `${label} · ${String(author).replace(/^@?/, "@")}` : label;
}

function pendingSourcePreview() {
  const p = pendingAction.value;
  if (!p) return "";
  return String(p.sourcePostPreview || p.text || "")
    .trim()
    .slice(0, 88);
}

function goPendingSource() {
  const to = pendingSourceRoute();
  if (to) router.push(to);
}

function latestMessagePreview() {
  const body = String(latestMessage.value?.body || "").trim();
  return body || "가장 최근 메시지 흐름으로 들어가 보세요.";
}

function latestCommentPreview() {
  const body = String(latestComment.value?.body || "").trim();
  return body || "최근 댓글 흐름에서 액션을 만들 수 있어요.";
}

async function openLatestReminder() {
  if (!latestReminder.value) return;
  await openItem(latestReminder.value);
}

async function openLatestMessage() {
  if (!latestMessage.value) return;
  await openItem(latestMessage.value);
}

async function openLatestComment() {
  if (!latestComment.value) return;
  await openItem(latestComment.value);
}

function formatType(t) {
  if (t === "MESSAGE_RECEIVED") return "메시지";
  if (t === "COMMENT_CREATED" || t === "POST_COMMENT") return "댓글";
  if (t === "POST_LIKED" || t === "POST_LIKE") return "좋아요";
  if (t === "PIN_CREATED") return "핀";
  if (t === "PIN_REMIND") return "리마인드";
  return t || "알림";
}

function formatTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function itemStatus(n) {
  const type = String(n?.type || "");
  if (type === "PIN_REMIND") return !n?.read ? "지금 확인" : "확인해 둔 리마인더";
  if (type === "MESSAGE_RECEIVED") return !n?.read ? "답장 대기" : "최근 대화 흐름";
  if (type === "POST_COMMENT" || type === "COMMENT_CREATED") return !n?.read ? "반응 확인 필요" : "댓글 흐름 확인됨";
  if (type === "POST_LIKE" || type === "POST_LIKED") return !n?.read ? "가벼운 반응 도착" : "확인된 반응";
  return !n?.read ? "새 알림" : "확인한 알림";
}

function itemNextAction(n) {
  const type = String(n?.type || "");
  if (type === "PIN_REMIND") return "리마인더를 열고 대화·핀 흐름으로 이어가기";
  if (type === "MESSAGE_RECEIVED") return "대화로 이동해서 답장하거나 액션 만들기";
  if (type === "POST_COMMENT" || type === "COMMENT_CREATED") return "댓글 맥락 보고 약속·할일·장소 흐름으로 이어가기";
  if (type === "POST_LIKE" || type === "POST_LIKED") return "반응을 확인하고 필요한 경우 게시글로 이동하기";
  return "상세 흐름을 열어 다음 행동 정하기";
}

function itemPriorityTone(n) {
  const type = String(n?.type || "");
  if (!n?.read && (type === "PIN_REMIND" || type === "MESSAGE_RECEIVED")) return "strong";
  if (!n?.read) return "warning";
  return "normal";
}

async function refreshNow() {
  await noti._refreshNow?.();
  if (!noti._refreshNow) await noti.refresh();
}

async function markAllRead() {
  if (busy.value) return;
  busy.value = true;
  noti.markAllLocalRead?.();
  try {
    await readAllNotifications();
    toast.success("완료", "알림을 모두 읽음 처리했어요.");
    noti.refresh?.();
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    await refreshNow();
  } finally {
    busy.value = false;
  }
}

async function clearRead() {
  if (cleaning.value) return;
  cleaning.value = true;
  try {
    const res = await clearReadNotifications();
    const removedLocal = noti.purgeReadLocal?.() ?? 0;
    toast.success("정리 완료", `읽은 알림 ${res?.deletedCount ?? removedLocal ?? 0}개를 정리했어요.`);
    noti.refresh?.();
  } catch (e) {
    toast.error("실패", e?.response?.data?.message || "잠시 후 다시 시도해주세요.");
    await refreshNow();
  } finally {
    cleaning.value = false;
  }
}

async function routeForNotification(n) {
  if (n.type === "PIN_CREATED" || n.type === "PIN_REMIND") {
    const cid = n.conversationId;
    if (!cid) return "/inbox/conversations";
    return `/inbox/conversations/${cid}/pins?pinId=${enc(n.refId)}&notiId=${enc(n.id)}`;
  }
  if (n.type === "MESSAGE_RECEIVED") {
    if (!n.refId) return "/inbox/conversations";
    if (n.messageId || n.ref2Id) {
      return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1&mid=${enc(n.messageId || n.ref2Id)}`;
    }
    return `/inbox/conversations/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
  }
  if (n.type === "POST_COMMENT") {
    const pid = n.ref2Id || n.postId || null;
    if (pid) return `/posts/${enc(pid)}?notiId=${enc(n.id)}&fromNoti=1`;
    return "/inbox";
  }
  if (n.type === "POST_LIKE" || n.type === "POST_LIKED") {
    if (n.refId) return `/posts/${enc(n.refId)}?notiId=${enc(n.id)}&fromNoti=1`;
    return "/inbox";
  }
  return "/inbox/conversations";
}

async function openItem(n) {
  const wasUnread = !n.read;
  if (wasUnread) noti.markLocalRead?.(n.id);
  try {
    if (wasUnread) await readNotification(n.id);
  } catch {}
  const to = await routeForNotification(n);
  if (router.currentRoute.value.fullPath !== to) router.push(to);
  noti.refresh?.();
}

const sentinelEl = ref(null);
let io = null;

async function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return;
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
    { root: null, rootMargin: "200px", threshold: 0.01 }
  );
  if (sentinelEl.value) io.observe(sentinelEl.value);
}

onMounted(async () => {
  loadPendingAction();
  await refreshNow();
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
    <header class="head rl-cardish">
      <div>
        <div class="eyebrow">CONNECT</div>
        <h1 class="title">Inbox</h1>
        <p class="sub">다음 행동, 리마인더, 대화 흐름을 한곳에서 이어가요.</p>
      </div>
      <div class="actions">
        <RlButton size="sm" variant="primary" @click="goNewDm">새 DM</RlButton>
        <RlButton size="sm" variant="soft" @click="goConversations">대화</RlButton>
        <RlButton size="sm" variant="soft" @click="refreshNow" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <section class="scanStrip">
      <article
        v-for="entry in scanStrip"
        :key="`${entry.label}-${entry.value}`"
        class="scanCard rl-cardish"
        :class="`scanCard--${entry.tone}`"
      >
        <div class="scanLabel">{{ entry.label }}</div>
        <div class="scanValue">{{ entry.value }}</div>
      </article>
    </section>

    <section class="hero rl-cardish">
      <div class="heroMain">
        <div class="heroLabel">지금 바로 이어질 수 있는 흐름</div>
        <div class="heroTitle">
          {{
            pendingAction
              ? "댓글에서 만든 액션을 대화로 가져갈 수 있어요"
              : latestReminder
                ? "가장 가까운 리마인더부터 이어가 보세요"
                : latestMessage
                  ? "최근 메시지 흐름을 실제 행동으로 연결해 보세요"
                  : "Connect는 행동이 시작되는 공간이에요"
          }}
        </div>
        <div class="heroSub">{{ nextActionHint }}</div>
        <div class="heroPills">
          <span v-for="pill in inboxSummaryPills" :key="pill" class="heroPill">{{ pill }}</span>
        </div>
      </div>
      <div class="heroStats">
        <div class="heroStat">
          <strong>{{ unreadCount }}</strong>
          <span>읽지 않은 알림</span>
        </div>
        <div class="heroStat">
          <strong>{{ unreadReminderCount }}</strong>
          <span>미확인 리마인더</span>
        </div>
        <div class="heroStat">
          <strong>{{ messageItems.length }}</strong>
          <span>메시지 흐름</span>
        </div>
      </div>
    </section>

    <section class="priority rl-cardish">
      <div class="priorityEyebrow">오늘의 우선 액션</div>
      <div class="priorityTitle">{{ todayPriorityTitle }}</div>
      <div class="priorityBody">{{ todayPriorityBody }}</div>
      <div class="priorityActions">
        <RlButton
          v-if="pendingAction"
          size="sm"
          variant="primary"
          @click="goConversations"
        >대화방 선택</RlButton>
        <RlButton
          v-else-if="latestReminder"
          size="sm"
          variant="primary"
          @click="openLatestReminder"
        >리마인더 열기</RlButton>
        <RlButton
          v-else-if="latestMessage"
          size="sm"
          variant="primary"
          @click="openLatestMessage"
        >최근 메시지 열기</RlButton>
        <RlButton
          v-else-if="latestComment"
          size="sm"
          variant="primary"
          @click="openLatestComment"
        >최근 댓글 열기</RlButton>
        <RlButton
          v-else
          size="sm"
          variant="primary"
          @click="goNewDm"
        >새 흐름 시작</RlButton>
        <RlButton size="sm" variant="soft" @click="goConversations">대화 목록</RlButton>
      </div>
    </section>

    <section v-if="pendingAction" class="bridge rl-cardish">
      <div class="bridgeTop">{{ pendingSourceMeta() }}</div>
      <div class="bridgeTitle">댓글에서 가져온 액션이 준비되어 있어요</div>
      <div class="bridgeSub">
        <span class="bridgeKind">{{ pendingKindLabel(pendingAction.kind) }}</span>
        <span class="bridgeQuote">“{{ pendingAction.text }}”</span>
      </div>
      <div v-if="pendingSourcePreview()" class="bridgePreview">원문: {{ pendingSourcePreview() }}</div>
      <div class="bridgeActions">
        <RlButton size="sm" variant="primary" @click="goConversations">대화방 선택</RlButton>
        <RlButton v-if="pendingSourceRoute()" size="sm" variant="soft" @click="goPendingSource">원문 보기</RlButton>
        <RlButton size="sm" variant="ghost" @click="clearPendingAction">닫기</RlButton>
      </div>
    </section>

    <section class="laneGrid">
      <button
        class="laneCard rl-cardish laneCard--action"
        type="button"
        @click="pendingAction ? goConversations() : goNewDm()"
      >
        <div class="laneEyebrow">다음 행동</div>
        <div class="laneTitle">
          {{ pendingAction ? "이 액션을 대화에 연결" : "새 대화에서 행동 시작" }}
        </div>
        <div class="laneBody">
          {{
            pendingAction
              ? `${pendingKindLabel(pendingAction.kind)} · ${String(pendingAction.text || "").slice(0, 54)}`
              : "아직 가져온 액션이 없어도 새 DM으로 약속·할일·장소 흐름을 시작할 수 있어요."
          }}
        </div>
      </button>

      <button
        class="laneCard rl-cardish laneCard--remind"
        type="button"
        @click="latestReminder ? openLatestReminder() : goConversations()"
      >
        <div class="laneEyebrow">리마인더</div>
        <div class="laneTitle">
          {{ latestReminder ? "가장 가까운 리마인더 열기" : "예정된 리마인더를 기다리는 중" }}
        </div>
        <div class="laneBody">
          {{ reminderSummaryMeta }}
        </div>
      </button>

      <button
        class="laneCard rl-cardish laneCard--message"
        type="button"
        @click="latestMessage ? openLatestMessage() : goConversations()"
      >
        <div class="laneEyebrow">대화 진입</div>
        <div class="laneTitle">
          {{ latestMessage ? "최근 메시지 흐름으로 들어가기" : "대화 목록에서 이어가기" }}
        </div>
        <div class="laneBody">{{ latestMessagePreview() }}</div>
      </button>
    </section>

    <section class="summary rl-cardish">
      <div class="sumLeft">
        <div class="sumTitle">알림 요약</div>
        <div class="sumValue">{{ unreadCount }}개</div>
      </div>
      <div class="sumMeta">
        <span class="sumChip">메시지 {{ messageItems.length }}</span>
        <span class="sumChip">댓글 {{ commentItems.length }}</span>
        <span class="sumChip">좋아요 {{ likeItems.length }}</span>
      </div>
      <div class="sumActions">
        <RlButton size="sm" variant="soft" @click="markAllRead" :disabled="busy || loading || !hasUnread">전체 읽음</RlButton>
        <RlButton size="sm" variant="soft" @click="clearRead" :disabled="cleaning || loading || !items.length">읽은 알림 정리</RlButton>
      </div>
    </section>

    <section v-if="latestComment" class="commentLane rl-cardish">
      <div class="commentLane__head">
        <div>
          <div class="commentLane__eyebrow">최근 댓글 흐름</div>
          <div class="commentLane__title">댓글에서도 바로 액션을 만들 수 있어요</div>
        </div>
        <RlButton size="sm" variant="soft" @click="openLatestComment">열기</RlButton>
      </div>
      <div class="commentLane__body">{{ latestCommentPreview() }}</div>
    </section>

    <AsyncStatePanel
      v-if="loading && !items.length"
      icon="⏳"
      title="새 흐름을 불러오는 중이에요"
      description="리마인더, 메시지, 댓글 흐름을 모으고 있어요."
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="Connect 흐름을 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="대화로 이동"
      @primary="refreshNow"
      @secondary="goConversations"
    />
    <AsyncStatePanel
      v-else-if="items.length === 0"
      icon="✨"
      title="아직 이어질 흐름이 없어요"
      description="새 메시지, 댓글, 리마인더가 생기면 이곳에서 바로 다음 행동으로 이어갈 수 있어요."
      primary-label="새 DM 시작"
      secondary-label="새로고침"
      @primary="goNewDm"
      @secondary="refreshNow"
    />

    <div v-else class="listWrap">
      <div class="listHead">
        <div>
          <div class="listTitle">모든 알림</div>
          <div class="listSub">가장 최근 흐름부터 확인하고 필요한 행동으로 연결해 보세요.</div>
        </div>
        <div class="listGuide">알림마다 현재 상태와 다음 액션을 먼저 보고 열 수 있어요.</div>
      </div>

      <div class="list">
        <button
          v-for="n in items"
          :key="n.id"
          class="item rl-cardish"
          :class="[{ unread: !n.read }, `item--${itemPriorityTone(n)}`]"
          type="button"
          @click="openItem(n)"
        >
          <div class="line1">
            <span class="typeWrap">
              <span class="type">{{ formatType(n.type) }}</span>
              <span v-if="!n.read" class="newBadge">NEW</span>
            </span>
            <span class="time">{{ formatTime(n.createdAt || n.createdDateTime) }}</span>
          </div>

          <div class="body">{{ n.body || "알림 내용이 도착하면 여기에 보여요." }}</div>

          <div class="statusBox">
            <div class="statusLine">
              <span class="statusLabel">현재 상태</span>
              <span class="statusValue">{{ itemStatus(n) }}</span>
            </div>
            <div class="statusLine">
              <span class="statusLabel">다음 액션</span>
              <span class="statusValue statusValue--muted">{{ itemNextAction(n) }}</span>
            </div>
          </div>

          <div class="line2">
            <span class="hint">
              {{
                n.type === "PIN_REMIND"
                  ? "리마인더 열기"
                  : n.type === "MESSAGE_RECEIVED"
                    ? "대화로 이동"
                    : n.type === "POST_COMMENT"
                      ? "댓글 흐름 보기"
                      : "자세히 보기"
              }}
            </span>
            <span class="arrow">›</span>
          </div>
        </button>
      </div>

      <div ref="sentinelEl" class="sentinel">
        <div v-if="loadingMore" class="loadingMore">더 불러오는 중…</div>
        <div v-else-if="!hasNext" class="end">여기까지 확인했어요 ✨</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 96px;max-width:980px;margin:0 auto;display:grid;gap:12px}
.rl-cardish{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 86%,transparent);box-shadow:0 18px 60px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.06) inset;backdrop-filter:blur(14px)}
.head{border-radius:22px;padding:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}
.title{margin:6px 0 0;font-size:24px;font-weight:950}
.sub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.45}
.actions{display:flex;gap:8px;flex-wrap:wrap}

.scanStrip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.scanCard{border-radius:18px;padding:14px;display:grid;gap:7px}
.scanCard--accent{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.scanCard--warning{background:linear-gradient(180deg,color-mix(in oklab,var(--warning) 9%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.scanCard--normal{background:linear-gradient(180deg,rgba(255,255,255,.03),color-mix(in oklab,var(--surface) 86%,transparent))}
.scanLabel{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.scanValue{font-size:14px;font-weight:900;line-height:1.45}

.hero{border-radius:24px;padding:16px;display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
.heroLabel{font-size:12px;font-weight:900;letter-spacing:.05em;color:color-mix(in oklab,var(--accent) 78%,white)}
.heroTitle{margin-top:8px;font-size:22px;font-weight:950;line-height:1.22}
.heroSub{margin-top:8px;color:var(--muted);line-height:1.55}
.heroPills{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.heroPill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);font-size:12px;font-weight:900}
.heroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.heroStat{padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:5px}
.heroStat strong{font-size:22px;font-weight:950}
.heroStat span{font-size:12px;color:var(--muted)}

.priority{border-radius:22px;padding:15px;display:grid;gap:8px}
.priorityEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:color-mix(in oklab,var(--accent) 76%,white)}
.priorityTitle{font-size:19px;font-weight:950;line-height:1.35}
.priorityBody{color:var(--muted);font-size:13px;line-height:1.6}
.priorityActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}

.bridge{border-radius:22px;padding:15px}
.bridgeTop{font-size:11px;font-weight:900;color:color-mix(in oklab,var(--accent) 76%,white)}
.bridgeTitle{margin-top:6px;font-size:18px;font-weight:950}
.bridgeSub{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px}
.bridgeKind{font-weight:900}
.bridgeQuote{opacity:.94}
.bridgePreview{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.45}
.bridgeActions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}

.laneGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.laneCard{padding:16px;border-radius:22px;text-align:left;cursor:pointer;display:grid;gap:8px;transition:transform .16s ease,border-color .18s ease,background .18s ease}
.laneCard:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 34%,var(--border))}
.laneCard--action{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.laneCard--remind{background:linear-gradient(180deg,color-mix(in oklab,var(--success) 8%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.laneCard--message{background:linear-gradient(180deg,color-mix(in oklab,var(--warning) 8%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.laneEyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.laneTitle{font-size:17px;font-weight:950;line-height:1.28}
.laneBody{font-size:13px;color:var(--muted);line-height:1.5}

.summary{border-radius:20px;padding:14px 15px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}
.sumTitle{font-size:12px;color:var(--muted);font-weight:900}
.sumValue{margin-top:4px;font-size:24px;font-weight:950}
.sumMeta{display:flex;gap:8px;flex-wrap:wrap}
.sumChip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);font-size:12px;font-weight:900}
.sumActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}

.commentLane{border-radius:20px;padding:14px 15px}
.commentLane__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.commentLane__eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.commentLane__title{margin-top:6px;font-size:16px;font-weight:950}
.commentLane__body{margin-top:8px;color:var(--muted);line-height:1.55;font-size:13px}

.listWrap{display:grid;gap:10px}
.listHead{padding:2px 2px 0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.listTitle{font-size:18px;font-weight:950}
.listSub{margin-top:4px;color:var(--muted);font-size:13px}
.listGuide{font-size:12px;color:var(--muted);max-width:320px;text-align:right;line-height:1.5}
.list{display:grid;gap:10px}
.item{width:100%;text-align:left;border-radius:18px;padding:14px;cursor:pointer;transition:transform .14s ease,border-color .18s ease,background .18s ease}
.item:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 30%,var(--border))}
.item.unread{border-color:color-mix(in oklab,var(--accent) 28%,var(--border));background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 7%,transparent),color-mix(in oklab,var(--surface) 86%,transparent))}
.item--strong{border-color:color-mix(in oklab,var(--accent) 30%,var(--border))}
.item--warning{border-color:color-mix(in oklab,var(--warning) 22%,var(--border))}
.line1,.line2{display:flex;align-items:center;justify-content:space-between;gap:10px}
.typeWrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.type{font-size:12px;font-weight:900;color:color-mix(in oklab,var(--text) 92%,white)}
.newBadge{height:20px;padding:0 8px;border-radius:999px;background:color-mix(in oklab,var(--accent) 72%,white);color:#0b1020;font-size:11px;font-weight:950;display:inline-flex;align-items:center}
.time{font-size:12px;color:var(--muted)}
.body{margin-top:9px;line-height:1.5;color:color-mix(in oklab,var(--text) 90%,white)}
.statusBox{margin-top:11px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:grid;gap:7px}
.statusLine{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.statusLabel{font-size:11px;font-weight:900;letter-spacing:.06em;color:var(--muted);min-width:62px}
.statusValue{font-size:12px;font-weight:900;line-height:1.45;text-align:right}
.statusValue--muted{color:var(--muted);font-weight:800}
.line2{margin-top:10px}
.hint{font-size:12px;color:var(--muted);font-weight:800}
.arrow{font-size:20px;opacity:.45}
.sentinel{padding:8px 0 2px;text-align:center}
.loadingMore,.end{font-size:12px;color:var(--muted)}

@media (max-width:820px){
  .scanStrip,.hero,.laneGrid{grid-template-columns:1fr}
  .heroStats{grid-template-columns:1fr 1fr 1fr}
  .summary{grid-template-columns:1fr;align-items:flex-start}
  .sumActions{justify-content:flex-start}
  .listGuide{text-align:left;max-width:none}
}
@media (max-width:640px){
  .page{padding:14px 12px 96px}
  .title{font-size:22px}
  .heroTitle{font-size:20px}
  .heroStats{grid-template-columns:1fr}
  .statusLine{grid-template-columns:1fr;display:grid}
  .statusValue{text-align:left}
}
</style>
