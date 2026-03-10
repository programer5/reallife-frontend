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

      <section class="summaryNotesGrid">
        <div class="panel cardSurface">
          <div class="panelHead">
            <div>
              <div class="panelTitle">최근 운영 알림 이력</div>
              <div class="panelSub">Slack으로 전송된 운영 알림과 실패 이력을 최근순으로 보여줘요.</div>
            </div>
          </div>

          <div class="opsSummaryGrid">
            <div class="miniStat">
              <span class="miniLabel">전체</span>
              <strong class="miniValue">{{ alertHistory.length }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">SENT</span>
              <strong class="miniValue">{{ sentCount }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">FAILED</span>
              <strong class="miniValue">{{ failedCount }}</strong>
            </div>
            <div class="miniStat">
              <span class="miniLabel">HIGH LEVEL</span>
              <strong class="miniValue">{{ highLevelCount }}</strong>
            </div>
          </div>

          <div v-if="alertHistory.length" class="opsAlertList">
            <div
                v-for="item in alertHistory"
                :key="item.id"
                class="opsAlertItem"
                :data-status="item.status"
                :data-level="item.level"
            >
              <div class="opsAlertTop">
                <strong class="opsAlertTitle">{{ item.title }}</strong>
                <span class="opsAlertTime">{{ fmtDateTime(item.createdAt) }}</span>
              </div>

              <div class="opsAlertMetaRow">
                <span class="opsAlertChip">{{ item.channel }}</span>
                <span class="opsAlertChip" :data-status="item.status">{{ item.status }}</span>
                <span class="opsAlertChip" :data-level="item.level">{{ item.level }}</span>
                <span v-if="item.requestedBy" class="opsAlertChip">by {{ item.requestedBy }}</span>
              </div>

              <div v-if="item.alertKey" class="opsAlertKey">{{ item.alertKey }}</div>
              <div class="opsAlertBody">{{ item.body }}</div>
            </div>
          </div>
          <div v-else class="empty">최근 운영 알림 이력이 없습니다.</div>
        </div>

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
              <span>실시간 상태</span>
              <strong :data-status="normalizedDashboard.realtime.status">
                {{ normalizedDashboard.realtime.status }}
              </strong>
            </div>
            <div class="focusRow">
              <span>활성 SSE 연결</span>
              <strong>{{ normalizedDashboard.realtime.activeSseConnections }}</strong>
            </div>
            <div class="focusRow">
              <span>마지막 SSE 이벤트</span>
              <strong>{{ fmtDateTime(normalizedDashboard.realtime.lastSseEventSentAt) }}</strong>
            </div>
          </div>
        </div>

        <div class="panel cardSurface">
          <div class="panelTitle">Reminder 흐름 요약</div>
          <div class="focusList">
            <div class="focusRow">
              <span>Reminder 상태</span>
              <strong :data-status="normalizedDashboard.reminder.status">
                {{ normalizedDashboard.reminder.status }}
              </strong>
            </div>
            <div class="focusRow">
              <span>마지막 실행</span>
              <strong>{{ fmtDateTime(normalizedDashboard.reminder.lastRunAt) }}</strong>
            </div>
            <div class="focusRow">
              <span>마지막 성공</span>
              <strong>{{ fmtDateTime(normalizedDashboard.reminder.lastSuccessAt) }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="panel cardSurface">
        <div class="panelHead">
          <div>
            <div class="panelTitle">최근 서버 에러</div>
            <div class="panelSub">최근 서버 에러를 운영 화면에서 빠르게 확인해요.</div>
          </div>
        </div>

        <div v-if="recentErrors.length" class="errorList">
          <div v-for="item in recentErrors" :key="item.id" class="errorItem">
            <div class="errorTop">
              <strong>{{ item.errorCode || "ERROR" }}</strong>
              <span>{{ fmtDateTime(item.occurredAt) }}</span>
            </div>
            <div class="errorPath">{{ item.method }} {{ item.path }}</div>
            <div class="errorMessage">{{ item.message }}</div>
            <div v-if="item.traceId" class="errorTrace">traceId: {{ item.traceId }}</div>
          </div>
        </div>
        <div v-else class="empty">최근 서버 에러가 없습니다.</div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import RlButton from "@/components/ui/RlButton.vue";
import AsyncStatePanel from "@/components/ui/AsyncStatePanel.vue";
import {
  fetchAdminDashboard,
  fetchAdminErrors,
  fetchAdminHealth,
  fetchAdminRealtimeHealth,
  fetchAdminReminderHealth,
  fetchOpsAlertHistory,
  sendOpsAlertTest,
} from "@/api/admin";
import { useToastStore } from "@/stores/toast";

const toast = useToastStore();

const loading = ref(false);
const error = ref("");
const dashboard = ref(null);
const health = ref(null);
const realtimeHealth = ref(null);
const reminderHealth = ref(null);
const recentErrors = ref([]);
const alertHistory = ref([]);
const alertTestLoading = ref(false);
const alertTestResult = ref(null);
const lastLoadedAt = ref(null);

let timerId = null;

const normalizedDashboard = computed(() => {
  const source = dashboard.value || {};
  return {
    status: source.status || "UNKNOWN",
    overview: {
      activeSseConnections: source.overview?.activeSseConnections ?? 0,
      unreadNotifications: source.overview?.unreadNotifications ?? 0,
      activePins: source.overview?.activePins ?? 0,
      todayCreatedNotifications: source.overview?.todayCreatedNotifications ?? 0,
    },
    insights: {
      opsFocusTitle: source.insights?.opsFocusTitle || "-",
      opsFocusReason: source.insights?.opsFocusReason || "-",
    },
    health: {
      summaryNotes: Array.isArray(source.health?.summaryNotes) ? source.health.summaryNotes : [],
    },
    realtime: {
      status: source.realtime?.status || realtimeHealth.value?.status || "UNKNOWN",
      activeSseConnections:
          source.realtime?.activeSseConnections ?? realtimeHealth.value?.activeSseConnections ?? 0,
      lastSseEventSentAt:
          source.realtime?.lastSseEventSentAt || realtimeHealth.value?.lastSseEventSentAt || null,
    },
    reminder: {
      status: source.reminder?.status || reminderHealth.value?.status || "UNKNOWN",
      lastRunAt: source.reminder?.lastRunAt || reminderHealth.value?.lastRunAt || null,
      lastSuccessAt: source.reminder?.lastSuccessAt || reminderHealth.value?.lastSuccessAt || null,
    },
  };
});

const lastLoadedText = computed(() => {
  if (!lastLoadedAt.value) return "불러오기 전";

  const diffMs = Date.now() - new Date(lastLoadedAt.value).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 10) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  return fmtDateTime(lastLoadedAt.value);
});

const sentCount = computed(() =>
    alertHistory.value.filter((item) => String(item.status || "").toUpperCase() === "SENT").length
);

const failedCount = computed(() =>
    alertHistory.value.filter((item) => String(item.status || "").toUpperCase() === "FAILED").length
);

const highLevelCount = computed(() =>
    alertHistory.value.filter((item) => {
      const level = String(item.level || "").toUpperCase();
      return level === "WARNING" || level === "DANGER";
    }).length
);

const anomalyList = computed(() => {
  const items = [];

  if (normalizedDashboard.value.status === "DOWN") {
    items.push({
      type: "overall-down",
      level: "danger",
      title: "전체 운영 상태가 DOWN 이에요",
      desc: "health / realtime / reminder 중 하나 이상이 심각한 상태예요.",
    });
  } else if (normalizedDashboard.value.status === "DEGRADED") {
    items.push({
      type: "overall-degraded",
      level: "warning",
      title: "전체 운영 상태가 DEGRADED 예요",
      desc: "서비스는 동작 중이지만 일부 운영 지표가 좋지 않아요.",
    });
  }

  if (normalizedDashboard.value.realtime.status !== "UP") {
    items.push({
      type: "realtime",
      level:
          normalizedDashboard.value.realtime.status === "DOWN" ? "danger" : "warning",
      title: "SSE 실시간 상태가 정상이 아니에요",
      desc: `현재 realtime 상태는 ${normalizedDashboard.value.realtime.status} 이에요.`,
    });
  }

  if (normalizedDashboard.value.reminder.status !== "UP") {
    items.push({
      type: "reminder",
      level:
          normalizedDashboard.value.reminder.status === "DOWN" ? "danger" : "warning",
      title: "Reminder scheduler 상태가 정상이 아니에요",
      desc: `현재 reminder 상태는 ${normalizedDashboard.value.reminder.status} 이에요.`,
    });
  }

  if (failedCount.value > 0) {
    items.push({
      type: "failed-alert",
      level: "warning",
      title: "최근 운영 알림 실패가 있어요",
      desc: `FAILED 이력이 ${failedCount.value}건 있어요.`,
    });
  }

  if (recentErrors.value.length > 0) {
    items.push({
      type: "recent-errors",
      level: "warning",
      title: "최근 서버 에러가 수집됐어요",
      desc: `최근 서버 에러가 ${recentErrors.value.length}건 있어요.`,
    });
  }

  return items;
});

function fmtDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function boolText(value) {
  return value ? "YES" : "NO";
}

function boolStatus(value) {
  return value ? "UP" : "DOWN";
}

async function reloadAll() {
  loading.value = true;
  error.value = "";

  try {
    const [
      dashboardRes,
      healthRes,
      realtimeRes,
      reminderRes,
      errorsRes,
      historyRes,
    ] = await Promise.all([
      fetchAdminDashboard(),
      fetchAdminHealth(),
      fetchAdminRealtimeHealth(),
      fetchAdminReminderHealth(),
      fetchAdminErrors(),
      fetchOpsAlertHistory(),
    ]);

    dashboard.value = dashboardRes;
    health.value = healthRes;
    realtimeHealth.value = realtimeRes;
    reminderHealth.value = reminderRes;
    recentErrors.value = Array.isArray(errorsRes) ? errorsRes : [];
    alertHistory.value = Array.isArray(historyRes) ? historyRes : [];
    lastLoadedAt.value = new Date().toISOString();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "운영 데이터를 불러오지 못했어요.";
  } finally {
    loading.value = false;
  }
}

async function runAlertTest() {
  alertTestLoading.value = true;

  try {
    const result = await sendOpsAlertTest();
    alertTestResult.value = result;
    toast.success("Slack 테스트 전송", result?.message || "운영 알림 테스트를 전송했어요.");
    await reloadAll();
  } catch (e) {
    const message = e?.response?.data?.message || e?.message || "Slack 테스트 전송에 실패했어요.";
    toast.error("Slack 테스트 실패", message);
  } finally {
    alertTestLoading.value = false;
  }
}

onMounted(async () => {
  await reloadAll();
  timerId = window.setInterval(reloadAll, 30000);
});

onBeforeUnmount(() => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
});
</script>

<style scoped>
.page{
  display:grid;
  gap:18px;
  padding:20px 16px 40px;
}
.cardSurface{
  border:1px solid var(--border);
  border-radius:24px;
  background:var(--surface);
  box-shadow:0 12px 28px rgba(0,0,0,.08);
}
.hero{
  padding:22px;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
}
.heroLeft{
  display:grid;
  gap:8px;
}
.eyebrow{
  font-size:12px;
  font-weight:900;
  letter-spacing:.12em;
  color:var(--muted);
}
.title{
  margin:0;
  font-size:32px;
  line-height:1.08;
}
.sub{
  margin:0;
  color:var(--muted);
  line-height:1.65;
}
.heroRight{
  display:grid;
  gap:10px;
  justify-items:end;
}
.statusBadge{
  border-radius:999px;
  padding:10px 14px;
  border:1px solid var(--border);
  font-weight:900;
  font-size:12px;
}
.statusBadge[data-status="UP"]{
  border-color:color-mix(in oklab,var(--success) 36%,var(--border));
  background:color-mix(in oklab,var(--success) 12%,transparent);
  color:var(--success);
}
.statusBadge[data-status="DEGRADED"]{
  border-color:color-mix(in oklab,var(--warning) 36%,var(--border));
  background:color-mix(in oklab,var(--warning) 12%,transparent);
  color:var(--warning);
}
.statusBadge[data-status="DOWN"]{
  border-color:color-mix(in oklab,var(--danger) 36%,var(--border));
  background:color-mix(in oklab,var(--danger) 12%,transparent);
  color:var(--danger);
}
.refreshMeta{
  display:grid;
  gap:2px;
  text-align:right;
  font-size:12px;
  color:var(--muted);
}
.opsActionGrid,
.summaryNotesGrid,
.focusGrid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:12px;
}
.grid4{
  display:grid;
  grid-template-columns:repeat(4, minmax(0,1fr));
  gap:12px;
}
.panel,
.statCard{
  padding:18px;
}
.panel{
  display:grid;
  gap:14px;
}
.panelHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.panelTitle{
  font-size:19px;
  font-weight:900;
}
.panelSub{
  margin-top:4px;
  color:var(--muted);
  line-height:1.55;
}
.opsActionMeta{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:10px;
}
.signalItem,
.focusRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px;
  border-radius:16px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.03);
}
.signalLabel,
.label,
.miniLabel{
  color:var(--muted);
  font-size:12px;
  font-weight:800;
}
.alertTestBox{
  border:1px solid var(--border);
  border-radius:18px;
  padding:14px 16px;
  background:rgba(255,255,255,.03);
  display:grid;
  gap:8px;
}
.alertTestBox[data-sent="true"]{
  border-color:color-mix(in oklab,var(--success) 36%,var(--border));
  background:color-mix(in oklab,var(--success) 8%,transparent);
}
.alertTestTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.alertTestMeta{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  font-size:12px;
  color:var(--muted);
}
.opsSummaryGrid{
  display:grid;
  grid-template-columns:repeat(4, minmax(0,1fr));
  gap:10px;
}
.miniStat{
  border:1px solid var(--border);
  border-radius:16px;
  padding:12px 14px;
  background:rgba(255,255,255,.03);
  display:grid;
  gap:6px;
}
.miniValue{
  font-size:24px;
  font-weight:900;
}
.opsAlertList,
.errorList,
.anomalyList,
.focusList,
.summaryNotes{
  display:grid;
  gap:12px;
}
.opsAlertItem,
.errorItem{
  border:1px solid var(--border);
  border-radius:18px;
  padding:14px 16px;
  background:rgba(255,255,255,.03);
}
.opsAlertItem[data-status="FAILED"]{
  border-color:color-mix(in oklab,var(--danger) 30%,var(--border));
  background:color-mix(in oklab,var(--danger) 8%,transparent);
}
.opsAlertItem[data-level="WARNING"]{
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--warning) 30%,transparent);
}
.opsAlertItem[data-level="DANGER"]{
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--danger) 30%,transparent);
}
.opsAlertTop,
.errorTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.opsAlertTitle{
  font-size:15px;
  line-height:1.5;
}
.opsAlertTime{
  color:var(--muted);
  font-size:12px;
}
.opsAlertMetaRow{
  margin-top:8px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.opsAlertChip{
  border-radius:999px;
  padding:6px 10px;
  font-size:12px;
  font-weight:800;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
}
.opsAlertChip[data-status="SENT"]{
  border-color:color-mix(in oklab,var(--success) 36%,var(--border));
  background:color-mix(in oklab,var(--success) 10%,transparent);
}
.opsAlertChip[data-status="FAILED"]{
  border-color:color-mix(in oklab,var(--danger) 36%,var(--border));
  background:color-mix(in oklab,var(--danger) 10%,transparent);
}
.opsAlertChip[data-level="WARNING"]{
  border-color:color-mix(in oklab,var(--warning) 36%,var(--border));
  background:color-mix(in oklab,var(--warning) 10%,transparent);
}
.opsAlertChip[data-level="DANGER"]{
  border-color:color-mix(in oklab,var(--danger) 36%,var(--border));
  background:color-mix(in oklab,var(--danger) 10%,transparent);
}
.opsAlertKey,
.errorTrace{
  margin-top:8px;
  font-size:12px;
  color:var(--muted);
  word-break:break-all;
}
.opsAlertBody,
.errorMessage,
.anomalyDesc{
  margin-top:8px;
  line-height:1.55;
}
.errorPath{
  margin-top:8px;
  font-weight:800;
}
.summaryNotes{
  margin:0;
  padding-left:18px;
  line-height:1.6;
}
.anomalyPanel{
  border-color:rgba(255,120,0,.36);
  background:linear-gradient(180deg, rgba(255,120,0,.10), rgba(255,120,0,.04));
}
.anomalyCard{
  padding:12px 14px;
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
.statCard{
  display:grid;
  gap:8px;
}
.value{
  font-size:30px;
  font-weight:900;
}
.hint,
.empty{
  color:var(--muted);
  line-height:1.55;
}
@media (max-width: 1080px){
  .grid4,
  .opsSummaryGrid{
    grid-template-columns:repeat(2, minmax(0,1fr));
  }
}
@media (max-width: 720px){
  .hero,
  .panelHead,
  .opsAlertTop,
  .alertTestTop{
    flex-direction:column;
  }
  .heroRight{
    justify-items:start;
  }
  .opsActionGrid,
  .summaryNotesGrid,
  .focusGrid,
  .grid4,
  .opsSummaryGrid,
  .opsActionMeta{
    grid-template-columns:1fr;
  }
}
</style>