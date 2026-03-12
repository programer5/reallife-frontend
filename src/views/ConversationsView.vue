<!-- src/views/ConversationsView.vue -->
<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import RlButton from "@/components/ui/RlButton.vue";
import { useConversationsStore } from "@/stores/conversations";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";

const router = useRouter();
const conv = useConversationsStore();

const items = computed(() => conv.items);
const loading = computed(() => conv.loading);
const error = computed(() => conv.error);
const unreadTotal = computed(() =>
  (conv.items || []).reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
);

const pendingAction = ref(null);
const pendingActionExists = computed(() => !!pendingAction.value);
const pendingTargetConversationId = ref("");

function loadPendingAction() {
  try {
    pendingAction.value = JSON.parse(sessionStorage.getItem("reallife:pendingAction") || "null");
  } catch {
    pendingAction.value = null;
  }
}
function loadPendingTarget() {
  try {
    pendingTargetConversationId.value = String(
      sessionStorage.getItem("reallife:pendingActionTargetConversationId") || ""
    );
  } catch {
    pendingTargetConversationId.value = "";
  }
}
function markPendingTarget(conversationId) {
  const v = String(conversationId || "");
  try {
    sessionStorage.setItem("reallife:pendingActionTargetConversationId", v);
  } catch {}
  pendingTargetConversationId.value = v;
}
function isPendingTarget(conversationId) {
  return pendingActionExists.value && String(conversationId) === String(pendingTargetConversationId.value || "");
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
  if (p.postId) return `/posts/${encodeURIComponent(String(p.postId))}`;
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
  return String(p.sourcePostPreview || p.text || "").trim().slice(0, 92);
}
function goPendingSource() {
  const to = pendingSourceRoute();
  if (to) router.push(to);
}

function openConversation(id) {
  if (pendingActionExists.value) markPendingTarget(id);
  router.push(`/inbox/conversations/${id}`);
}

function goNewDm() {
  router.push("/inbox/new");
}

const activeConversationCount = computed(() => items.value.length);
const responsiveConversationCount = computed(() =>
  items.value.filter((c) => Number(c?.unreadCount || 0) === 0).length
);
const unreadConversationCount = computed(() =>
  items.value.filter((c) => Number(c?.unreadCount || 0) > 0).length
);
const staleConversationCount = computed(() =>
  items.value.filter((c) => {
    const raw = c?.lastMessageAt || c?.updatedAt;
    const t = Date.parse(raw || "");
    if (!Number.isFinite(t)) return false;
    return Date.now() - t > 1000 * 60 * 60 * 24 * 3;
  }).length
);
const recentActiveCount = computed(() =>
  items.value.filter((c) => {
    const raw = c?.lastMessageAt || c?.updatedAt;
    const t = Date.parse(raw || "");
    if (!Number.isFinite(t)) return false;
    return Date.now() - t <= 1000 * 60 * 60 * 24;
  }).length
);

const suggestedTitle = computed(() => {
  if (pendingActionExists.value) return "이 액션을 어느 대화로 가져갈지 선택해 보세요";
  if (items.value.length > 0) return "최근 대화 흐름에서 바로 이어가 보세요";
  return "첫 대화를 시작하면 Connect 흐름이 본격적으로 열려요";
});
const suggestedSub = computed(() => {
  if (pendingActionExists.value) {
    return `${pendingKindLabel(pendingAction.value?.kind)} 액션을 가장 자연스러운 대화방에 연결할 수 있어요.`;
  }
  if (unreadTotal.value > 0) {
    return "읽지 않은 메시지가 있는 대화부터 확인하면 흐름을 놓치지 않아요.";
  }
  return "대화는 메시지에서 끝나는 게 아니라 약속·할일·장소로 이어질 수 있어요.";
});

const firstPriorityTitle = computed(() => {
  if (pendingActionExists.value) return "이 액션을 바로 이해할 상대의 대화를 고르기";
  if (unreadConversationCount.value > 0) return "읽지 않은 메시지가 있는 대화부터 열기";
  if (recentActiveCount.value > 0) return "오늘 흐름이 살아 있는 대화부터 이어가기";
  if (items.value.length > 0) return "최근 대화 중 하나를 열고 현재 흐름 확인하기";
  return "새 DM으로 첫 대화 열기";
});
const firstPriorityReason = computed(() => {
  if (pendingActionExists.value) return "액션은 맥락이 살아 있을 때 연결할수록 약속·할일·장소 전환이 자연스러워져요.";
  if (unreadConversationCount.value > 0) return "답장이 필요한 흐름을 먼저 보면 대화 리듬이 끊기지 않아요.";
  if (recentActiveCount.value > 0) return "최근에 움직인 대화는 실제 행동으로 이어질 가능성이 가장 높아요.";
  if (items.value.length > 0) return "잠깐만 확인해도 다음 액션이 필요한 대화를 빠르게 찾을 수 있어요.";
  return "첫 대화가 생겨야 Connect에서 관계와 액션 흐름이 시작돼요.";
});
const firstPriorityDestination = computed(() => {
  if (pendingActionExists.value) return "액션을 가져갈 대화 선택";
  if (unreadConversationCount.value > 0) return "읽지 않은 대화";
  if (recentActiveCount.value > 0) return "오늘 대화한 상대";
  if (items.value.length > 0) return "최근 대화 목록";
  return "새 DM";
});

const nowTick = ref(Date.now());
let _timeTimer = null;
let _timeTimer2 = null;

onMounted(async () => {
  loadPendingAction();
  loadPendingTarget();
  await conv._refreshNow?.();
  if (!conv._refreshNow) await conv.refresh();

  const delay = 60000 - (Date.now() % 60000);
  _timeTimer = setTimeout(() => {
    nowTick.value = Date.now();
    _timeTimer2 = setInterval(() => {
      nowTick.value = Date.now();
    }, 60000);
  }, delay);
});

onBeforeUnmount(() => {
  if (_timeTimer) clearTimeout(_timeTimer);
  if (_timeTimer2) clearInterval(_timeTimer2);
  _timeTimer = null;
  _timeTimer2 = null;
});

function fmtListTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";

  const now = nowTick.value;
  const diffMs = now - t;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;

  const d = new Date(t);
  const nowD = new Date(now);
  const sameDay =
    d.getFullYear() === nowD.getFullYear() &&
    d.getMonth() === nowD.getMonth() &&
    d.getDate() === nowD.getDate();

  const y = new Date(nowD);
  y.setDate(nowD.getDate() - 1);
  const isYesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h < 12 ? "오전" : "오후";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${ap} ${hh}:${m}`;
  }
  if (isYesterday) return "어제";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function peerName(c) {
  return c.peerUser?.nickname || c.peerUser?.name || "상대";
}

function conversationPreview(c) {
  return c.lastMessagePreview || "메시지가 오면 여기에 보여요.";
}

function conversationPriorityLabel(c) {
  if (pendingActionExists.value && isPendingTarget(c.conversationId)) return "지금 가장 적합";
  if (Number(c?.unreadCount || 0) > 0) return "먼저 확인";
  if (isRecentConversation(c)) return "흐름 살아 있음";
  return "천천히 확인";
}

function conversationPriorityTone(c) {
  if (pendingActionExists.value && isPendingTarget(c.conversationId)) return "priority-strong";
  if (Number(c?.unreadCount || 0) > 0) return "priority-warning";
  if (isRecentConversation(c)) return "priority-fresh";
  return "priority-normal";
}

function conversationNextAction(c) {
  if (pendingActionExists.value && isPendingTarget(c.conversationId)) return "열어서 액션 Dock으로 바로 이어가기";
  if (pendingActionExists.value) return "들어가서 이 액션을 연결할지 확인하기";
  if (Number(c?.unreadCount || 0) > 0) return "답장이 필요한 메시지부터 확인하기";
  if (isRecentConversation(c)) return "최근 대화 맥락에서 바로 이어가기";
  return "현재 흐름을 잠깐 확인해 보기";
}

function conversationStatusLine(c) {
  const unread = Number(c?.unreadCount || 0);
  if (pendingActionExists.value && isPendingTarget(c.conversationId)) {
    return "선택된 액션을 이 대화로 가져가도록 표시해 둔 상태예요.";
  }
  if (unread > 0) {
    return `읽지 않은 메시지 ${unread}개가 있어 먼저 보면 좋은 상태예요.`;
  }
  if (isRecentConversation(c)) {
    return "최근에 메시지가 오간 흐름이라 지금 이어가도 어색하지 않아요.";
  }
  return "새 답장은 없지만 관계 흐름을 다시 살펴보기 좋은 대화예요.";
}

function isRecentConversation(c) {
  const raw = c?.lastMessageAt || c?.updatedAt;
  const t = Date.parse(raw || "");
  if (!Number.isFinite(t)) return false;
  return nowTick.value - t <= 1000 * 60 * 60 * 24;
}

function isStaleConversation(c) {
  const raw = c?.lastMessageAt || c?.updatedAt;
  const t = Date.parse(raw || "");
  if (!Number.isFinite(t)) return false;
  return nowTick.value - t > 1000 * 60 * 60 * 24 * 3;
}

function activityMeta(c) {
  if (Number(c?.unreadCount || 0) > 0) return `읽지 않음 ${c.unreadCount > 99 ? "99+" : c.unreadCount}`;
  if (isRecentConversation(c)) return "최근 대화";
  if (isStaleConversation(c)) return "오랜만에 확인";
  return "안정적 흐름";
}
</script>

<template>
  <div class="page">
    <div v-if="pendingActionExists" class="pendingBanner rl-cardish" role="status">
      <div class="pbLeft">
        <div class="pbEyebrow">{{ pendingSourceMeta() }}</div>
        <div class="pbTitle">댓글에서 만든 액션이 준비돼 있어요</div>
        <div class="pbSub">
          <span class="pbKind">{{ pendingKindLabel(pendingAction.kind) }}</span>
          <span class="pbQuote">“{{ pendingAction.text }}”</span>
        </div>
        <div v-if="pendingSourcePreview()" class="pbSourcePreview">원문: {{ pendingSourcePreview() }}</div>
      </div>
      <div class="pendingBannerActions">
        <RlButton v-if="pendingSourceRoute()" size="sm" variant="soft" @click="goPendingSource">원문 보기</RlButton>
        <RlButton size="sm" variant="primary" @click="goNewDm">새 대화</RlButton>
      </div>
    </div>

    <header class="head rl-cardish">
      <div class="left">
        <div class="eyebrow">CONNECT</div>
        <h1 class="title">대화</h1>
        <p class="sub">메시지에서 끝나지 않고 실제 행동으로 이어질 대화를 고르세요.</p>
      </div>

      <div class="actions">
        <RlButton size="sm" variant="primary" @click="goNewDm">새 DM</RlButton>
        <RlButton size="sm" variant="soft" @click="conv.refresh()" :disabled="loading">새로고침</RlButton>
      </div>
    </header>

    <section class="hero rl-cardish">
      <div class="heroMain">
        <div class="heroLabel">대화 선택 가이드</div>
        <div class="heroTitle">{{ suggestedTitle }}</div>
        <div class="heroSub">{{ suggestedSub }}</div>
      </div>
      <div class="heroStats">
        <div class="heroStat">
          <strong>{{ activeConversationCount }}</strong>
          <span>전체 대화</span>
        </div>
        <div class="heroStat">
          <strong>{{ unreadTotal }}</strong>
          <span>읽지 않은 메시지</span>
        </div>
        <div class="heroStat">
          <strong>{{ responsiveConversationCount }}</strong>
          <span>즉시 이어가기 가능</span>
        </div>
      </div>
    </section>

    <section class="scanStrip">
      <article class="scanCard rl-cardish scanCard--accent">
        <div class="scanLabel">지금 먼저 볼 것</div>
        <div class="scanValue">{{ firstPriorityTitle }}</div>
      </article>
      <article class="scanCard rl-cardish scanCard--warning">
        <div class="scanLabel">왜 지금 중요한가</div>
        <div class="scanValue">{{ firstPriorityReason }}</div>
      </article>
      <article class="scanCard rl-cardish scanCard--normal">
        <div class="scanLabel">어디로 이어질까</div>
        <div class="scanValue">{{ firstPriorityDestination }}</div>
      </article>
    </section>

    <section class="pickGuide rl-cardish">
      <div class="pickGuide__title">어떤 대화를 고르면 좋을까요?</div>
      <div class="pickGuide__grid">
        <div class="pickGuide__item">
          <strong>가장 자연스러운 상대</strong>
          <span>이 액션을 바로 이해할 사람과의 대화를 먼저 고르세요.</span>
        </div>
        <div class="pickGuide__item">
          <strong>최근 흐름이 살아 있는 방</strong>
          <span>마지막 메시지가 최근일수록 실제 행동으로 이어질 가능성이 높아요.</span>
        </div>
        <div class="pickGuide__item">
          <strong>읽지 않은 메시지 우선</strong>
          <span>답장이 필요한 흐름부터 보면 액션 전환이 더 자연스러워져요.</span>
        </div>
      </div>
    </section>

    <section class="summary rl-cardish">
      <div class="summaryMain">
        <div>
          <div class="sumTitle">대화 요약</div>
          <div class="sumValue">{{ unreadTotal }}개</div>
        </div>
        <div class="sumHint">
          {{
            pendingActionExists
              ? "선택한 대화방으로 들어가면 액션 Dock 흐름을 바로 이어갈 수 있어요."
              : "대화방에 들어가면 unread가 정리되고 최근 흐름을 더 빠르게 볼 수 있어요."
          }}
        </div>
      </div>
      <div class="summaryPills">
        <span class="sumPill">{{ unreadConversationCount }}개 답장 필요</span>
        <span class="sumPill">{{ recentActiveCount }}개 최근 흐름</span>
        <span class="sumPill">{{ staleConversationCount }}개 오랜만에 확인</span>
      </div>
    </section>

    <AsyncStatePanel
      v-if="loading"
      icon="⏳"
      title="대화 목록을 불러오는 중이에요"
      description="읽지 않은 메시지와 액션 브리지를 같이 준비하고 있어요."
      tone="loading"
      :show-actions="false"
    />
    <AsyncStatePanel
      v-else-if="error"
      icon="⚠️"
      title="대화 목록을 불러오지 못했어요"
      :description="error"
      tone="danger"
      primary-label="다시 시도"
      secondary-label="새 DM"
      @primary="() => (conv._refreshNow?.() || conv.refresh?.())"
      @secondary="goNewDm"
    />
    <AsyncStatePanel
      v-else-if="items.length === 0"
      icon="💬"
      title="아직 시작된 대화가 없어요"
      description="새 DM으로 시작하면 댓글에서 만든 액션도 이 흐름으로 가져올 수 있어요."
      primary-label="새 DM 시작"
      secondary-label="인박스로 이동"
      @primary="goNewDm"
      @secondary="() => router.push('/inbox')"
    />

    <div v-else class="listWrap">
      <div class="listHead">
        <div class="listTitle">대화방 선택</div>
        <div class="listSub">
          {{
            pendingActionExists
              ? "액션을 가져갈 대화방을 고르면 해당 흐름이 더 자연스럽게 이어져요."
              : "최근 대화부터 보면서 실제 행동으로 이어질 수 있는 방을 골라보세요."
          }}
        </div>
      </div>

      <div class="list">
        <button
          v-for="c in items"
          :key="c.conversationId"
          class="item rl-cardish"
          :class="{
            itemPending: pendingActionExists,
            itemPendingTarget: isPendingTarget(c.conversationId),
            itemUnread: (c.unreadCount || 0) > 0
          }"
          type="button"
          @click="openConversation(c.conversationId)"
        >
          <div class="avatar" aria-hidden="true"></div>

          <div class="content">
            <div class="row1">
              <div class="nameWrap">
                <div class="name">{{ peerName(c) }}</div>
                <span class="activityPill" :class="conversationPriorityTone(c)">{{ activityMeta(c) }}</span>
              </div>
              <div class="time">{{ fmtListTime(c.lastMessageAt || c.updatedAt) }}</div>
            </div>

            <div class="row2">
              <div class="preview">{{ conversationPreview(c) }}</div>
              <div class="rightMeta">
                <span
                  v-if="pendingActionExists"
                  class="takeHint"
                  :class="{ takeHintTarget: isPendingTarget(c.conversationId) }"
                >
                  {{ isPendingTarget(c.conversationId) ? "여기로 가져오기" : "가져오기" }}
                </span>
                <span v-if="c.unreadCount > 0" class="badge">
                  {{ c.unreadCount > 99 ? "99+" : c.unreadCount }}
                </span>
              </div>
            </div>

            <div class="row3">
              <div class="contextLine">
                <span class="contextTag" :class="conversationPriorityTone(c)">{{ conversationPriorityLabel(c) }}</span>
                <span class="contextText">{{ conversationStatusLine(c) }}</span>
              </div>
              <div class="nextLine">{{ conversationNextAction(c) }}</div>
            </div>
          </div>

          <div class="chev">›</div>
        </button>

        <div class="more">
          <button v-if="conv.hasNext" class="moreBtn" type="button" @click="conv.loadMore()">더 보기</button>
          <div v-else class="end">끝 ✨</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page{padding:18px 14px 90px;max-width:980px;margin:0 auto;display:grid;gap:12px}
.rl-cardish{border:1px solid color-mix(in oklab,var(--border) 88%,transparent);background:color-mix(in oklab,var(--surface) 86%,transparent);box-shadow:0 18px 60px rgba(0,0,0,.28),0 1px 0 rgba(255,255,255,.06) inset;backdrop-filter:blur(14px)}

.pendingBanner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px;border-radius:18px}
.pendingBannerActions{display:flex;gap:8px;flex-wrap:wrap}
.pbEyebrow{font-size:11px;font-weight:900;color:color-mix(in oklab,var(--accent) 76%,white)}
.pbTitle{margin-top:4px;font-size:18px;font-weight:950}
.pbSub{margin-top:6px;font-size:12.5px;color:var(--text);display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pbKind{font-weight:900}
.pbQuote{opacity:.92}
.pbSourcePreview{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.45}

.head{border-radius:22px;padding:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--muted)}
.title{font-size:24px;font-weight:950;margin:6px 0 0}
.sub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.45}
.actions{display:flex;gap:8px;flex-wrap:wrap}

.hero{border-radius:24px;padding:16px;display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
.heroLabel{font-size:12px;font-weight:900;letter-spacing:.05em;color:color-mix(in oklab,var(--accent) 78%,white)}
.heroTitle{margin-top:8px;font-size:22px;font-weight:950;line-height:1.22}
.heroSub{margin-top:8px;color:var(--muted);line-height:1.55}
.heroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.heroStat{padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:5px}
.heroStat strong{font-size:22px;font-weight:950}
.heroStat span{font-size:12px;color:var(--muted)}

.scanStrip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:stretch}
.scanCard{border-radius:20px;padding:15px;display:grid;gap:8px;min-height:126px;align-content:start;border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
.scanCard--accent{background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 9%,transparent),color-mix(in oklab,var(--surface) 90%,white 10%))}
.scanCard--warning{background:linear-gradient(180deg,color-mix(in oklab,var(--warning) 8%,transparent),color-mix(in oklab,var(--surface) 90%,white 10%))}
.scanCard--normal{background:linear-gradient(180deg,rgba(255,255,255,.034),color-mix(in oklab,var(--surface) 90%,white 10%))}
.scanLabel{font-size:11px;font-weight:900;letter-spacing:.08em;color:var(--muted)}
.scanValue{font-size:15px;line-height:1.58;font-weight:850;color:color-mix(in oklab,var(--text) 94%,white)}

.pickGuide{border-radius:20px;padding:14px 15px}
.pickGuide__title{font-size:15px;font-weight:950}
.pickGuide__grid{margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pickGuide__item{padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);display:grid;gap:5px}
.pickGuide__item strong{font-size:13px}
.pickGuide__item span{font-size:12px;color:var(--muted);line-height:1.5}

.summary{border-radius:18px;padding:14px 15px;display:grid;gap:12px}
.summaryMain{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sumTitle{font-size:12px;color:var(--muted);font-weight:900}
.sumValue{margin-top:4px;font-size:24px;font-weight:950;letter-spacing:-.03em}
.sumHint{font-size:12px;color:var(--muted);line-height:1.5}
.summaryPills{display:flex;flex-wrap:wrap;gap:8px}
.sumPill{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:12px;font-weight:800;color:color-mix(in oklab,var(--text) 90%,white)}

.listWrap{display:grid;gap:10px}
.listHead{padding:2px 2px 0}
.listTitle{font-size:18px;font-weight:950}
.listSub{margin-top:4px;color:var(--muted);font-size:13px}
.list{display:grid;gap:10px}
.item{width:100%;min-height:108px;text-align:left;border-radius:20px;padding:12px;display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:start;cursor:pointer;transition:transform .14s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}
.itemPending{border-color:color-mix(in oklab,var(--accent) 18%,var(--border))}
.itemUnread{border-color:color-mix(in oklab,var(--accent) 28%,var(--border))}
.itemPendingTarget{transform:translateY(-2px) scale(1.012);border-color:color-mix(in oklab,var(--accent) 42%,var(--border));background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 10%,var(--surface)),color-mix(in oklab,var(--surface) 88%,transparent));box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab,var(--accent) 22%,transparent) inset,0 0 28px color-mix(in oklab,var(--accent) 18%,transparent);animation:pendingTargetPulse 2.4s ease-in-out infinite}
.item:hover{transform:translateY(-1px);border-color:color-mix(in oklab,var(--accent) 32%,var(--border));background:color-mix(in oklab,var(--surface) 82%,transparent)}
.itemPendingTarget:hover{transform:translateY(-3px) scale(1.014)}

.avatar{width:38px;height:38px;border-radius:50%;background:radial-gradient(14px 14px at 30% 30%,rgba(255,255,255,.22),transparent 60%),linear-gradient(135deg,color-mix(in oklab,var(--accent) 76%,white),color-mix(in oklab,var(--success) 68%,white))}
.content{min-width:0}
.row1,.row2{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.row2{margin-top:6px}
.row3{margin-top:10px;display:grid;gap:7px}
.nameWrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.name{font-weight:950;color:var(--text)}
.time{font-size:12px;color:var(--muted);white-space:nowrap}
.preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:color-mix(in oklab,var(--text) 88%,white)}
.rightMeta{display:flex;align-items:center;gap:8px;flex-shrink:0}
.takeHint{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);font-size:12px;font-weight:800;white-space:nowrap;color:color-mix(in oklab,var(--text) 90%,white);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}
.takeHintTarget{border-color:color-mix(in oklab,var(--accent) 44%,rgba(255,255,255,.14));background:color-mix(in oklab,var(--accent) 18%,rgba(255,255,255,.06));box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 8px 20px color-mix(in oklab,var(--accent) 18%,transparent);transform:translateY(-1px)}
.badge{min-width:24px;height:24px;padding:0 7px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in oklab,var(--accent) 72%,white);color:#0b1020;font-size:12px;font-weight:950;box-shadow:0 8px 18px rgba(0,0,0,.18)}
.chev{font-size:22px;opacity:.45;align-self:center}

.activityPill,.contextTag{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:color-mix(in oklab,var(--text) 90%,white)}
.priority-strong{background:color-mix(in oklab,var(--accent) 18%,rgba(255,255,255,.06));border-color:color-mix(in oklab,var(--accent) 36%,rgba(255,255,255,.1))}
.priority-warning{background:color-mix(in oklab,var(--warning) 18%,rgba(255,255,255,.06));border-color:color-mix(in oklab,var(--warning) 34%,rgba(255,255,255,.1))}
.priority-fresh{background:color-mix(in oklab,var(--success) 16%,rgba(255,255,255,.06));border-color:color-mix(in oklab,var(--success) 30%,rgba(255,255,255,.1))}
.priority-normal{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}

.contextLine{display:flex;gap:8px;align-items:flex-start}
.contextText{font-size:12px;line-height:1.5;color:var(--muted)}
.nextLine{font-size:12px;line-height:1.5;color:color-mix(in oklab,var(--text) 90%,white);font-weight:700}

.more{display:grid;place-items:center;padding:8px 0 4px}
.moreBtn{height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:var(--text);font-weight:900}
.end{font-size:12px;opacity:.7}

@keyframes pendingTargetPulse{
  0%,100%{box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab,var(--accent) 22%,transparent) inset,0 0 22px color-mix(in oklab,var(--accent) 12%,transparent)}
  50%{box-shadow:0 24px 58px rgba(0,0,0,.34),0 0 0 1px color-mix(in oklab,var(--accent) 28%,transparent) inset,0 0 32px color-mix(in oklab,var(--accent) 20%,transparent)}
}

@media (max-width:820px){
  .hero,.pickGuide__grid,.scanStrip{grid-template-columns:1fr}
  .heroStats{grid-template-columns:1fr 1fr 1fr}
  .summaryMain{flex-direction:column;align-items:flex-start}
}
@media (max-width:720px){
  .item{grid-template-columns:38px 1fr auto}
  .row2{align-items:flex-start;flex-direction:column}
  .rightMeta{width:100%;justify-content:space-between}
  .contextLine{flex-direction:column}
}
@media (max-width:640px){
  .page{padding:14px 12px 90px}
  .title{font-size:22px}
  .heroTitle{font-size:20px}
  .heroStats{grid-template-columns:1fr}
}
</style>
