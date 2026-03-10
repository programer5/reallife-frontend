<template>
  <div class="page">
    <section class="hero cardSurface">
      <div class="heroLeft">
        <div class="eyebrow">REALIFE OPS</div>
        <h1 class="title">Admin Dashboard</h1>
        <p class="sub">
          서비스 상태, 실시간 연결, reminder 흐름, 최근 알림과 이상징후를 한 화면에서 확인합니다.
        </p>
      </div>

      <div class="heroRight">
        <div class="statusBadge" :data-status="normalizedDashboard.status">
          {{ normalizedDashboard.status }}
        </div>

        <div class="refreshMeta">
          <span>자동 새로고침 30초</span>
          <span>마지막 {{ lastLoadedText }}</span>
        </div>

        <RlButton size="sm" variant="soft" @click="reloadAll" :loading="loading">
          새로고침
        </RlButton>
      </div>
    </section>

    <AsyncStatePanel
        v-if="loading && !dashboard"
        icon="⏳"
        title="운영 상태를 불러오는 중이에요"
        description="DB, Redis, SSE, Reminder 상태를 모으고 있어요."
        tone="loading"
        :show-actions="false"
    />

    <AsyncStatePanel
        v-else-if="error"
        icon="⚠️"
        title="대시보드를 불러오지 못했어요"
        :description="error"
        tone="danger"
        primary-label="다시 시도"
        @primary="reloadAll"
    />

    <template v-else>
      <section class="opsActionGrid">
        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">운영 알림 연결 테스트</div>
              <div class="panelSub">Slack webhook 연결 여부를 운영자 화면에서 바로 확인해요.</div>
            </div>

            <RlButton
                size="sm"
                variant="primary"
                @click="runAlertTest"
                :loading="alertTestLoading"
            >
              Slack 테스트 보내기
            </RlButton>
          </div>

          <div class="opsActionMeta">
            <div class="signalItem">
              <span class="signalLabel">Channel</span>
              <strong>{{ alertTestResult?.channel || "SLACK" }}</strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Enabled</span>
              <strong :data-status="boolStatus(alertTestResult?.enabled)">
                {{ boolText(alertTestResult?.enabled) }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Webhook Configured</span>
              <strong :data-status="boolStatus(alertTestResult?.webhookConfigured)">
                {{ boolText(alertTestResult?.webhookConfigured) }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Last Test Result</span>
              <strong :data-status="boolStatus(alertTestResult?.sent)">
                {{ alertTestResult ? (alertTestResult.sent ? "SENT" : "NOT_SENT") : "-" }}
              </strong>
            </div>
          </div>

          <div v-if="alertTestResult" class="alertTestBox" :data-sent="alertTestResult.sent">
            <div class="alertTestTop">
              <strong>{{ alertTestResult.message }}</strong>
              <span>{{ fmtDateTime(alertTestResult.checkedAt) }}</span>
            </div>
            <div class="alertTestMeta">
              <span>요청자 {{ alertTestResult.requestedBy }}</span>
              <span>{{ alertTestResult.application }}</span>
            </div>
          </div>
          <div v-else class="empty">아직 Slack 테스트를 실행하지 않았어요.</div>
        </div>
      </section>

      <section v-if="anomalyList.length" class="panel anomalyPanel cardSurface">
        <div class="panelTitle">⚠ 이상 징후 감지</div>

        <div class="anomalyList">
          <div
              v-for="item in anomalyList"
              :key="item.type"
              class="anomalyCard"
              :data-level="item.level"
          >
            <div class="anomalyTitle">{{ item.title }}</div>
            <div class="anomalyDesc">{{ item.desc }}</div>
          </div>
        </div>
      </section>

      <section class="grid4">
        <div class="statCard cardSurface">
          <div class="label">SSE 연결</div>
          <div class="value">{{ normalizedDashboard.overview.activeSseConnections }}</div>
          <div class="hint">실시간 연결 상태</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">미읽음 알림</div>
          <div class="value">{{ normalizedDashboard.overview.unreadNotifications }}</div>
          <div class="hint">전체 unread 기준</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">활성 핀</div>
          <div class="value">{{ normalizedDashboard.overview.activePins }}</div>
          <div class="hint">현재 진행 중 액션</div>
        </div>

        <div class="statCard cardSurface">
          <div class="label">오늘 알림</div>
          <div class="value">{{ normalizedDashboard.overview.todayCreatedNotifications }}</div>
          <div class="hint">최근 24시간 기준</div>
        </div>
      </section>

      <section class="focusGrid">
        <div class="panel cardSurface">
          <div class="panelTitle">운영 포커스</div>
          <div class="focusList">
            <div class="focusRow">
              <span>지금 가장 먼저 볼 것</span>
              <strong>{{ normalizedDashboard.insights.opsFocusTitle }}</strong>
            </div>
            <div class="focusRow">
              <span>우선 이유</span>
              <strong>{{ normalizedDashboard.insights.opsFocusReason }}</strong>
            </div>
            <div class="focusRow">
              <span>서비스 상태</span>
              <strong :data-status="normalizedDashboard.status">{{ normalizedDashboard.status }}</strong>
            </div>
          </div>
        </div>

        <div class="panel cardSurface">
          <div class="panelTitle">실시간 흐름 요약</div>
          <div class="focusList">
            <div class="focusRow">
              <span>최근 SSE 이벤트</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastSseEventSentAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>최근 Reminder 실행</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderRunAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>최근 Reminder 성공</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderSuccessAt) }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="healthGrid">
        <div class="panel cardSurface">
          <div class="panelTitle">Health Status</div>

          <div class="healthList">
            <div
                v-for="(value, key) in normalizedDashboard.health.checks"
                :key="key"
                class="healthRow"
            >
              <span class="healthKey">{{ key }}</span>

              <span class="healthValue" :data-status="value">
                {{ value }}
              </span>
            </div>
          </div>
        </div>

        <div class="panel cardSurface">
          <div class="panelTitle">Scheduler</div>

          <div class="timingList">
            <div class="timingRow">
              <span>Last SSE Event</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastSseEventSentAt) }}</strong>
            </div>

            <div class="timingRow">
              <span>Last Reminder Run</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderRunAt) }}</strong>
            </div>

            <div class="timingRow">
              <span>Last Reminder Success</span>
              <strong>{{ fmtDateTime(normalizedDashboard.health.lastReminderSuccessAt) }}</strong>
            </div>

            <div class="timingRow">
              <span>Reminder Delay</span>
              <strong :data-delay="delayLevel">
                {{ normalizedDashboard.health.minutesSinceLastReminderRun }} min
              </strong>
            </div>

            <div class="timingRow">
              <span>Recent Reminder Created</span>
              <strong>{{ normalizedDashboard.health.recentReminderCreatedCount }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="summaryNotesGrid">
        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">Health Summary</div>
              <div class="panelSub">백엔드가 정리한 운영 health 요약 메모예요.</div>
            </div>
          </div>

          <ul v-if="normalizedDashboard.health.summaryNotes.length" class="summaryNotes">
            <li v-for="note in normalizedDashboard.health.summaryNotes" :key="note">
              {{ note }}
            </li>
          </ul>
          <div v-else class="empty">health summary note가 아직 없어요.</div>
        </div>

        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">운영 신호 요약</div>
              <div class="panelSub">백엔드 insights 기준으로 현재 운영 신호를 정리해요.</div>
            </div>
          </div>

          <div class="signalList">
            <div class="signalItem">
              <span class="signalLabel">Unread Pressure</span>
              <strong :data-status="signalStatus(normalizedDashboard.insights.unreadPressure)">
                {{ normalizedDashboard.insights.unreadPressure }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Realtime Health</span>
              <strong :data-status="signalStatus(normalizedDashboard.insights.realtimeHealth)">
                {{ normalizedDashboard.insights.realtimeHealth }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Reminder Health</span>
              <strong :data-status="signalStatus(normalizedDashboard.insights.reminderHealth)">
                {{ normalizedDashboard.insights.reminderHealth }}
              </strong>
            </div>
            <div class="signalItem">
              <span class="signalLabel">Top Notification Type</span>
              <strong>{{ normalizedDashboard.insights.topNotificationType }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="grid3">
        <div class="miniCard cardSurface">
          <div class="label">Users</div>
          <div class="value">{{ normalizedDashboard.totals.users }}</div>
        </div>

        <div class="miniCard cardSurface">
          <div class="label">Posts</div>
          <div class="value">{{ normalizedDashboard.totals.posts }}</div>
        </div>

        <div class="miniCard cardSurface">
          <div class="label">Comments</div>
          <div class="value">{{ normalizedDashboard.totals.comments }}</div>
        </div>

        <div class="miniCard cardSurface">
          <div class="label">Conversations</div>
          <div class="value">{{ normalizedDashboard.totals.conversations }}</div>
        </div>

        <div class="miniCard cardSurface">
          <div class="label">Messages</div>
          <div class="value">{{ normalizedDashboard.totals.messages }}</div>
        </div>

        <div class="miniCard cardSurface">
          <div class="label">Notifications</div>
          <div class="value">{{ normalizedDashboard.totals.notifications }}</div>
        </div>
      </section>

      <section class="insightGrid">
        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">최근 알림 타입 통계</div>
              <div class="panelSub">백엔드 insights 기준으로 집계한 최근 알림 타입 통계예요.</div>
            </div>
          </div>

          <div v-if="normalizedDashboard.insights.notificationTypeCounts.length" class="typeStatsList">
            <div
                v-for="item in normalizedDashboard.insights.notificationTypeCounts"
                :key="item.type"
                class="typeStatsItem"
            >
              <div class="typeStatsTop">
                <span class="typeName">{{ item.type }}</span>
                <strong class="typeCount">{{ item.count }}</strong>
              </div>
              <div class="typeBar">
                <span :style="{ width: item.ratio + '%' }"></span>
              </div>
              <div class="typeRatio">{{ item.ratio }}%</div>
            </div>
          </div>

          <div v-else class="empty">최근 알림 타입 통계가 아직 없어요.</div>
        </div>

        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">운영 메모</div>
              <div class="panelSub">백엔드가 만든 운영 메모를 그대로 보여줘요.</div>
            </div>
          </div>

          <ul v-if="normalizedDashboard.notes.length" class="notes">
            <li v-for="note in normalizedDashboard.notes" :key="note">{{ note }}</li>
          </ul>
          <div v-else class="empty">운영 메모가 아직 없어요.</div>
        </div>
      </section>

      <section class="panel cardSurface">
        <div class="panelHead">
          <div>
            <div class="panelTitle">최근 서버 에러</div>
            <div class="panelSub">최근 발생한 서버 에러 로그예요.</div>
          </div>
        </div>

        <div v-if="errors.length" class="errorList">
          <div
              v-for="err in errors"
              :key="err.id"
              class="errorItem"
          >
            <div class="errorTop">
              <span class="errorType">{{ err.type }}</span>
              <span class="errorTime">{{ fmtDateTime(err.createdAt) }}</span>
            </div>

            <div class="errorMessage">{{ err.message }}</div>
            <div class="errorPath">{{ err.path }}</div>
          </div>
        </div>

        <div v-else class="empty">최근 서버 에러가 없습니다.</div>
      </section>

      <section class="panel cardSurface">
        <div class="panelHead">
          <div>
            <div class="panelTitle">최근 알림</div>
            <div class="panelSub">운영자가 최근 흐름을 빠르게 볼 수 있는 요약이에요.</div>
          </div>
          <div class="generatedAt">생성 시각 {{ fmtDateTime(normalizedDashboard.generatedAt) }}</div>
        </div>

        <div v-if="normalizedDashboard.recent.notifications.length" class="recentList">
          <div
              v-for="item in normalizedDashboard.recent.notifications"
              :key="item.id"
              class="recentItem"
          >
            <div class="recentTop">
              <span class="recentType">{{ item.type }}</span>
              <span class="recentTime">{{ fmtDateTime(item.createdAt) }}</span>
            </div>
            <div class="recentBody">{{ item.body }}</div>
            <div class="recentMeta">
              <span>User {{ shortId(item.userId) }}</span>
              <span :data-read="item.read">{{ item.read ? "읽음" : "미읽음" }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty">아직 최근 알림이 없어요.</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import { fetchAdminDashboard, fetchAdminErrors, sendAdminAlertTest } from "@/api/admin";
import { useToastStore } from "@/stores/toast";

const toast = useToastStore();

const dashboard = ref(null);
const errors = ref([]);
const loading = ref(false);
const error = ref("");
const lastLoadedAt = ref(null);

const alertTestLoading = ref(false);
const alertTestResult = ref(null);

let refreshTimer = null;

const normalizedDashboard = computed(() => {
  const raw = dashboard.value || {};

  return {
    status: raw.status || "UNKNOWN",
    generatedAt: raw.generatedAt || null,

    overview: {
      activeSseConnections: Number(raw?.overview?.activeSseConnections || 0),
      unreadNotifications: Number(raw?.overview?.unreadNotifications || 0),
      activePins: Number(raw?.overview?.activePins || 0),
      todayCreatedNotifications: Number(raw?.overview?.todayCreatedNotifications || 0),
      todayCreatedMessages: Number(raw?.overview?.todayCreatedMessages || 0),
      todayCreatedPosts: Number(raw?.overview?.todayCreatedPosts || 0),
    },

    health: {
      checks: raw?.health?.checks || {},
      lastSseEventSentAt: raw?.health?.lastSseEventSentAt || null,
      lastReminderRunAt: raw?.health?.lastReminderRunAt || null,
      lastReminderSuccessAt: raw?.health?.lastReminderSuccessAt || null,
      recentReminderCreatedCount: Number(raw?.health?.recentReminderCreatedCount || 0),
      minutesSinceLastReminderRun: Number(raw?.health?.minutesSinceLastReminderRun || 0),
      summaryNotes: Array.isArray(raw?.health?.summaryNotes) ? raw.health.summaryNotes : [],
    },

    totals: {
      users: Number(raw?.totals?.users || 0),
      posts: Number(raw?.totals?.posts || 0),
      comments: Number(raw?.totals?.comments || 0),
      conversations: Number(raw?.totals?.conversations || 0),
      messages: Number(raw?.totals?.messages || 0),
      activePins: Number(raw?.totals?.activePins || 0),
      notifications: Number(raw?.totals?.notifications || 0),
    },

    recent: {
      notifications: Array.isArray(raw?.recent?.notifications) ? raw.recent.notifications : [],
    },

    insights: {
      notificationTypeCounts: Array.isArray(raw?.insights?.notificationTypeCounts)
          ? raw.insights.notificationTypeCounts
          : [],
      topNotificationType: raw?.insights?.topNotificationType || "NO_DATA",
      unreadPressure: raw?.insights?.unreadPressure || "LOW",
      realtimeHealth: raw?.insights?.realtimeHealth || "GOOD",
      reminderHealth: raw?.insights?.reminderHealth || "GOOD",
      opsFocusTitle: raw?.insights?.opsFocusTitle || "정상 운영 중",
      opsFocusReason: raw?.insights?.opsFocusReason || "이상 징후 없이 안정적으로 동작하고 있습니다.",
    },

    notes: Array.isArray(raw?.notes) ? raw.notes : [],
  };
});

const anomalyList = computed(() => {
  const list = [];

  if (normalizedDashboard.value.overview.activeSseConnections === 0) {
    list.push({
      type: "sse",
      level: "warning",
      title: "SSE 연결 없음",
      desc: "현재 활성 SSE 연결이 없습니다.",
    });
  }

  if (normalizedDashboard.value.health.minutesSinceLastReminderRun > 15) {
    list.push({
      type: "reminder",
      level: "danger",
      title: "Reminder Scheduler 지연",
      desc: `${normalizedDashboard.value.health.minutesSinceLastReminderRun}분 동안 실행되지 않았습니다.`,
    });
  }

  if (normalizedDashboard.value.status !== "UP") {
    list.push({
      type: "health",
      level: "danger",
      title: "서비스 상태 비정상",
      desc: `현재 상태 ${normalizedDashboard.value.status}`,
    });
  }

  return list;
});

const delayLevel = computed(() => {
  const mins = normalizedDashboard.value.health.minutesSinceLastReminderRun;
  if (mins > 15) return "danger";
  if (mins > 5) return "warning";
  return "normal";
});

const lastLoadedText = computed(() => {
  if (!lastLoadedAt.value) return "-";
  return new Date(lastLoadedAt.value).toLocaleTimeString("ko-KR");
});

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true;

  try {
    dashboard.value = await fetchAdminDashboard();
    lastLoadedAt.value = Date.now();
    error.value = "";
  } catch (e) {
    error.value = e?.response?.data?.message || "운영 대시보드를 불러오지 못했어요.";
    if (!silent) {
      toast.error?.("대시보드 로드 실패", error.value);
    }
  } finally {
    loading.value = false;
  }
}

async function loadErrors() {
  try {
    errors.value = await fetchAdminErrors();
  } catch (e) {
    console.error(e);
  }
}

async function reloadAll(opts = {}) {
  await load(opts);
  await loadErrors();
}

async function runAlertTest() {
  alertTestLoading.value = true;

  try {
    alertTestResult.value = await sendAdminAlertTest();

    if (alertTestResult.value?.sent) {
      toast.success?.("Slack 테스트 성공", alertTestResult.value.message);
    } else {
      toast.info?.("Slack 테스트 확인 필요", alertTestResult.value?.message || "설정을 확인해 주세요.");
    }
  } catch (e) {
    const msg = e?.response?.data?.message || "Slack 테스트 알림 전송에 실패했어요.";
    toast.error?.("Slack 테스트 실패", msg);
  } finally {
    alertTestLoading.value = false;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      reloadAll({ silent: true });
    }
  }, 30000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function fmtDateTime(v) {
  if (!v) return "-";
  return new Date(v).toLocaleString("ko-KR");
}

function shortId(v) {
  const s = String(v || "");
  return s ? s.slice(0, 8) : "-";
}

function signalStatus(v) {
  if (v === "HIGH" || v === "DELAYED") return "danger";
  if (v === "MEDIUM" || v === "WATCH") return "warning";
  return "good";
}

function boolText(v) {
  if (v === true) return "YES";
  if (v === false) return "NO";
  return "-";
}

function boolStatus(v) {
  if (v === true) return "good";
  if (v === false) return "danger";
  return "normal";
}

onMounted(async () => {
  await reloadAll();
  startAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.page{
  max-width:1200px;
  margin:0 auto;
  padding:18px 14px 110px;
  display:grid;
  gap:14px;
}

.cardSurface{
  border:1px solid color-mix(in oklab,var(--border) 88%,transparent);
  border-radius:24px;
  background:color-mix(in oklab,var(--surface) 88%,transparent);
  box-shadow:0 18px 60px rgba(0,0,0,.24),0 1px 0 rgba(255,255,255,.05) inset;
  backdrop-filter:blur(14px);
}

.hero{
  padding:18px;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
}

.eyebrow{
  font-size:11px;
  font-weight:900;
  letter-spacing:.15em;
  color:var(--muted);
}

.title{
  margin:6px 0 0;
  font-size:28px;
  font-weight:950;
}

.sub{
  margin:8px 0 0;
  color:var(--muted);
  line-height:1.55;
}

.heroRight{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
}

.refreshMeta{
  display:grid;
  gap:2px;
  font-size:12px;
  color:var(--muted);
}

.statusBadge{
  min-width:88px;
  height:38px;
  padding:0 14px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid var(--border);
  font-weight:950;
  background:rgba(255,255,255,.04);
}

.statusBadge[data-status="UP"]{
  border-color:color-mix(in oklab,var(--success) 44%,var(--border));
  background:color-mix(in oklab,var(--success) 12%,transparent);
}

.statusBadge[data-status="DEGRADED"]{
  border-color:color-mix(in oklab,var(--warning) 44%,var(--border));
  background:color-mix(in oklab,var(--warning) 12%,transparent);
}

.statusBadge[data-status="DOWN"]{
  border-color:color-mix(in oklab,var(--danger) 44%,var(--border));
  background:color-mix(in oklab,var(--danger) 12%,transparent);
}

.opsActionGrid{
  display:grid;
  grid-template-columns:1fr;
  gap:12px;
}

.opsActionMeta{
  margin-top:12px;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:10px;
}

.alertTestBox{
  margin-top:12px;
  padding:14px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.04);
}

.alertTestBox[data-sent="true"]{
  border-color:color-mix(in oklab,var(--success) 42%,var(--border));
  background:color-mix(in oklab,var(--success) 10%,transparent);
}

.alertTestBox[data-sent="false"]{
  border-color:color-mix(in oklab,var(--warning) 42%,var(--border));
  background:color-mix(in oklab,var(--warning) 10%,transparent);
}

.alertTestTop{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
  flex-wrap:wrap;
}

.alertTestMeta{
  margin-top:8px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  color:var(--muted);
  font-size:12px;
}

.anomalyPanel{
  border-color:rgba(255,120,0,.36);
  background:linear-gradient(180deg, rgba(255,120,0,.10), rgba(255,120,0,.04));
  padding:16px;
}

.anomalyList{
  display:grid;
  gap:10px;
  margin-top:12px;
}

.anomalyCard{
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.10);
}

.anomalyCard[data-level="warning"]{
  border-color:#f6c344;
  background:rgba(246,195,68,.12);
}

.anomalyCard[data-level="danger"]{
  border-color:#ff5d5d;
  background:rgba(255,93,93,.12);
}

.anomalyTitle{
  font-weight:900;
}

.anomalyDesc{
  margin-top:4px;
  font-size:13px;
  opacity:.84;
}

.grid4{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px;
}

.grid3{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}

.focusGrid,
.healthGrid,
.insightGrid,
.summaryNotesGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
}

.statCard,
.miniCard,
.panel{
  padding:16px;
}

.label{
  font-size:12px;
  color:var(--muted);
  font-weight:900;
}

.value{
  margin-top:8px;
  font-size:28px;
  font-weight:950;
  letter-spacing:-.03em;
}

.hint{
  margin-top:6px;
  font-size:12px;
  color:var(--muted);
}

.panelTitle{
  font-size:18px;
  font-weight:950;
}

.panelSub{
  margin-top:4px;
  font-size:13px;
  color:var(--muted);
}

.focusList,
.healthList,
.timingList,
.signalList{
  margin-top:12px;
  display:grid;
  gap:10px;
}

.focusRow,
.healthRow,
.timingRow,
.signalItem{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
}

.healthKey{
  text-transform:capitalize;
  color:var(--muted);
}

.healthValue[data-status="UP"],
strong[data-status="good"]{
  color:#64d89b;
}

.healthValue[data-status="DEGRADED"],
strong[data-status="warning"]{
  color:#f6c344;
}

.healthValue[data-status="DOWN"],
strong[data-status="danger"]{
  color:#ff7d7d;
}

strong[data-status="normal"]{
  color:var(--text);
}

.panelHead{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.summaryNotes,
.notes{
  margin:12px 0 0;
  padding-left:18px;
  display:grid;
  gap:8px;
  color:var(--text);
}

.summaryNotes li,
.notes li{
  line-height:1.55;
}

.typeStatsList{
  margin-top:12px;
  display:grid;
  gap:10px;
}

.typeStatsItem{
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
}

.typeStatsTop{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:center;
}

.typeName{
  font-weight:900;
}

.typeCount{
  font-size:16px;
}

.typeBar{
  margin-top:10px;
  height:10px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
  overflow:hidden;
}

.typeBar span{
  display:block;
  height:100%;
  border-radius:inherit;
  background:linear-gradient(90deg,
  color-mix(in oklab,var(--accent) 80%,white),
  color-mix(in oklab,var(--accent) 24%,transparent));
}

.typeRatio{
  margin-top:6px;
  font-size:12px;
  color:var(--muted);
}

.errorList,
.recentList{
  margin-top:12px;
  display:grid;
  gap:10px;
}

.errorItem,
.recentItem{
  padding:14px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
}

.errorTop,
.recentTop,
.recentMeta{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
}

.errorType,
.recentType{
  font-weight:900;
}

.errorTime,
.recentTime,
.generatedAt,
.recentMeta{
  font-size:12px;
  color:var(--muted);
}

.errorMessage,
.recentBody{
  margin-top:8px;
  line-height:1.55;
}

.errorPath{
  margin-top:6px;
  font-size:12px;
  color:var(--muted);
  word-break:break-all;
}

.empty{
  margin-top:12px;
  color:var(--muted);
  font-size:13px;
}

strong[data-delay="normal"]{
  color:#64d89b;
}

strong[data-delay="warning"]{
  color:#f6c344;
}

strong[data-delay="danger"]{
  color:#ff7d7d;
}

@media (max-width: 1024px){
  .grid4,
  .grid3,
  .focusGrid,
  .healthGrid,
  .insightGrid,
  .summaryNotesGrid,
  .opsActionMeta{
    grid-template-columns:1fr 1fr;
  }
}

@media (max-width: 720px){
  .hero{
    flex-direction:column;
  }

  .grid4,
  .grid3,
  .focusGrid,
  .healthGrid,
  .insightGrid,
  .summaryNotesGrid,
  .opsActionMeta{
    grid-template-columns:1fr;
  }

  .title{
    font-size:24px;
  }
}
</style>